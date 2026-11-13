import os

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('management.urls')),   # admin/staff login, site settings
    path('api/', include('matching.urls')),     # roommate swipe / requests / matches / chat
    path('api/', include('listings.urls')),
    path('api/users/', include('users.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# --- STARTUP SEED (safe) ---
# Previously this reset two superusers to a password written in the code on every boot.
# Now: the Django /admin/ site password is only set if you provide DJANGO_SUPERUSER_PASSWORD
# as an environment variable on Render. The website's admin panel uses its own 3-step login.
try:
    from django.contrib.auth import get_user_model

    su_password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')
    if su_password:
        User = get_user_model()
        u, _ = User.objects.get_or_create(
            username=os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin'),
            defaults={'email': 'admin@setmystay.com', 'first_name': 'Admin'},
        )
        u.is_staff = u.is_superuser = u.is_active = True
        u.set_password(su_password)
        u.save()

    from listings.models import Coupon
    Coupon.objects.get_or_create(code='WELCOME10', defaults={'discount_percentage': 10, 'is_active': True})
    Coupon.objects.get_or_create(code='STAY20', defaults={'discount_percentage': 20, 'is_active': True})
except Exception as e:
    print("Startup seed note:", e)
