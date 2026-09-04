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


def init_voter_verification_session(view_func: Callable[..., HttpResponse]) -> Callable[..., HttpResponse]:
    """
    A decorator to ensure that the session has the voter_id_hash and voter_verified keys.
    If they are not present, they will be initialized to None and False respectively.
    """
    def wrapped_view(request: HttpRequest, *args, **kwargs):
        if 'voter_id_hash' not in request.session:
            request.session['voter_id_hash'] = None
        if 'voter_verified' not in request.session:
            request.session['voter_verified'] = False
        return view_func(request, *args, **kwargs)
    return wrapped_view


@init_voter_verification_session
def verify_code(request: HttpRequest) -> HttpResponse:
    """
    A view to verify a voter code. Accepts code via POST. If code is valid
    should set the voter_id_hash and voter_verified in the session and return a
    204 response. If code is invalid should return a 404.
    """
    return JsonResponse({'error': 'Not implemented'}, status=501)


@init_voter_verification_session
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
    request.session['voter_id_hash'] = None
    request.session['voter_verified'] = False
    return HttpResponse(status=204)


@ensure_csrf_cookie
@apply_language
@process_shareabouts_config
@show_prelaunch_until_go_live_date
@init_voter_verification_session
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

    # Load the ballot proposals. The proposal director should, by default, be in
    # the "ballot" directory in the shareabouts flavor, but that can be
    # overridden with the ballot.proposals_folder configuration option, which
    # will be a path relative to the shareabouts flavor directory. Note that
    # this can be set via the SHAREABOUTS__BALLOT__PROPOSALS_FOLDER environment
    # variable as well.
    flavor_dir = pathlib.Path(settings.SHAREABOUTS['CONFIG'])
    proposals_dir = flavor_dir / ballot_config.get('proposals_folder', 'ballot')
    ballot = Ballot.from_directory(proposals_dir, lang=get_language())
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
