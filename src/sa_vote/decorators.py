from collections.abc import Callable
from functools import wraps

from django.core.cache import cache
from django.http import HttpRequest, JsonResponse
from django.utils.translation import gettext as _
from ipware import get_client_ip


def require_voter_session_info(view: Callable) -> Callable:
    @wraps(view)
    def wrapped_view(request: HttpRequest, *args, **kwargs):
        if not request.session.get('voter_id_hash') or not request.session.get('voter_verified'):
            return JsonResponse({'error': 'Voter session information is missing or incomplete.'}, status=403)
        return view(request, *args, **kwargs)
    return wrapped_view


def rate_limit_ip(count: int, period: int, key_prefix: str = 'default') -> Callable:
    """
    Decorator to rate limit view requests by IP address using the Django cache.
    - count: Maximum number of requests allowed within the period.
    - period: Time window in seconds.
    - key_prefix: Key prefix to distinguish between different endpoints or limits.
    """
    def decorator(view: Callable) -> Callable:
        @wraps(view)
        def wrapped_view(request: HttpRequest, *args, **kwargs):
            client_ip, is_routable = get_client_ip(request)
            if not client_ip:
                client_ip = request.META.get('REMOTE_ADDR', 'unknown')

            cache_key = f'ratelimit:{key_prefix}:{client_ip}'

            if cache.add(cache_key, 1, period):
                current = 1
            else:
                try:
                    current = cache.incr(cache_key)
                except ValueError:
                    cache.set(cache_key, 1, period)
                    current = 1

            if current > count:
                ttl_func = getattr(cache, 'ttl', None)
                remaining = None
                if callable(ttl_func):
                    try:
                        remaining = ttl_func(cache_key)
                    except Exception:
                        remaining = None

                wait_seconds = remaining if (remaining is not None and remaining > 0) else period

                response = JsonResponse({
                    'error': _('Too many requests. Please try again later.'),
                    'detail': _('Rate limit exceeded. Try again in %(seconds)s seconds.') % {'seconds': wait_seconds},
                }, status=429)
                response['Retry-After'] = str(wait_seconds)
                return response

            return view(request, *args, **kwargs)
        return wrapped_view
    return decorator

