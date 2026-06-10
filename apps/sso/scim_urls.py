"""SCIM 2.0 URL routing — mounted at /scim/v2/."""
from django.urls import path

from apps.sso.views import (
    SCIMGroupsView,
    SCIMSchemasView,
    SCIMServiceProviderConfigView,
    SCIMUsersView,
)

urlpatterns = [
    path(
        "ServiceProviderConfig",
        SCIMServiceProviderConfigView.as_view(),
        name="scim-service-provider-config",
    ),
    path("Schemas", SCIMSchemasView.as_view(), name="scim-schemas"),
    path("Users", SCIMUsersView.as_view(), name="scim-users"),
    path("Users/<uuid:user_id>", SCIMUsersView.as_view(), name="scim-user-detail"),
    path("Groups", SCIMGroupsView.as_view(), name="scim-groups"),
    path("Groups/<uuid:group_id>", SCIMGroupsView.as_view(), name="scim-group-detail"),
]
