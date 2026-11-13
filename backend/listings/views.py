from datetime import timedelta
import razorpay
from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters, permissions, parsers, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Property,
    ListingImage,
    RoommateProfile,
    Amenity,
    Coupon,
    Advertisement,
    Purchase,
)
from setmystay_backend.permissions import IsStaff, IsSuperAdmin, ReadOnlyOrSuperAdmin, is_staff_user
from .serializers import (
    PropertySerializer,
    RoommateProfileSerializer,
    AmenitySerializer,
    CouponSerializer,
    AdvertisementSerializer,
    PurchaseSerializer,
    StaffSerializer,
)


def get_razorpay_client():
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


class PropertyViewSet(viewsets.ModelViewSet):
    ordering = ['-created_at']
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    serializer_class = PropertySerializer

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['city', 'property_type', 'bhk', 'furnishing']
    search_fields = ['title', 'area', 'description']
    ordering_fields = ['rent', 'created_at']

    def get_permissions(self):
        if self.action == 'update_status':
            return [IsStaff()]
        if self.action in ['create', 'toggle_favorite']:
            return [permissions.IsAuthenticated()]
        if self.action in ['destroy', 'update', 'partial_update']:
            # owner or staff — checked object-level in check_object_permissions below
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if self.action in ['destroy', 'update', 'partial_update']:
            if not (is_staff_user(request) or obj.owner_id == request.user.id):
                self.permission_denied(request, message='You can only change your own listings.')

    def get_queryset(self):
        qs = Property.objects.all().prefetch_related('images', 'amenities').order_by('-created_at')
        staff = is_staff_user(self.request)

        # Staff/admin panel: everything (pending, approved, rejected)
        if staff and (self.request.query_params.get('admin') == 'true' or self.action not in ['list']):
            status_filter = self.request.query_params.get('status')
            if status_filter:
                qs = qs.filter(status=status_filter.upper())
            return qs

        # Owners can open/edit their own pending listings
        if self.action != 'list' and self.request.user and self.request.user.is_authenticated:
            from django.db.models import Q
            return qs.filter(Q(status='APPROVED') | Q(owner=self.request.user))

        # Public site: only approved listings appear (this is what puts a listing on the home page)
        return qs.filter(status='APPROVED')

    def perform_create(self, serializer):
        # 1. Save main property data with status='PENDING' — it appears in the staff & admin review queue
        property_instance = serializer.save(owner=self.request.user, status='PENDING')

        # 2. Safely save Images to Cloud/Local
        try:
            images = self.request.FILES.getlist('uploaded_images')
            for image in images:
                file_path = default_storage.save(f'property_images/{image.name}', ContentFile(image.read()))
                full_image_url = default_storage.url(file_path)
                ListingImage.objects.create(property=property_instance, image_url=full_image_url, is_video=False)
        except Exception as e:
            print("Image upload fallback:", e)
            if not property_instance.images.exists():
                ListingImage.objects.create(
                    property=property_instance,
                    image_url='https://placehold.co/600x400?text=Property+Image',
                    is_video=False
                )

        # 3. Safely save Video if provided
        try:
            video_file = self.request.FILES.get('uploaded_video')
            if video_file:
                video_path = default_storage.save(f'property_videos/{video_file.name}', ContentFile(video_file.read()))
                full_video_url = default_storage.url(video_path)
                ListingImage.objects.create(property=property_instance, image_url=full_video_url, is_video=True)
        except Exception as e:
            print("Video upload fallback:", e)

        # 4. Save Amenities
        try:
            amenities_str = self.request.data.get('amenities_list', '')
            if amenities_str:
                if isinstance(amenities_str, list):
                    amenities_str = ','.join(amenities_str)
                amenity_names = [
                    a.replace('[', '').replace(']', '').replace('"', '').strip()
                    for a in str(amenities_str).split(',')
                    if a.strip()
                ]
                for name in amenity_names:
                    if name:
                        amenity_obj, _ = Amenity.objects.get_or_create(name=name)
                        property_instance.amenities.add(amenity_obj)
        except Exception as e:
            print("Amenity save note:", e)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def toggle_favorite(self, request, pk=None):
        property_instance = self.get_object()
        user = request.user
        if user in property_instance.favorited_by.all():
            property_instance.favorited_by.remove(user)
            return Response({'status': 'removed', 'message': 'Removed from favorites'})
        else:
            property_instance.favorited_by.add(user)
            return Response({'status': 'added', 'message': 'Added to favorites'})

    @action(detail=True, methods=['post'], permission_classes=[IsStaff])
    def update_status(self, request, pk=None):
        property_instance = Property.objects.filter(pk=pk).first()
        if not property_instance:
            return Response({'error': 'Property not found'}, status=status.HTTP_404_NOT_FOUND)

        new_status = str(request.data.get('status', '')).upper()
        valid_statuses = ['APPROVED', 'REJECTED', 'PENDING']

        if new_status not in valid_statuses:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        property_instance.status = new_status

        if new_status in ['APPROVED', 'REJECTED']:
            if request.user and request.user.is_authenticated:
                property_instance.reviewed_by = request.user
            property_instance.reviewed_at = timezone.now()
        else:
            property_instance.reviewed_by = None
            property_instance.reviewed_at = None

        property_instance.save()
        return Response({
            'status': 'success',
            'message': f'Property {new_status.lower()} successfully',
            'reviewed_by': request.user.first_name or request.user.username,
            'live_on_site': new_status == 'APPROVED',
        })

    @action(detail=False, methods=['get'], permission_classes=[IsStaff])
    def review_summary(self, request):
        """Small payload the staff & admin panels poll to show 'new listing request' alerts."""
        pending = Property.objects.filter(status='PENDING').order_by('-created_at')
        latest = pending.first()
        return Response({
            'pending_count': pending.count(),
            'latest_pending_id': latest.id if latest else None,
            'latest_pending_title': latest.title if latest else None,
            'latest_pending_at': latest.created_at if latest else None,
            'approved_count': Property.objects.filter(status='APPROVED').count(),
            'rejected_count': Property.objects.filter(status='REJECTED').count(),
        })


