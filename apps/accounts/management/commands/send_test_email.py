"""Send a test HTML email to verify SMTP / Gmail configuration."""
from django.conf import settings
from django.core.management.base import BaseCommand

from apps.accounts.services.email import AuthEmailService
from apps.accounts.services.otp import OtpService


class Command(BaseCommand):
    help = 'Send a test activation email (HTML) to verify Gmail SMTP'

    def add_arguments(self, parser):
        parser.add_argument(
            'email',
            nargs='?',
            default=settings.EMAIL_HOST_USER,
            help='Recipient email (default: EMAIL_HOST_USER)',
        )

    def handle(self, *args, **options):
        email = options['email']
        code = OtpService.generate_code()
        self.stdout.write(f'Sending test email to {email}...')
        AuthEmailService.send_activation_otp(email, code)
        self.stdout.write(self.style.SUCCESS(f'Email sent. OTP code: {code}'))
