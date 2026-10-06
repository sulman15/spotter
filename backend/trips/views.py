from rest_framework.decorators import api_view
from rest_framework.response import Response

from trips.serializers import PlaceSearchSerializer, TripPlanSerializer
from trips.services.geocoding import search_places
from trips.services.trip_planner import plan_trip


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


@api_view(["GET"])
def place_search(request):
    serializer = PlaceSearchSerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    places = search_places(serializer.validated_data["q"])
    return Response({"results": [place.as_dict() for place in places]})


@api_view(["POST"])
def trip_plan(request):
    serializer = TripPlanSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(plan_trip(serializer.validated_data))
