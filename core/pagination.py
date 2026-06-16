"""Custom pagination classes for the OneUptime API."""
from rest_framework.pagination import CursorPagination, PageNumberPagination


class CreatedAtCursorPagination(CursorPagination):
    """
    CursorPagination that orders by ``created_at`` instead of the DRF default
    ``created`` field (which does not exist on any model in this project).

    All models in this project use ``created_at`` as the timestamp field, so
    this class must be used as the global default to avoid a Django
    ``FieldError: Cannot resolve keyword 'created' into field`` on every
    list endpoint.
    """

    ordering = "-created_at"
    page_size_query_param = "page_size"
    max_page_size = 500


class AuditLogPageNumberPagination(PageNumberPagination):
    """Page-number pagination for the audit log UI (supports page + count)."""

    page_size = 30
    page_size_query_param = "page_size"
    max_page_size = 500
