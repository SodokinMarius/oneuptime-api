"""
RFC 7807 Problem Details exception handler for DRF.

Every error response follows the format:
{
    "type":     "<error_type_slug>",
    "title":    "<human-readable title>",
    "status":   <http_status_code>,
    "detail":   "<explanation>",
    "instance": "<request path>",
    "errors":   [...]   // only on validation errors
}
"""
from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed,
    MethodNotAllowed,
    NotAuthenticated,
    NotFound,
    PermissionDenied,
    Throttled,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler


_STATUS_TO_TYPE = {
    400: "validation_error",
    401: "authentication_failed",
    403: "permission_denied",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    429: "rate_limit_exceeded",
    500: "internal_error",
}

_STATUS_TO_TITLE = {
    400: "Validation Failed",
    401: "Authentication Failed",
    403: "Permission Denied",
    404: "Not Found",
    405: "Method Not Allowed",
    409: "Conflict",
    429: "Too Many Requests",
    500: "Internal Server Error",
}


def _flatten_errors(detail, field=None):
    """Recursively flatten DRF error detail into a list of {field, code, message}."""
    errors = []
    if isinstance(detail, list):
        for item in detail:
            errors.extend(_flatten_errors(item, field=field))
    elif isinstance(detail, dict):
        for key, value in detail.items():
            errors.extend(_flatten_errors(value, field=key))
    else:
        entry = {
            "message": str(detail),
            "code": getattr(detail, "code", "invalid"),
        }
        if field and field != "non_field_errors":
            entry["field"] = field
        errors.append(entry)
    return errors


def rfc7807_handler(exc, context):
    """
    Custom DRF exception handler — returns RFC 7807 Problem Details.
    Falls back to DRF default for unhandled exceptions (returns None → 500).
    """
    response = exception_handler(exc, context)
    if response is None:
        return None

    request = context.get("request")
    instance = request.path if request else "unknown"
    http_status = response.status_code

    error_type = _STATUS_TO_TYPE.get(http_status, "error")
    title = _STATUS_TO_TITLE.get(http_status, "Error")

    # Build base body
    body = {
        "type": error_type,
        "title": title,
        "status": http_status,
        "instance": instance,
    }

    # Detail message + optional field errors
    if isinstance(exc, ValidationError):
        body["detail"] = "One or more fields are invalid."
        body["errors"] = _flatten_errors(exc.detail)
    elif isinstance(exc, NotAuthenticated):
        body["detail"] = "Authentication credentials were not provided."
    elif isinstance(exc, AuthenticationFailed):
        body["detail"] = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        # Preserve custom codes from ActiveVerifiedJWTAuthentication
        if hasattr(exc.detail, "code"):
            body["code"] = exc.detail.code
    elif isinstance(exc, PermissionDenied):
        body["detail"] = "You do not have permission to perform this action."
    elif isinstance(exc, NotFound):
        body["detail"] = "The requested resource was not found."
    elif isinstance(exc, MethodNotAllowed):
        body["detail"] = f"Method '{exc.args[0] if exc.args else 'unknown'}' not allowed."
    elif isinstance(exc, Throttled):
        wait = int(exc.wait) if exc.wait else None
        body["detail"] = (
            f"Request was throttled. Expected available in {wait}s."
            if wait
            else "Request was throttled."
        )
        if wait:
            body["retry_after"] = wait
        error_type = "rate_limit_exceeded"
        body["type"] = error_type
    else:
        # Generic DRF exception
        data = response.data
        if isinstance(data, dict) and "detail" in data:
            body["detail"] = str(data["detail"])
        elif isinstance(data, list):
            body["detail"] = str(data[0]) if data else "An error occurred."
        else:
            body["detail"] = "An error occurred."

    response.data = body
    return response
