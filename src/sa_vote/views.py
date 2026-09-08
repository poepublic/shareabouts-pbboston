from collections.abc import Callable
from hashlib import sha256
import json
import pathlib

from django.conf import settings
from django.http import Http404, HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import render
from django.utils.translation import get_language
from django.views.decorators.csrf import ensure_csrf_cookie

from sa_util.api import ShareaboutsApi
from sa_util.config import get_shareabouts_config
from pbboston.geodata import load_neighborhoods, load_city
from sa_vote.ballots import Ballot
from sa_web.views import apply_language, calc_adding_support, get_shareabouts_user_token, process_shareabouts_config, show_prelaunch_until_go_live_date


def normalize_phone_number(country_code: str, phone_number: str) -> str:
    """
    Normalize a phone number to a standard E.164 format for comparison.
    """
    cc_digits = ''.join(filter(str.isdigit, country_code))
    pn_digits = ''.join(filter(str.isdigit, phone_number))
    return f'+{cc_digits}{pn_digits}'


def verify_code(request: HttpRequest) -> HttpResponse:
    """
    A view to verify a voter code. Accepts code via POST. If code is valid
    should set the voter_id_hash and voter_verified in the session and return a
    204 response. If code is invalid should return a 404.
    """
    return JsonResponse({'error': 'Not implemented'}, status=501)


def verify_code_test(request: HttpRequest) -> HttpResponse:
    """
    A test view to verify a voter code.
    - Should only be available when `DEBUG=True`.
    - Should accept a `code` query string parameter via GET for simplicity.
    - Should use hard-coded codes for testing:
        - `123456` is a valid code for a user and will get written to the session and return a 204 response
        - Anything else will result in a 404 invalid code
    """
    if not settings.DEBUG:
        raise Http404
    
    code = request.GET.get('code')

    if code is None:
        return JsonResponse({'error': 'Missing "code" parameter'}, status=400)
    elif code == '123456':
        fake_id = normalize_phone_number('1', '555-123-4567')
        fake_id_hash = sha256(fake_id.encode('utf-8')).hexdigest()
        request.session['voter_id_hash'] = fake_id_hash
        request.session['voter_verified'] = True
        return HttpResponse(status=204)
    else:
        return JsonResponse({'error': 'Invalid code'}, status=404)


def unverify(request: HttpRequest) -> HttpResponse:
    """
    A view to unverify a voter.
    - Should remove the voter_id_hash and voter_verified from the session.
    """
    request.session.pop('voter_id_hash', None)
    request.session.pop('voter_verified', None)
    return HttpResponse(status=204)


