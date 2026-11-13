from datetime import datetime, time, timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from listings.models import Property, Purchase
from .models import Match, Message, RoommatePlan, RoommateRequest, Swipe

PLANS = settings.ROOMMATE_PLANS


# ------------------------------------------------------------------ helpers

def start_of_today():
    now = timezone.localtime()
    return timezone.make_aware(datetime.combine(now.date(), time.min), timezone.get_current_timezone())


def current_plan(user):
    plan = RoommatePlan.objects.filter(user=user).first()
    if not plan:
        return 'free', None
    if plan.plan != 'free' and plan.expires_at and plan.expires_at < timezone.now():
        plan.plan, plan.expires_at = 'free', None
        plan.save(update_fields=['plan', 'expires_at', 'updated_at'])
    return plan.plan, plan.expires_at


def quota_for(user):
    plan, expires = current_plan(user)
    used = Swipe.objects.filter(swiper=user, created_at__gte=start_of_today()).count()
    return {
        'plan': plan,
        'plan_expires_at': expires,
        'used': used,
        'limit': PLANS[plan]['daily_swipes'],
        'resets_at': start_of_today() + timedelta(days=1),
    }


def matched_user_ids(user):
    ids = set()
    for a, b in Match.objects.filter(Q(user_a=user) | Q(user_b=user)).values_list('user_a_id', 'user_b_id'):
        ids.add(b if a == user.id else a)
    return ids


def listing_card(prop, viewer=None, reveal_phone=False):
    owner = prop.owner
    profile = getattr(owner, 'profile', None)
    images = [i.image_url for i in prop.images.all() if not i.is_video and 'placehold.co' not in (i.image_url or '')]
    tags = [a.name for a in prop.amenities.all()]
    return {
        'id': prop.id,
        'user_id': owner.id,
        'name': prop.owner_name or owner.first_name or prop.title,
        'age': getattr(profile, 'age', None),
        'gender': getattr(profile, 'gender', None),
        'occupation': None,
        'city': prop.city or '',
        'locality': prop.area or prop.city or '',
        'budget': prop.rent,
        'move_in_date': prop.sharing_status or None,
        'bio': prop.description or prop.title,
        'tags': tags,
        'photos': images,
        'has_property': prop.sharing_status == 'Living in',
        'verified': prop.status == 'APPROVED',
        'phone': (prop.phone_primary or getattr(profile, 'phone_number', None)) if reveal_phone else None,
    }


def user_card(user, reveal_phone=False):
    """Best card for a person: their newest roommate listing, else their basic account details."""
    mine = Property.objects.filter(owner=user, property_type='ROOMMATE').prefetch_related('images', 'amenities')
    prop = mine.filter(status='APPROVED').order_by('-created_at').first() or mine.order_by('-created_at').first()
    if prop:
        return listing_card(prop, reveal_phone=reveal_phone)
    profile = getattr(user, 'profile', None)
    return {
        'id': f'user-{user.id}', 'user_id': user.id,
        'name': user.first_name or user.username.split('@')[0],
        'age': getattr(profile, 'age', None), 'gender': getattr(profile, 'gender', None),
        'occupation': None, 'city': '', 'locality': '', 'budget': 0, 'move_in_date': None,
        'bio': '', 'tags': [], 'photos': [], 'has_property': False, 'verified': False,
        'phone': getattr(profile, 'phone_number', None) if reveal_phone else None,
    }


def chat_allowed_match_ids(user):
    plan, _ = current_plan(user)
    limit = PLANS[plan]['chat_limit']
    qs = Match.objects.filter(Q(user_a=user) | Q(user_b=user)).order_by('created_at').values_list('id', flat=True)
    return None if limit is None else set(list(qs)[:limit])


