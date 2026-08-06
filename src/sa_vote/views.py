import json

from django.conf import settings
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie

from sa_util.api import ShareaboutsApi
from sa_util.config import get_shareabouts_config
from pbboston.geodata import load_neighborhoods, load_city
from sa_web.views import apply_language, calc_adding_support, get_shareabouts_user_token, process_shareabouts_config, show_prelaunch_until_go_live_date


# Create your views here.
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

    user_token_json = json.dumps(get_shareabouts_user_token(request))

    neighborhoods = load_neighborhoods()
    path_prefix = settings.BASE_URL

    context = {'config': request.shareabouts_config,

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

               # Site root useful for automatic translation
               'site_root': settings.SITE_ROOT,
               }

    return api.respond_with_session_cookie(render(request, 'sa_vote/index.html', context))
