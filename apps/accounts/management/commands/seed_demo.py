"""
Management command: seed_demo

Creates a demo tenant, project, user, team, monitors, and sample webhook.
Use --clean to remove demo data first.

  python manage.py seed_demo
  python manage.py seed_demo --clean
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.accounts.services.onboarding import OnboardingService
from apps.audit.models import DataType, RetentionPolicy
from apps.monitoring.models import Monitor, MonitorType
from apps.rbac.models import Team, TeamMembership
from apps.rbac.services import bootstrap_project
from apps.tenancy.models import Project, Tenant
from apps.webhooks.models import Webhook

User = get_user_model()

DEMO_EMAIL = "demo@oneuptime.local"
DEMO_PASSWORD = "DemoPass123!"
DEMO_TENANT_NAME = "Demo Corp"
DEMO_TENANT_SLUG = "demo"


class Command(BaseCommand):
    help = "Populate the database with demo data (or --clean to remove it)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Remove demo tenant and related data before seeding.",
        )

    def handle(self, *args, **options):
        if options["clean"]:
            removed = self._clean()
            self.stdout.write(self.style.WARNING(f"Removed demo data ({removed} tenants)."))

        if Tenant.objects.filter(slug=DEMO_TENANT_SLUG).exists():
            self.stdout.write(
                self.style.WARNING(
                    f"Demo tenant '{DEMO_TENANT_SLUG}' already exists. "
                    "Use --clean to recreate."
                )
            )
            return

        user, tenant, project = OnboardingService.create_account(
            email=DEMO_EMAIL,
            password=DEMO_PASSWORD,
            tenant_name=DEMO_TENANT_NAME,
            first_name="Demo",
            last_name="User",
        )
        user.is_active = True
        user.is_email_verified = True
        user.save(update_fields=["is_active", "is_email_verified", "updated_at"])

        # Align slug for predictable local URLs (acme-style subdomains)
        tenant.slug = DEMO_TENANT_SLUG
        tenant.save(update_fields=["slug", "updated_at"])

        roles = bootstrap_project(project, tenant)
        admin_role = roles["roles"]["admin"]

        team, _ = Team.objects.get_or_create(
            project=project,
            name="Platform",
            defaults={"tenant": tenant, "description": "Demo platform team"},
        )
        TeamMembership.objects.get_or_create(
            team=team,
            user=user,
            defaults={"role": admin_role},
        )

        now = timezone.now()
        monitors = [
            {
                "name": "Public Status API",
                "type": MonitorType.API,
                "url": "https://httpbin.org/status/200",
                "interval_seconds": 60,
            },
            {
                "name": "Slow Endpoint (degraded test)",
                "type": MonitorType.API,
                "url": "https://httpbin.org/delay/3",
                "interval_seconds": 120,
                "criteria": {"response_time_ms": {"operator": "lt", "value": 2000}},
            },
        ]
        for spec in monitors:
            Monitor.objects.get_or_create(
                project=project,
                name=spec["name"],
                defaults={
                    "tenant": tenant,
                    "type": spec["type"],
                    "url": spec["url"],
                    "interval_seconds": spec.get("interval_seconds", 60),
                    "criteria": spec.get("criteria", {}),
                    "next_check_at": now,
                },
            )

        Webhook.objects.get_or_create(
            project=project,
            name="Demo Webhook (noop)",
            defaults={
                "tenant": tenant,
                "url": "https://httpbin.org/post",
                "secret": "demo_webhook_secret_change_me",
                "event_types": ["*"],
                "is_active": False,
            },
        )

        for data_type, days in (
            (DataType.MONITOR_CHECKS, 30),
            (DataType.WEBHOOK_DELIVERIES, 14),
        ):
            RetentionPolicy.objects.get_or_create(
                project=project,
                data_type=data_type,
                defaults={"tenant": tenant, "retention_days": days},
            )

        self.stdout.write(self.style.SUCCESS("Demo data created:"))
        self.stdout.write(f"  Email:    {DEMO_EMAIL}")
        self.stdout.write(f"  Password: {DEMO_PASSWORD}")
        self.stdout.write(f"  Tenant:   {tenant.slug} (id={tenant.id})")
        self.stdout.write(f"  Project:  {project.slug} (id={project.id})")

    def _clean(self) -> int:
        tenants = Tenant.objects.filter(slug=DEMO_TENANT_SLUG)
        count = tenants.count()
        User.objects.filter(email=DEMO_EMAIL).delete()
        tenants.delete()
        return count
