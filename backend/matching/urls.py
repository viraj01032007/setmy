from django.urls import path
from . import views

urlpatterns = [
    path('roommates/quota/', views.QuotaView.as_view()),
    path('roommates/deck/', views.DeckView.as_view()),
    path('roommates/swipe/', views.SwipeView.as_view()),
    path('roommates/swipe/undo/', views.UndoSwipeView.as_view()),
    path('roommates/requests/', views.RequestsView.as_view()),
    path('roommates/requests/<int:pk>/<str:decision>/', views.RespondRequestView.as_view()),
    path('roommates/matches/', views.MatchesView.as_view()),
    path('roommates/matches/<int:pk>/messages/', views.MessagesView.as_view()),
    path('roommates/plan/activate/', views.ActivatePlanView.as_view()),
]
