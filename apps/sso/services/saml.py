"""
SAML 2.0 Service Provider — AuthnRequest generation and assertion validation.

Uses python3-saml (OneLogin) for standards-compliant XML signature verification.
"""
from __future__ import annotations

import logging
from urllib.parse import urlparse

from django.conf import settings

logger = logging.getLogger(__name__)


class SAMLServiceError(Exception):
    """Raised when SAML processing fails."""


def _get_saml_libs():
    try:
        from onelogin.saml2.auth import OneLogin_Saml2_Auth
        from onelogin.saml2.settings import OneLogin_Saml2_Settings
    except ImportError as exc:
        raise SAMLServiceError(
            "python3-saml is not installed. Run: pip install python3-saml"
        ) from exc
    return OneLogin_Saml2_Auth, OneLogin_Saml2_Settings


class SAMLService:
    """SAML 2.0 SP operations for a given project SSO configuration."""

    def __init__(self, sso_config):
        self.config = sso_config
        self.project_id = str(sso_config.project_id)
        self._sp = self._sp_urls()

    @staticmethod
    def _sp_urls(project_id: str) -> dict:
        base = settings.API_BASE_URL.rstrip("/")
        entity_id = f"{base}/api/v1/sso/metadata/{project_id}/"
        acs_url = f"{base}/api/v1/sso/acs/{project_id}/"
        slo_url = f"{base}/api/v1/sso/slo/{project_id}/"
        return {
            "entity_id": entity_id,
            "acs_url": acs_url,
            "slo_url": slo_url,
            "metadata_url": entity_id,
        }

    def sp_info(self) -> dict:
        """Return SP metadata values for IdP configuration."""
        return {
            **self._sp,
            "certificate": settings.SSO_SP_CERT or "",
        }

    def _build_settings(self) -> dict:
        idp_cert = self._normalize_cert(self.config.x509_cert)
        sp_cert = settings.SSO_SP_CERT or ""
        sp_key = settings.SSO_SP_PRIVATE_KEY or ""

        idp_settings: dict = {
            "entityId": self.config.entity_id,
            "singleSignOnService": {
                "url": self.config.sso_url,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
            },
            "x509cert": idp_cert,
        }
        if self.config.slo_url:
            idp_settings["singleLogoutService"] = {
                "url": self.config.slo_url,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
            }

        return {
            "strict": True,
            "debug": settings.DEBUG,
            "sp": {
                "entityId": self._sp["entity_id"],
                "assertionConsumerService": {
                    "url": self._sp["acs_url"],
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
                },
                "singleLogoutService": {
                    "url": self._sp["slo_url"],
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
                },
                "x509cert": sp_cert,
                "privateKey": sp_key,
            },
            "idp": idp_settings,
            "security": {
                "wantAssertionsSigned": True,
                "wantMessagesSigned": False,
                "authnRequestsSigned": bool(sp_key),
            },
        }

    @staticmethod
    def _normalize_cert(cert: str) -> str:
        """Strip PEM headers so python3-saml receives raw base64 body."""
        cert = cert.strip()
        for marker in ("-----BEGIN CERTIFICATE-----", "-----END CERTIFICATE-----"):
            cert = cert.replace(marker, "")
        return cert.strip()

    def _prepare_request(self, request_meta: dict):
        OneLogin_Saml2_Auth, OneLogin_Saml2_Settings = _get_saml_libs()
        saml_settings = OneLogin_Saml2_Settings(self._build_settings())
        return OneLogin_Saml2_Auth(request_meta, saml_settings.get_settings())

    @staticmethod
    def request_meta_from_django(request, project_id: str) -> dict:
        """Build the dict expected by python3-saml from a Django request."""
        parsed = urlparse(request.build_absolute_uri())
        return {
            "https": "on" if request.is_secure() else "off",
            "http_host": parsed.netloc,
            "script_name": request.META.get("SCRIPT_NAME", ""),
            "server_port": parsed.port or (443 if request.is_secure() else 80),
            "get_data": request.GET.copy(),
            "post_data": request.POST.copy(),
            "query_string": request.META.get("QUERY_STRING", ""),
        }

    def get_login_redirect_url(self, request) -> str:
        """Generate IdP redirect URL with SAML AuthnRequest."""
        auth = self._prepare_request(self.request_meta_from_django(request, self.project_id))
        return auth.login(return_to=settings.FRONTEND_URL)

    def process_acs(self, request) -> dict:
        """
        Validate SAMLResponse and extract user attributes.

        Returns dict with: email, first_name, last_name, attributes
        """
        auth = self._prepare_request(self.request_meta_from_django(request, self.project_id))
        auth.process_response()
        errors = auth.get_errors()
        if errors:
            reason = auth.get_last_error_reason()
            logger.warning("SAML ACS errors: %s — %s", errors, reason)
            raise SAMLServiceError(f"SAML validation failed: {', '.join(errors)} — {reason}")

        if not auth.is_authenticated():
            raise SAMLServiceError("SAML assertion did not authenticate the user")

        attrs = auth.get_attributes()
        name_id = (auth.get_nameid() or "").strip()

        attr_map = self.config.attribute_map or {}
        email_key = attr_map.get("email", "")
        email = name_id
        if email_key and email_key in attrs:
            val = attrs[email_key]
            email = val[0] if isinstance(val, list) else val
        email = (email or "").strip().lower()

        if not email or "@" not in email:
            raise SAMLServiceError("SAML response did not contain a valid email (NameID)")

        first_name = ""
        last_name = ""
        fn_key = attr_map.get("first_name", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname")
        ln_key = attr_map.get("last_name", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname")
        dn_key = attr_map.get("display_name", "http://schemas.microsoft.com/identity/claims/displayname")

        if fn_key in attrs:
            first_name = _first(attrs[fn_key])
        if ln_key in attrs:
            last_name = _first(attrs[ln_key])
        if not first_name and not last_name and dn_key in attrs:
            parts = _first(attrs[dn_key]).split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""

        return {
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "name_id": name_id,
            "attributes": attrs,
        }

    def get_metadata_xml(self) -> str:
        """Return SP metadata XML for IdP configuration."""
        _, OneLogin_Saml2_Settings = _get_saml_libs()
        saml_settings = OneLogin_Saml2_Settings(self._build_settings(), sp_validation_only=True)
        return saml_settings.get_sp_metadata()

    def get_logout_redirect_url(self, request, name_id: str, session_index: str = "") -> str | None:
        """Initiate SP-initiated SLO if IdP SLO URL is configured."""
        if not self.config.slo_url:
            return None
        auth = self._prepare_request(self.request_meta_from_django(request, self.project_id))
        return auth.logout(
            name_id=name_id,
            session_index=session_index,
            return_to=settings.FRONTEND_URL,
        )


def _first(value) -> str:
    if isinstance(value, list):
        return str(value[0]) if value else ""
    return str(value) if value else ""
