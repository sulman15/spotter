from datetime import datetime, time

from rest_framework import serializers

DEFAULT_START_TIME = time(8, 0)


class PlaceSearchSerializer(serializers.Serializer):
    q = serializers.CharField(min_length=2, max_length=200, trim_whitespace=True)


class LocationSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=300, trim_whitespace=True)
    short_label = serializers.CharField(max_length=200, required=False, allow_blank=True)
    lat = serializers.FloatField(required=False, allow_null=True, min_value=-90, max_value=90)
    lon = serializers.FloatField(required=False, allow_null=True, min_value=-180, max_value=180)


class TripPlanSerializer(serializers.Serializer):
    current_location = LocationSerializer()
    pickup_location = LocationSerializer()
    dropoff_location = LocationSerializer()
    current_cycle_used = serializers.FloatField(min_value=0, max_value=70)
    start_time = serializers.DateTimeField(required=False, input_formats=["%Y-%m-%dT%H:%M", "iso-8601"])

    def validate_start_time(self, value):
        # Logs are kept in home-terminal time, so any timezone info from the client is dropped.
        return value.replace(tzinfo=None, second=0, microsecond=0)

    def validate(self, attrs):
        attrs.setdefault("start_time", datetime.combine(datetime.now().date(), DEFAULT_START_TIME))
        return attrs
