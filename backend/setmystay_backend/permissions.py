from rest_framework import permissions


class IsStaff(permissions.BasePermission):
    """Staff members and admins (Django is_staff)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class IsSuperAdmin(permissions.BasePermission):
    """Only the admin panel account (Django superuser)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class ReadOnlyOrSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


def is_staff_user(request):
    return bool(request.user and request.user.is_authenticated and request.user.is_staff)