@ensure_csrf_cookie
@apply_language
@process_shareabouts_config
def submit_ballot(request: HttpRequest) -> HttpResponse:
    """
    Submit a voter's ballot choices.
    Requires an active verified session (voter_verified=True, voter_id_hash present).
    Validates proposals (1-5 valid slugs), checks for upstream duplicates, and
    posts anonymous ballot data to the ballot box place.
    """
    if request.method != 'POST':
        return HttpResponse(status=405)

    if not request.session.get('voter_verified') or not request.session.get('voter_id_hash'):
        return JsonResponse({'error': 'Session is not verified'}, status=403)

    try:
        body = json.loads(request.body.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    if not isinstance(body, dict):
        return JsonResponse({'error': 'Invalid request body; expected JSON object'}, status=400)

    proposals = body.get('proposals')
    if not isinstance(proposals, list) or len(proposals) < 1 or len(proposals) > 5:
        return JsonResponse({'error': 'Must select between 1 and 5 proposals'}, status=400)

    if len(set(proposals)) != len(proposals):
        return JsonResponse({'error': 'Proposals must not contain duplicate selections'}, status=400)

    ballot = Ballot.from_config(request.shareabouts_config, lang=get_language() or 'en')
    valid_slugs = ballot.slugs
    for slug in proposals:
        if not isinstance(slug, str) or slug not in valid_slugs:
            return JsonResponse({'error': f"Invalid proposal slug: '{slug}'"}, status=400)

    ballotbox_id = settings.SHAREABOUTS.get('BALLOTBOX_ID')
    ballotbox_key = settings.SHAREABOUTS.get('BALLOTBOX_KEY')

    if not ballotbox_id or not ballotbox_key:
        return JsonResponse({'error': 'Ballot submission is not configured properly'}, status=500)

    voter_id_hash = request.session['voter_id_hash']
    api = ShareaboutsApi(request.shareabouts_config, request, api_key=ballotbox_key)

    try:
        existing = api.get('ballots', id_hash=voter_id_hash)
    except Exception as exc:
        return JsonResponse({'error': f'Failed to query API server: {exc}'}, status=502)

    if existing and isinstance(existing, dict) and (existing.get('length', 0) > 0 or len(existing.get('results', [])) > 0):
        return JsonResponse({'error': 'A ballot has already been submitted for this voter'}, status=409)

    lang = get_language() or 'en'
    payload = {
        'id_hash': voter_id_hash,
        'lang': lang,
        'anonymous_proposals': proposals,
    }

    try:
        api.create(f'places/{ballotbox_id}/ballots', json=payload)
    except Exception as exc:
        return JsonResponse({'error': 'Failed to submit ballot to upstream server', 'details': str(exc)}, status=502)

    return JsonResponse({'status': 'success', 'message': 'Ballot submitted successfully'}, status=201)


@ensure_csrf_cookie
@apply_language
@process_shareabouts_config
def submit_survey(request: HttpRequest) -> HttpResponse:
    """
    Submit a voter's demographic survey answers.
    Requires an active verified session (voter_verified=True, voter_id_hash present).
    Transforms incoming keys to anonymous_<key>, checks for upstream duplicates,
    posts anonymous survey data to the ballot box place, and invalidates session.
    """
    if request.method != 'POST':
        return HttpResponse(status=405)

    if not request.session.get('voter_verified') or not request.session.get('voter_id_hash'):
        return JsonResponse({'error': 'Session is not verified'}, status=403)

    try:
        body = json.loads(request.body.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    if not isinstance(body, dict):
        return JsonResponse({'error': 'Invalid survey data; expected JSON object'}, status=400)

    ballotbox_id = settings.SHAREABOUTS.get('BALLOTBOX_ID')
    ballotbox_key = settings.SHAREABOUTS.get('BALLOTBOX_KEY')

    if not ballotbox_id or not ballotbox_key:
        return JsonResponse({'error': 'Survey submission is not configured properly'}, status=500)

    voter_id_hash = request.session['voter_id_hash']
    api = ShareaboutsApi(request.shareabouts_config, request, api_key=ballotbox_key)

    try:
        existing = api.get('surveys', id_hash=voter_id_hash)
    except Exception as exc:
        return JsonResponse({'error': f'Failed to query API server: {exc}'}, status=502)

    if existing and isinstance(existing, dict) and (existing.get('length', 0) > 0 or len(existing.get('results', [])) > 0):
        return JsonResponse({'error': 'A survey has already been submitted for this voter'}, status=409)

    lang = get_language() or 'en'
    payload = {
        'id_hash': voter_id_hash,
        'lang': lang,
    }
    for key, value in body.items():
        if key in ('id_hash', 'lang'):
            continue
        target_key = key if key.startswith('anonymous_') else f'anonymous_{key}'
        payload[target_key] = value

    try:
        api.create(f'places/{ballotbox_id}/surveys', json=payload)
    except Exception as exc:
        return JsonResponse({'error': 'Failed to submit survey to upstream server', 'details': str(exc)}, status=502)

    # Invalidate voter session
    request.session.pop('voter_id_hash', None)
    request.session.pop('voter_verified', None)
    return JsonResponse({'status': 'success', 'message': 'Survey submitted successfully'}, status=201)


@ensure_csrf_cookie
@apply_language
@process_shareabouts_config
@show_prelaunch_until_go_live_date
def index(request, frontend_path=None):
    api = ShareaboutsApi(request.shareabouts_config, request)

    # Get the content of the static pages linked in the menu.
    pages_config = request.shareabouts_config.get('pages', [])
    pages_config_json = json.dumps(pages_config)

    # Instead of loading the place (idea) configuration, load
    # the voting configuration and ballot proposals.
    ballot_config = request.shareabouts_config.get('ballot', {})
    assert isinstance(ballot_config, dict), 'Ballot configuration must be a dictionary.'

    ballot_config['adding_supported'] = calc_adding_support(ballot_config.get('adding_supported'))

    # Load the ballot proposals.
    ballot = Ballot.from_config(request.shareabouts_config, lang=get_language())
    ballot_json = ballot.to_json()

    user_token_json = json.dumps(get_shareabouts_user_token(request))

    neighborhoods = load_neighborhoods()
    path_prefix = settings.BASE_URL

    context = {'config': request.shareabouts_config,
               
               'ballot_config': ballot_config,

               'route_prefix': path_prefix + '/vote',
               'api_prefix': path_prefix + '/api',

               'user_token_json': user_token_json,
               'pages_config': pages_config,
               'pages_config_json': pages_config_json,

               'API_ROOT': api.root,
               'DATASET_ROOT': api.dataset_root,

               'api_user': api.current_user(default=None),

               # Geo-data for Boston
               'neighborhoods': neighborhoods,

               # Ballot proposal data
               'ballot_json': ballot_json,

               # Site root useful for automatic translation
               'site_root': settings.SITE_ROOT,
               }

    return api.respond_with_session_cookie(render(request, 'sa_vote/index.html', context))
