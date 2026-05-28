"""
Management command: verify_audit_chain

Verifies the SHA-256 hash chain integrity of the audit log for one or all tenants.
Reports any broken links (tamper detection).

Usage:
  python manage.py verify_audit_chain
  python manage.py verify_audit_chain --tenant-id <uuid>
  python manage.py verify_audit_chain --since 2026-01-01
"""
import logging
from datetime import datetime

from django.core.management.base import BaseCommand

from apps.audit.services import AuditService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Verify the SHA-256 hash chain integrity of the audit log."

    def add_arguments(self, parser):
        parser.add_argument(
            "--tenant-id",
            type=str,
            help="Verify only for a specific tenant UUID.",
        )
        parser.add_argument(
            "--since",
            type=str,
            help="Verify only records since this date (ISO format: YYYY-MM-DD).",
        )

    def handle(self, *args, **options):
        from apps.tenancy.models import Tenant

        since = None
        if options["since"]:
            try:
                since = datetime.fromisoformat(options["since"]).replace(
                    tzinfo=__import__("datetime").timezone.utc
                )
            except ValueError:
                self.stderr.write(f"Invalid date format: {options['since']}. Use YYYY-MM-DD.")
                return

        if options["tenant_id"]:
            tenants = Tenant.objects.filter(id=options["tenant_id"])
            if not tenants.exists():
                self.stderr.write(f"Tenant not found: {options['tenant_id']}")
                return
        else:
            tenants = Tenant.objects.all()

        all_valid = True

        for tenant in tenants:
            result = AuditService.verify_chain(tenant, since=since)
            status_icon = "✅" if result["valid"] else "❌"
            self.stdout.write(
                f"{status_icon} Tenant '{tenant.name}' ({tenant.id}): "
                f"checked={result['checked']}, broken={len(result['broken'])}"
            )
            if not result["valid"]:
                all_valid = False
                for item in result["broken"][:10]:
                    self.stderr.write(f"    → Record #{item['id']}: {item['reason']}")
                if len(result["broken"]) > 10:
                    self.stderr.write(
                        f"    ... and {len(result['broken']) - 10} more broken records."
                    )

        if all_valid:
            self.stdout.write(self.style.SUCCESS("Audit chain: VALID ✓"))
        else:
            self.stderr.write(self.style.ERROR("Audit chain: INTEGRITY VIOLATION DETECTED"))
            raise SystemExit(1)
