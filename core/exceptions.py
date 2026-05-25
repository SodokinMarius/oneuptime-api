from rest_framework.views import exception_handler


def rfc7807_handler(exc, context):
    """Handler d'exceptions DRF (RFC 7807 à enrichir plus tard)."""
    return exception_handler(exc, context)
