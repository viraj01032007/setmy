"""
Roommate Match (Tinder-style).

Cards in the deck are approved roommate listings (listings.Property with property_type=ROOMMATE).
Swiping right on a card sends a RoommateRequest to that listing's owner. When the owner accepts
(or had already swiped right on one of your roommate listings) a Match is created and chat unlocks.
"""
from django.contrib.auth.models import User
from django.db import models


class RoommatePlan(models.Model):
    PLANS = [('free', 'Free'), ('basic', 'Basic'), ('premium', 'Premium')]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='roommate_plan')
    plan = models.CharField(max_length=10, choices=PLANS, default='free')
    expires_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}: {self.plan}"


class Swipe(models.Model):
    swiper = models.ForeignKey(User, on_delete=models.CASCADE, related_name='swipes')
    target = models.ForeignKey('listings.Property', on_delete=models.CASCADE, related_name='swipes')
    direction = models.CharField(max_length=5, choices=[('left', 'Left'), ('right', 'Right')])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('swiper', 'target')
        indexes = [models.Index(fields=['swiper', 'created_at'], name='matching_sw_swiper__idx')]


class RoommateRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        DECLINED = 'DECLINED', 'Declined'

    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_roommate_requests')
    to_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_roommate_requests')
    listing = models.ForeignKey('listings.Property', on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('from_user', 'to_user')


class Match(models.Model):
    user_a = models.ForeignKey(User, on_delete=models.CASCADE, related_name='matches_as_a')
    user_b = models.ForeignKey(User, on_delete=models.CASCADE, related_name='matches_as_b')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user_a', 'user_b')

    def other(self, user):
        return self.user_b if self.user_a_id == user.id else self.user_a

    @staticmethod
    def pair(u1, u2):
        """Always store the smaller id first so a pair can only exist once."""
        return (u1, u2) if u1.id < u2.id else (u2, u1)


class Message(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']
