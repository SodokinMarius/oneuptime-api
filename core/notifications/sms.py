"""Optional SMS delivery via Twilio when configured."""
from __future__ import annotations

import logging

from django.conf import settings

logger = logging.getLogger(__name__)


class SMSService:
    @staticmethod
    def is_configured() -> bool:
        return bool(
            getattr(settings, "TWILIO_ACCOUNT_SID", "")
            and getattr(settings, "TWILIO_AUTH_TOKEN", "")
            and getattr(settings, "TWILIO_FROM_NUMBER", "")
        )

    @classmethod
    def send(cls, to: str, body: str) -> bool:
        if not to or not body:
            return False
        if not cls.is_configured():
            logger.info("SMS skipped — Twilio not configured (to=%s)", to)
            return False

        try:
            import requests

            sid = settings.TWILIO_ACCOUNT_SID
            token = settings.TWILIO_AUTH_TOKEN
            from_number = settings.TWILIO_FROM_NUMBER
            url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
            response = requests.post(
                url,
                data={"To": to, "From": from_number, "Body": body},
                auth=(sid, token),
                timeout=15,
            )
            if response.status_code >= 300:
                logger.warning("Twilio SMS failed (%s): %s", response.status_code, response.text[:500])
                return False
            return True
        except Exception as exc:
            logger.warning("SMS send failed: %s", exc)
            return False