class RoommateViewSet(viewsets.ModelViewSet):
    ordering = ['-id']
    serializer_class = RoommateProfileSerializer

    def get_permissions(self):
        if self.action in ['update_status', 'destroy']:
            return [IsStaff()]
        if self.action in ['create', 'update', 'partial_update']:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        if self.action in ['update', 'partial_update']:
            # owners may edit their profile, but only staff can change its review status
            if not is_staff_user(request):
                if obj.user_id != request.user.id:
                    self.permission_denied(request, message='You can only change your own profile.')
                if 'status' in request.data:
                    self.permission_denied(request, message='Only staff can change review status.')

    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['location_preference', 'is_smoker', 'has_pets']

    def get_queryset(self):
        if self.action in ['update_status', 'destroy', 'retrieve', 'update', 'partial_update']:
            return RoommateProfile.objects.all().order_by('-id')
        if is_staff_user(self.request):
            return RoommateProfile.objects.all().order_by('-id')
        return RoommateProfile.objects.filter(status='APPROVED').order_by('-id')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, status='PENDING')

    @action(detail=True, methods=['post'], permission_classes=[IsStaff])
    def update_status(self, request, pk=None):
        profile = RoommateProfile.objects.filter(pk=pk).first()
        if not profile:
            return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)

        new_status = str(request.data.get('status', '')).upper()
        if new_status not in ['APPROVED', 'REJECTED', 'PENDING']:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        if new_status in ['APPROVED', 'REJECTED']:
            if request.user and request.user.is_authenticated:
                profile.reviewed_by = request.user
            profile.reviewed_at = timezone.now()
        else:
            profile.reviewed_by = None
            profile.reviewed_at = None

        profile.status = new_status
        profile.save()
        return Response({'status': 'success', 'message': f'Profile {new_status.lower()} successfully'})


class AmenityViewSet(viewsets.ModelViewSet):
    queryset = Amenity.objects.all()
    serializer_class = AmenitySerializer

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [IsStaff()]


class RoommateListView(generics.ListAPIView):
    serializer_class = PropertySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Property.objects.filter(property_type='ROOMMATE', status='APPROVED')


class MyPropertiesView(generics.ListAPIView):
    serializer_class = PropertySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Property.objects.filter(owner=self.request.user).order_by('-created_at')


class CouponViewSet(viewsets.ModelViewSet):
    serializer_class = CouponSerializer
    permission_classes = [ReadOnlyOrSuperAdmin]

    def get_queryset(self):
        qs = Coupon.objects.all().order_by('-created_at')
        # visitors only ever see active codes; the admin sees all of them
        if not (self.request.user and self.request.user.is_authenticated and self.request.user.is_superuser):
            qs = qs.filter(is_active=True)
        return qs


class AdvertisementViewSet(viewsets.ModelViewSet):
    queryset = Advertisement.objects.all().order_by('-created_at')
    serializer_class = AdvertisementSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    permission_classes = [ReadOnlyOrSuperAdmin]


class StaffViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(is_staff=True, is_superuser=False).order_by('-date_joined')
    serializer_class = StaffSerializer
    permission_classes = [IsSuperAdmin]

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        data = []

        for staff in queryset:
            prop_reviews = Property.objects.filter(reviewed_by=staff).exclude(reviewed_at__isnull=True)
            room_reviews = RoommateProfile.objects.filter(reviewed_by=staff).exclude(reviewed_at__isnull=True)

            approved_count = prop_reviews.filter(status='APPROVED').count() + room_reviews.filter(status='APPROVED').count()
            rejected_count = prop_reviews.filter(status='REJECTED').count() + room_reviews.filter(status='REJECTED').count()

            total_duration = timedelta(0)
            total_reviews = prop_reviews.count() + room_reviews.count()

            for r in prop_reviews:
                if r.reviewed_at and r.created_at:
                    total_duration += (r.reviewed_at - r.created_at)
            for r in room_reviews:
                if r.reviewed_at and r.created_at:
                    total_duration += (r.reviewed_at - r.created_at)

            avg_hours = "N/A"
            if total_reviews > 0:
                avg_td = total_duration / total_reviews
                avg_hours = round(avg_td.total_seconds() / 3600, 1)

            serializer = self.get_serializer(staff)
            staff_data = serializer.data
            staff_data['approved_count'] = approved_count
            staff_data['rejected_count'] = rejected_count
            staff_data['avg_processing_hours'] = avg_hours

            data.append(staff_data)

        return Response(data)


class CreateRazorpayOrderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        amount = request.data.get("amount")
        property_id = request.data.get("property_id")
        plan_name = request.data.get("plan_name", "Listing Fee")

        if not amount:
            return Response({"error": "Amount is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            client = get_razorpay_client()
            user_id_str = str(request.user.id) if (request.user and request.user.is_authenticated) else ""
            order_data = {
                "amount": int(float(amount) * 100),
                "currency": "INR",
                "payment_capture": "1",
                "notes": {
                    "property_id": str(property_id) if property_id else "",
                    "user_id": user_id_str,
                    "plan_name": str(plan_name),
                }
            }
            razorpay_order = client.order.create(data=order_data)

            return Response({
                "order_id": razorpay_order['id'],
                "amount": razorpay_order['amount'],
                "currency": razorpay_order['currency'],
                "razorpay_key": settings.RAZORPAY_KEY_ID
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RazorpayWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        webhook_signature = request.headers.get('X-Razorpay-Signature')
        payload = request.body.decode('utf-8')

        try:
            client = get_razorpay_client()
            client.utility.verify_webhook_signature(
                payload,
                webhook_signature,
                settings.RAZORPAY_WEBHOOK_SECRET
            )

            event_type = request.data.get('event')
            if event_type == 'payment.captured':
                payment_entity = request.data['payload']['payment']['entity']
                notes = payment_entity.get('notes', {})
                property_id = notes.get('property_id')
                user_id = notes.get('user_id')
                plan_name = notes.get('plan_name', 'Standard Plan')
                amount = payment_entity.get('amount', 0) / 100

                if property_id:
                    prop = Property.objects.filter(id=property_id).first()
                    if prop:
                        prop.status = 'PENDING'
                        prop.save()

                if user_id:
                    user = User.objects.filter(id=user_id).first()
                    if user:
                        Purchase.objects.get_or_create(
                            razorpay_payment_id=payment_entity.get('id'),
                            defaults={
                                'user': user,
                                'plan_name': plan_name,
                                'amount': amount,
                                'status': 'SUCCESS',
                            }
                        )

            return Response({"status": "success"}, status=status.HTTP_200_OK)

        except Exception:
            return Response({"error": "Invalid signature"}, status=status.HTTP_400_BAD_REQUEST)


def verify_razorpay_payment(order_id, payment_id, signature):
    """Returns the Razorpay order dict if the signature is genuine, else None."""
    if not (order_id and payment_id and signature):
        return None
    try:
        client = get_razorpay_client()
        client.utility.verify_payment_signature({
            'razorpay_order_id': order_id,
            'razorpay_payment_id': payment_id,
            'razorpay_signature': signature,
        })
        return client.order.fetch(order_id)
    except Exception as e:
        print("Razorpay verification failed:", e)
        return None


class VerifyLocalPaymentView(APIView):
    """
    Called right after the Razorpay checkout succeeds on the website.
    The payment is recorded ONLY if Razorpay's signature checks out, and the amount
    is taken from Razorpay's own order — never from the browser.
    (The webhook below records it too, as a backup, if this call never arrives.)
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        property_id = request.data.get('property_id')
        payment_id = request.data.get('razorpay_payment_id')
        order_id = request.data.get('razorpay_order_id')
        signature = request.data.get('razorpay_signature')

        order = verify_razorpay_payment(order_id, payment_id, signature)
        if not order:
            return Response({'error': 'Payment could not be verified.'}, status=status.HTTP_400_BAD_REQUEST)

        notes = order.get('notes') or {}
        plan_name = notes.get('plan_name') or request.data.get('plan_name') or 'Subscription Plan'
        amount = (order.get('amount_paid') or order.get('amount') or 0) / 100

        if property_id:
            prop = Property.objects.filter(id=property_id, owner=request.user).first()
            if prop and prop.status not in ['APPROVED', 'REJECTED']:
                prop.status = 'PENDING'
                prop.save()

        Purchase.objects.get_or_create(
            razorpay_payment_id=payment_id,
            defaults={'user': request.user, 'plan_name': plan_name, 'amount': amount, 'status': 'SUCCESS'},
        )
        return Response({'status': 'success', 'message': 'Payment verified and recorded successfully'})


class MyPurchasesView(generics.ListAPIView):
    serializer_class = PurchaseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Purchase.objects.filter(user=self.request.user).order_by('-created_at')


class AllPurchasesAdminView(generics.ListAPIView):
    serializer_class = PurchaseSerializer
    permission_classes = [IsSuperAdmin]
    queryset = Purchase.objects.all().order_by('-created_at')
