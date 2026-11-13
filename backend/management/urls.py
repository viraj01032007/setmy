from django.urls import path
from .views import AdminLoginView, AdminQuestionView, AdminCredentialsView, StaffLoginView, SiteSettingsView

urlpatterns = [
    path('auth/admin-login/', AdminLoginView.as_view(), name='admin-login'),
    path('auth/admin-question/', AdminQuestionView.as_view(), name='admin-question'),
    path('auth/admin-credentials/', AdminCredentialsView.as_view(), name='admin-credentials'),
    path('auth/staff-login/', StaffLoginView.as_view(), name='staff-login'),
    path('site-settings/', SiteSettingsView.as_view(), name='site-settings'),
]
