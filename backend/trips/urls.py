from django.urls import path

from trips import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("places/search/", views.place_search, name="place-search"),
    path("trips/plan/", views.trip_plan, name="trip-plan"),
]
