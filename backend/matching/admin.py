from django.contrib import admin
from .models import RoommatePlan, Swipe, RoommateRequest, Match, Message

admin.site.register([RoommatePlan, Swipe, RoommateRequest, Match, Message])
