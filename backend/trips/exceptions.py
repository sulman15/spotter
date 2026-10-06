import logging

from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


class TripPlanningError(APIException):
    """A user-correctable problem, e.g. an address that cannot be found or routed."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = "We couldn't plan this trip."
    default_code = "trip_planning_error"


class ExternalServiceError(APIException):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "A map service is temporarily unavailable. Please try again in a moment."
    default_code = "external_service_error"


def api_exception_handler(exc, context):
    """Return every error as `{"detail": str, "errors"?: {...}}` so the frontend has one shape to render."""
    response = exception_handler(exc, context)

    if response is None:
        logger.exception("Unhandled API error", exc_info=exc)
        return Response(
            {"detail": "Something went wrong on our side. Please try again."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if isinstance(response.data, dict) and "detail" not in response.data:
        response.data = {"detail": "Please fix the highlighted fields.", "errors": response.data}
    return response
