import logging

import requests
from django.conf import settings

from trips.exceptions import ExternalServiceError

logger = logging.getLogger(__name__)

_session = requests.Session()
_session.headers.update({"User-Agent": settings.EXTERNAL_HTTP_USER_AGENT})


def get_json(url, params=None, timeout=None, accept_client_errors=False):
    """GET a JSON document. `accept_client_errors` returns 4xx bodies for services that explain failures in JSON."""
    try:
        response = _session.get(url, params=params, timeout=timeout or settings.EXTERNAL_HTTP_TIMEOUT)
        if not (accept_client_errors and 400 <= response.status_code < 500):
            response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("External request failed: %s (%s)", url, exc)
        raise ExternalServiceError() from exc
