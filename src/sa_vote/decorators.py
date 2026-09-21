from collections.abc import Callable

from django.http import HttpRequest, JsonResponse


def require_voter_session_info(view: Callable) -> Callable:
    def wrapped_view(request: HttpRequest, *args, **kwargs):
        if not request.session.get('voter_id_hash') or not request.session.get('voter_verified'):
            return JsonResponse({'error': 'Voter session information is missing or incomplete.'}, status=403)
        return view(request, *args, **kwargs)
    return wrapped_view
