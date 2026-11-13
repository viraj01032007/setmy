from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from setmystay_backend.permissions import IsSuperAdmin
from .models import AdminPanelCredential, SiteSettings

ADMIN_PANEL_USERNAME = 'admin'


def _norm_answer(a):
    return ' '.join(str(a or '').lower().split())


def _admin_account():
    """The Django superuser the admin panel acts as. Created with an unusable password if missing."""
    user, created = User.objects.get_or_create(
        username=ADMIN_PANEL_USERNAME,
        defaults={'email': 'admin@setmystay.com', 'first_name': 'Admin', 'is_staff': True, 'is_superuser': True},
    )
    if created:
        user.set_unusable_password()
        user.save()
    elif not (user.is_staff and user.is_superuser and user.is_active):
        user.is_staff = user.is_superuser = user.is_active = True
        user.save()
    return user


def _tokens(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


class AdminQuestionView(APIView):
    """Step 3 of the login screen needs to show the question text."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({'question': AdminPanelCredential.get().question})


class AdminLoginView(APIView):
    """
    POST {password, pin, answer}. All three are checked together on the server, and the reply never
    says which one was wrong. Rate-limited to 10 attempts an hour per IP.
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'admin_login'

    def post(self, request):
        cred = AdminPanelCredential.get()
        step = request.data.get('step', 'all')
        password = str(request.data.get('password', ''))
        pin = str(request.data.get('pin', ''))
        answer = _norm_answer(request.data.get('answer', ''))

        ok_password = check_password(password, cred.password_hash)
        # Lets the UI move to step 2 / 3 with feedback, while the final step re-checks everything.
        if step == 'password':
            return Response({'ok': ok_password}, status=200 if ok_password else 401)
        ok_pin = ok_password and check_password(pin, cred.pin_hash)
        if step == 'pin':
            return Response({'ok': ok_pin}, status=200 if ok_pin else 401)

        if not (ok_pin and check_password(answer, cred.answer_hash)):
            return Response({'error': 'Incorrect details. Please try again.'}, status=status.HTTP_401_UNAUTHORIZED)

        user = _admin_account()
        return Response({**_tokens(user), 'name': user.first_name or 'Admin', 'role': 'admin'})


class AdminCredentialsView(APIView):
    """Admin → Settings: change password, PIN, or security question. Requires the current password."""
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        cred = AdminPanelCredential.get()
        return Response({'question': cred.question, 'updated_at': cred.updated_at})

    def post(self, request):
        cred = AdminPanelCredential.get()
        if not check_password(str(request.data.get('current_password', '')), cred.password_hash):
            return Response({'error': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

        changed = []
        new_password = request.data.get('new_password')
        if new_password:
            if len(str(new_password)) < 8:
                return Response({'error': 'New password must be at least 8 characters.'}, status=400)
            cred.password_hash = make_password(str(new_password))
            changed.append('password')
        new_pin = request.data.get('new_pin')
        if new_pin:
            if not str(new_pin).isdigit() or not (4 <= len(str(new_pin)) <= 8):
                return Response({'error': 'PIN must be 4–8 digits.'}, status=400)
            cred.pin_hash = make_password(str(new_pin))
            changed.append('pin')
        new_question = request.data.get('new_question')
        new_answer = request.data.get('new_answer')
        if new_question or new_answer:
            if not (new_question and new_answer):
                return Response({'error': 'Send both the question and its answer.'}, status=400)
            cred.question = str(new_question)[:255]
            cred.answer_hash = make_password(_norm_answer(new_answer))
            changed.append('security question')
        if not changed:
            return Response({'error': 'Nothing to change.'}, status=400)
        cred.save()
        return Response({'status': 'success', 'changed': changed})


class StaffLoginView(APIView):
    """Staff sign-in. Only accounts the admin created as staff can get in (customers can't)."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'staff_login'

    def post(self, request):
        from django.contrib.auth import authenticate
        user = authenticate(username=request.data.get('username', ''), password=request.data.get('password', ''))
        if not user or not user.is_active or not user.is_staff:
            return Response({'error': 'Incorrect User ID or password.'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({**_tokens(user), 'name': user.first_name or user.username, 'role': 'admin' if user.is_superuser else 'staff'})


class SiteSettingsView(APIView):
    """GET is public (prices + contact shown on the site). PUT is admin only."""

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsSuperAdmin()]

    def _payload(self, s):
        return {
            'pricing': s.pricing,
            'contact_email': s.contact_email,
            'contact_phone': s.contact_phone,
            'contact_address': s.contact_address,
            'roommate_plans': settings.ROOMMATE_PLANS,
            'updated_at': s.updated_at,
        }

    def get(self, request):
        return Response(self._payload(SiteSettings.get()))

    def put(self, request):
        s = SiteSettings.get()
        pricing = request.data.get('pricing')
        if pricing is not None:
            if not isinstance(pricing, dict) or 'unlocks' not in pricing or 'listings' not in pricing:
                return Response({'error': 'Invalid pricing format.'}, status=400)
            s.pricing = pricing
        for field in ('contact_email', 'contact_phone', 'contact_address'):
            if field in request.data:
                setattr(s, field, str(request.data[field]))
        s.save()
        return Response(self._payload(s))
