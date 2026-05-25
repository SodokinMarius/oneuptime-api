"""Shared helpers for accounts views."""
from rest_framework import status
from rest_framework.response import Response

from apps.accounts.exceptions import OtpError


def otp_error_response(exc: OtpError) -> Response:
    """Map OtpError to a structured JSON response."""
    status_code = status.HTTP_400_BAD_REQUEST
    if exc.code == 'otp_locked':
        status_code = status.HTTP_429_TOO_MANY_REQUESTS

    payload = {
        'detail': exc.message,
        'code': exc.code,
    }
    if exc.attempts_remaining is not None:
        payload['attempts_remaining'] = exc.attempts_remaining
    if exc.action:
        payload['action'] = exc.action

    return Response(payload, status=status_code)
