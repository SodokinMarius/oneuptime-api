"""
Core middleware: TenantMiddleware, ProjectMiddleware, RateLimitMiddleware.

TenantMiddleware — resolves request.tenant from:
  1. X-Tenant-Id header
  2. Subdomain (acme.api.domain.com → slug = 'acme')
  3. Owner membership of the authenticated user (fallback)

ProjectMiddleware — resolves request.project from:
  1. X-Project-Id header
  2. Default (first active) project of the tenant

Both set the PostgreSQL RLS variable app.current_tenant for row-level security.

Paths in SKIP_PATHS bypass tenant resolution entirely.
"""
import math
import time

from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse

SKIP_PATHS = {
    "/admin/",
    "/healthz",
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/activate",
    "/api/v1/auth/resend-activation",
    "/api/v1/auth/refresh",
    "/api/v1/auth/token/verify",
    "/api/v1/auth/password-reset",
    "/api/v1/auth/password-reset/confirm",
    "/api/v1/auth/accept-invite",
    "/api/v1/openapi.json",
    "/api/v1/docs",
    "/api/v1/redoc",
    "/api/v1/sso/discover/",
}

SKIP_PREFIXES = (
    "/api/v1/sso/metadata/",
    "/api/v1/sso/login/",
    "/api/v1/sso/acs/",
    "/api/v1/sso/slo/",
    "/scim/v2/",
)


def _should_skip(path: str) -> bool:
    if path in SKIP_PATHS:
        return True
    for prefix in SKIP_PREFIXES:
        if path.startswith(prefix):
            return True
    # Skip all /status/<slug>/ public pages
    if path.startswith("/status/"):
        return True
    return False


class TenantMiddleware:
    """Resolves request.tenant and sets the Postgres RLS context variable."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if _should_skip(request.path):
            return self.get_response(request)

        tenant = self._resolve_tenant(request)

        if tenant is None:
            # No tenant found — only superusers can proceed without a tenant context
            if request.user.is_authenticated and request.user.is_superuser:
                return self.get_response(request)
            # For unauthenticated requests, let permission classes handle 401
            return self.get_response(request)

        if tenant.status != "active":
            return JsonResponse(
                {"type": "tenant_suspended", "title": "Tenant Suspended",
                 "status": 403, "detail": "This tenant is suspended."},
                status=403,
            )

        request.tenant = tenant
        self._set_rls_context(tenant)

        # Inject actor into thread-local for auto-audit signals
        if request.user.is_authenticated:
            try:
                from apps.audit.services import AuditService
                AuditService.set_current_actor(request.user, request)
            except Exception:
                pass

        # Verify user belongs to this tenant (if authenticated)
        if request.user.is_authenticated and not request.user.is_superuser:
            from apps.accounts.models import UserMembership
            if not UserMembership.objects.filter(
                user=request.user, tenant=tenant, accepted_at__isnull=False
            ).exists():
                return JsonResponse(
                    {"type": "permission_denied", "title": "Permission Denied",
                     "status": 403, "detail": "You are not a member of this tenant."},
                    status=403,
                )

        response = self.get_response(request)

        # Clear thread-local actor after response to prevent leaks
        try:
            from apps.audit.services import AuditService
            AuditService.clear_current_actor()
        except Exception:
            pass

        return response

    def _resolve_tenant(self, request):
        from apps.tenancy.models import Tenant

        # 1. Explicit header
        tenant_id = request.headers.get("X-Tenant-Id")
        if tenant_id:
            return Tenant.objects.filter(id=tenant_id).first()

        # 2. Subdomain: acme.api.domain.com → slug = 'acme'
        host = request.get_host().split(":")[0]
        parts = host.split(".")
        if len(parts) > 2:
            slug = parts[0]
            tenant = Tenant.objects.filter(slug=slug).first()
            if tenant:
                return tenant

        # 3. Fallback: owner membership of the authenticated user
        if request.user.is_authenticated:
            from apps.accounts.models import UserMembership
            membership = (
                UserMembership.objects.filter(
                    user=request.user,
                    is_owner=True,
                    accepted_at__isnull=False,
                )
                .select_related("tenant")
                .first()
            )
            if membership:
                return membership.tenant

        return None

    @staticmethod
    def _set_rls_context(tenant):
        """Set the PostgreSQL session variable used by Row-Level Security policies."""
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT set_config('app.current_tenant', %s, false)",
                [str(tenant.id)],
            )


class ProjectMiddleware:
    """
    Resolves request.project after TenantMiddleware has run.
    Reads X-Project-Id header or falls back to the default project.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if _should_skip(request.path):
            return self.get_response(request)

        tenant = getattr(request, "tenant", None)
        if tenant is None:
            return self.get_response(request)

        project = self._resolve_project(request, tenant)
        if project:
            request.project = project
            blocked = self._check_sso_enforcement(request, project)
            if blocked is not None:
                return blocked

        return self.get_response(request)

    @staticmethod
    def _check_sso_enforcement(request, project):
        """Block API access when enforce_sso is on and session was not via SAML."""
        if not request.user.is_authenticated:
            return None
        from apps.sso.services.enforcement import SSOEnforcement

        if not SSOEnforcement.project_requires_sso(project.id):
            return None
        if SSOEnforcement.has_sso_access(request, project.id):
            return None
        return JsonResponse(
            {
                "type": "sso_required",
                "title": "SSO Required",
                "status": 406,
                "detail": (
                    "This project requires SSO authentication. "
                    "Log in via SAML and include the SSO-issued token."
                ),
            },
            status=406,
        )

    @staticmethod
    def _resolve_project(request, tenant):
        from apps.tenancy.models import Project

        # 1. Explicit header
        project_id = request.headers.get("X-Project-Id")
        if project_id:
            return Project.objects.filter(id=project_id, tenant=tenant, is_active=True).first()

        # 2. Default: first active project of the tenant
        return Project.objects.filter(tenant=tenant, is_active=True).order_by("created_at").first()


