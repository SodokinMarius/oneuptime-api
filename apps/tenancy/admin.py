"""Admin registrations for tenancy app."""
from django.contrib import admin

from apps.tenancy.models import Project, Tenant


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'plan', 'status', 'data_region', 'created_at')
    list_filter = ('status', 'plan', 'data_region')
    search_fields = ('name', 'slug', 'domain')
    readonly_fields = ('id', 'created_at', 'updated_at')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'tenant', 'is_active', 'created_at')
    list_filter = ('is_active', 'tenant')
    search_fields = ('name', 'slug', 'tenant__name', 'tenant__slug')
    autocomplete_fields = ('tenant',)
    readonly_fields = ('id', 'created_at', 'updated_at')
    prepopulated_fields = {'slug': ('name',)}
