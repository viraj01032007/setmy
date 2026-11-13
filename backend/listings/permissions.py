from rest_framework import permissions


def is_staff(user):
    return bool(user and user.is_authenticated and user.is_staff)


class IsStaff(permissions.BasePermission):
    """Logged-in staff / admin accounts only."""

    def has_permission(self, request, view):
        return is_staff(request.user)


class IsSuperuser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class IsStaffOrReadOnly(permissions.BasePermission):
    """Anyone can read; only staff can create / edit / delete."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return is_staff(request.user)


class IsOwnerOrStaff(permissions.BasePermission):
    """Object-level: the listing's owner (or staff) may edit / delete it."""

    owner_field = 'owner'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if is_staff(request.user):
            return True
        owner = getattr(obj, 'owner', None) or getattr(obj, 'user', None)
        return owner == request.user
