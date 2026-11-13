from django.contrib import admin

# Register your models here.

from .models import AdminPanelCredential, SiteSettings


@admin.register(AdminPanelCredential)
class AdminPanelCredentialAdmin(admin.ModelAdmin):
    """Delete this row to reset the admin-panel login to its original values."""
    list_display = ('question', 'updated_at')
    readonly_fields = ('password_hash', 'pin_hash', 'answer_hash', 'updated_at')


admin.site.register(SiteSettings)