def match_payload(match, user):
    other = match.other(user)
    last = match.messages.order_by('-created_at').first()
    return {
        'id': match.id,
        'created_at': match.created_at,
        'profile': user_card(other, reveal_phone=True),  # phone numbers unlock once you match
        'last_message': last.text if last else None,
        'last_message_at': last.created_at if last else match.created_at,
        'unread': match.messages.filter(read_at__isnull=True).exclude(sender=user).count(),
    }


def create_match(u1, u2):
    a, b = Match.pair(u1, u2)
    match, _ = Match.objects.get_or_create(user_a=a, user_b=b)
    return match


# ------------------------------------------------------------------ views

class QuotaView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(quota_for(request.user))


class DeckView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        me = request.user
        swiped = Swipe.objects.filter(swiper=me).values_list('target_id', flat=True)
        hide_owners = matched_user_ids(me)
        hide_owners |= set(RoommateRequest.objects.filter(to_user=me, status='PENDING').values_list('from_user_id', flat=True))
        hide_owners |= set(RoommateRequest.objects.filter(from_user=me).values_list('to_user_id', flat=True))
        qs = (
            Property.objects.filter(property_type='ROOMMATE', status='APPROVED')
            .exclude(owner=me).exclude(id__in=swiped).exclude(owner_id__in=hide_owners)
            .select_related('owner', 'owner__profile').prefetch_related('images', 'amenities')
            .order_by('-created_at')[:60]
        )
        return Response([listing_card(p) for p in qs])


class SwipeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        me = request.user
        direction = request.data.get('direction')
        if direction not in ('left', 'right'):
            return Response({'error': 'direction must be left or right'}, status=400)
        target = get_object_or_404(Property, pk=request.data.get('target_id'), property_type='ROOMMATE', status='APPROVED')
        if target.owner_id == me.id:
            return Response({'error': "You can't swipe on your own listing."}, status=400)

        q = quota_for(me)
        if q['limit'] is not None and q['used'] >= q['limit']:
            return Response({'error': 'Daily swipe limit reached', 'quota': q}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        try:
            with transaction.atomic():  # savepoint, so a duplicate swipe doesn't break the request
                Swipe.objects.create(swiper=me, target=target, direction=direction)
        except IntegrityError:
            return Response({'status': 'skipped', 'quota': quota_for(me)})

        if direction == 'left':
            return Response({'status': 'skipped', 'quota': quota_for(me)})

        other = target.owner
        # Did they already want to live with me? (pending request to me, or a right swipe on one of my listings)
        their_request = RoommateRequest.objects.filter(from_user=other, to_user=me, status='PENDING').first()
        they_liked_me = their_request or Swipe.objects.filter(swiper=other, target__owner=me, direction='right').exists()
        if they_liked_me:
            if their_request:
                their_request.status = 'ACCEPTED'
                their_request.responded_at = timezone.now()
                their_request.save()
            match = create_match(me, other)
            return Response({'status': 'matched', 'match': match_payload(match, me), 'quota': quota_for(me)})

        RoommateRequest.objects.get_or_create(from_user=me, to_user=other, defaults={'listing': target})
        return Response({'status': 'requested', 'quota': quota_for(me)})


class UndoSwipeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        me = request.user
        plan, _ = current_plan(me)
        if plan != 'premium':
            return Response({'error': 'Undo is a Premium feature.'}, status=403)
        swipe = Swipe.objects.filter(swiper=me, target_id=request.data.get('target_id')).first()
        if swipe:
            RoommateRequest.objects.filter(from_user=me, to_user=swipe.target.owner, status='PENDING').delete()
            swipe.delete()
        return Response({'quota': quota_for(me)})


class RequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        me = request.user
        if request.query_params.get('box') == 'sent':
            qs = RoommateRequest.objects.filter(from_user=me).select_related('to_user').order_by('-created_at')
            data = [{'id': r.id, 'status': r.status, 'created_at': r.created_at, 'profile': user_card(r.to_user)} for r in qs]
        else:
            qs = RoommateRequest.objects.filter(to_user=me, status='PENDING').select_related('from_user').order_by('-created_at')
            data = [{'id': r.id, 'status': r.status, 'created_at': r.created_at, 'profile': user_card(r.from_user)} for r in qs]
        return Response(data)


class RespondRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, decision):
        if decision not in ('accept', 'decline'):
            return Response({'error': 'Unknown action'}, status=404)
        req = get_object_or_404(RoommateRequest, pk=pk, to_user=request.user, status='PENDING')
        req.responded_at = timezone.now()
        if decision == 'accept':
            req.status = 'ACCEPTED'
            req.save()
            match = create_match(request.user, req.from_user)
            return Response({'match': match_payload(match, request.user)})
        req.status = 'DECLINED'
        req.save()
        return Response({})


class MatchesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        me = request.user
        matches = Match.objects.filter(Q(user_a=me) | Q(user_b=me)).select_related('user_a', 'user_b')
        data = [match_payload(m, me) for m in matches]
        data.sort(key=lambda m: m['last_message_at'] or m['created_at'], reverse=True)
        return Response(data)


class MessagesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _match(self, request, pk):
        me = request.user
        match = get_object_or_404(Match.objects.filter(Q(user_a=me) | Q(user_b=me)), pk=pk)
        allowed = chat_allowed_match_ids(me)
        if allowed is not None and match.id not in allowed:
            return None
        return match

    def get(self, request, pk):
        match = self._match(request, pk)
        if not match:
            return Response({'error': 'Upgrade your plan to chat with more matches.'}, status=403)
        match.messages.filter(read_at__isnull=True).exclude(sender=request.user).update(read_at=timezone.now())
        return Response([
            {'id': m.id, 'text': m.text, 'created_at': m.created_at, 'is_mine': m.sender_id == request.user.id}
            for m in match.messages.all()
        ])

    def post(self, request, pk):
        match = self._match(request, pk)
        if not match:
            return Response({'error': 'Upgrade your plan to chat with more matches.'}, status=403)
        text = str(request.data.get('text', '')).strip()[:1000]
        if not text:
            return Response({'error': 'Message is empty.'}, status=400)
        m = Message.objects.create(match=match, sender=request.user, text=text)
        return Response({'id': m.id, 'text': m.text, 'created_at': m.created_at, 'is_mine': True}, status=201)


class ActivatePlanView(APIView):
    """Upgrades only after Razorpay confirms the payment and the amount matches the plan price."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from listings.views import verify_razorpay_payment

        plan = request.data.get('plan')
        if plan not in ('basic', 'premium'):
            return Response({'error': 'Unknown plan'}, status=400)
        payment_id = request.data.get('razorpay_payment_id')
        order = verify_razorpay_payment(request.data.get('razorpay_order_id'), payment_id, request.data.get('razorpay_signature'))
        if not order:
            return Response({'error': 'Payment could not be verified.'}, status=400)
        paid = (order.get('amount_paid') or order.get('amount') or 0) / 100
        if paid < PLANS[plan]['price']:
            return Response({'error': 'Amount paid does not match the plan price.'}, status=400)
        if Purchase.objects.filter(razorpay_payment_id=payment_id).exclude(user=request.user).exists():
            return Response({'error': 'This payment belongs to another account.'}, status=400)

        obj, _ = RoommatePlan.objects.get_or_create(user=request.user)
        start = obj.expires_at if (obj.plan == plan and obj.expires_at and obj.expires_at > timezone.now()) else timezone.now()
        obj.plan = plan
        obj.expires_at = start + timedelta(days=30)
        obj.save()
        Purchase.objects.get_or_create(
            razorpay_payment_id=payment_id,
            defaults={'user': request.user, 'plan_name': f'Roommate {plan.capitalize()}', 'amount': paid, 'status': 'SUCCESS'},
        )
        return Response({'quota': quota_for(request.user)})