# ---------------------------------------------------------------------------
# Rate Limiting
# ---------------------------------------------------------------------------

# Requests per minute by tenant plan (matches CDC §12.2)
_RATE_LIMITS = {
    "free":       100,
    "growth":     500,
    "scale":      1000,
    "enterprise": 5000,
}
_ANON_LIMIT = 60   # unauthenticated requests per minute
_WINDOW = 60       # seconds


class RateLimitMiddleware:
    """
    Sliding-window rate limiter per user (or IP for anonymous requests).

    Adds CDC-compliant response headers on every request:
      X-RateLimit-Limit     — allowed requests per minute
      X-RateLimit-Remaining — requests left in the current window
      X-RateLimit-Reset     — Unix timestamp when the window resets

    Returns RFC 7807 429 when the limit is exceeded.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        limit, key = self._resolve(request)
        now = int(time.time())
        window_start = now - _WINDOW
        window_reset = now + _WINDOW

        # Increment counter atomically via cache
        cache_key = f"rl:{key}:{now // _WINDOW}"
        try:
            count = cache.get(cache_key, 0)
            count += 1
            cache.set(cache_key, count, timeout=_WINDOW * 2)
        except Exception:
            # If cache is unavailable, degrade gracefully (let the request through)
            count = 0

        remaining = max(0, limit - count)

        if count > limit:
            response = JsonResponse(
                {
                    "type": "rate_limit_exceeded",
                    "title": "Too Many Requests",
                    "status": 429,
                    "detail": f"Rate limit of {limit} req/min exceeded.",
                    "retryAfter": window_reset - now,
                },
                status=429,
            )
        else:
            response = self.get_response(request)

        response["X-RateLimit-Limit"] = str(limit)
        response["X-RateLimit-Remaining"] = str(remaining)
        response["X-RateLimit-Reset"] = str(window_reset)
        return response

    @staticmethod
    def _resolve(request):
        """Return (limit, cache_key) for the current request."""
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            # Determine plan from tenant
            tenant = getattr(request, "tenant", None)
            plan = getattr(tenant, "plan", "free") if tenant else "free"
            limit = _RATE_LIMITS.get(plan.lower(), _RATE_LIMITS["free"])
            key = f"user:{user.pk}"
        else:
            # Fallback: rate-limit by IP
            xff = request.META.get("HTTP_X_FORWARDED_FOR")
            ip = xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR", "unknown")
            limit = _ANON_LIMIT
            key = f"ip:{ip}"
        return limit, key
