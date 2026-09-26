import base64
import json
import logging
from django.conf import settings
from django.http import JsonResponse, HttpResponseNotAllowed
from django.shortcuts import render, redirect
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt
import frontmatter
import yaml

from sa_util.config import get_shareabouts_config
from sa_util.api import ShareaboutsApi
from .github import GitHubContentManager, GitConflictError

logger = logging.getLogger(__name__)


def shareabouts_loggedin(viewfunc, required_group=None):
    def wrapper(request, *args, **kwargs):
        config = get_shareabouts_config()
        api = ShareaboutsApi(config, request)

        should_return_json = request.headers.get('Accept') == 'application/json' or request.content_type == 'application/json'

        api_user = api.current_user()
        if not api_user:
            if should_return_json:
                return JsonResponse({'error': 'Unauthenticated'}, status=401)
            return redirect(reverse('login') + '?next=' + request.path)

        if required_group:
            groups = [
                g['name'] for g in api_user.get('groups', [])
                if g.get('dataset') == api.dataset_root
            ]
            if required_group not in groups:
                if should_return_json:
                    return JsonResponse({'error': 'Unauthorized'}, status=403)
                return redirect(reverse('login') + '?next=' + request.path)

        return viewfunc(request, config, api, *args, **kwargs)

    return wrapper


def ballot_manager_required(viewfunc):
    """
    Decorator for views requiring ballot management permissions.
    Checks config.ballot.manager_group (defaults to 'admin').
    """
    def wrapper(request, *args, **kwargs):
        config = get_shareabouts_config()

        ballot_config = config.get('ballot', {}) if hasattr(config, 'get') else {}
        manager_group = ballot_config.get('manager_group', 'ballot_manager')

        return shareabouts_loggedin(viewfunc, required_group=manager_group)(request, *args, **kwargs)
    return wrapper


@shareabouts_loggedin
def admin_home(request, config, api):
    path_prefix = settings.BASE_URL

    return render(request, 'sa_admin/dashboard.html', {
        'route_prefix': path_prefix,
        'api_prefix': path_prefix + '/api',
        'api': api,
        'config': config,
    })


@shareabouts_loggedin
def report(request, config, api):
    path_prefix = settings.BASE_URL

    return render(request, 'sa_admin/report.html', {
        'route_prefix': path_prefix,
        'api_prefix': path_prefix + '/api',
        'api': api,
        'config': config,
    })


@shareabouts_loggedin
def place_detail(request, config, api, place_id):
    path_prefix = settings.BASE_URL

    return render(request, 'sa_admin/place_detail.html', {
        'route_prefix': path_prefix,
        'api_prefix': path_prefix + '/api',
        'place_id': place_id,
        'api': api,
        'config': config,
    })


@ballot_manager_required
def ballot_proposals_api(request, config, api):
    """
    GET /admin/ballot/proposals/
    Returns current state of ballot proposals from GitHub.
    """
    if request.method != 'GET':
        return HttpResponseNotAllowed(['GET'])

    mgr = GitHubContentManager()
    try:
        state = mgr.get_ballot_state()
        return JsonResponse({
            'status': 'success',
            'head_sha': state['head_sha'],
            'tree_sha': state['tree_sha'],
            'proposals': state['proposals'],
            'files': state['files'],
        }, status=200)
    except Exception as e:
        logger.exception('Failed to fetch ballot proposals from GitHub')
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@ballot_manager_required
def ballot_proposal_save_api(request, config, api):
    """
    POST /admin/ballot/proposals/save/
    Commits proposal modifications directly to GitHub repository.
    """
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception as e:
        return JsonResponse({'error': f'Invalid JSON payload: {e}'}, status=400)

    base_sha = body.get('base_sha')
    if not base_sha:
        return JsonResponse({'error': 'Missing required base_sha field.'}, status=400)

    slug = body.get('slug')
    info = body.get('info')
    translations = body.get('translations', {})
    files = body.get('files', {})
    images = body.get('images', [])
    message = body.get('message')

    mgr = GitHubContentManager()
    files_to_update = {}

    if slug:
        if info is not None:
            info_yaml_path = f"{mgr.ballot_folder}/{slug}/info.yaml"
            files_to_update[info_yaml_path] = yaml.dump(info, sort_keys=False)

        for lang, t_data in translations.items():
            md_path = f"{mgr.ballot_folder}/{slug}/{lang}.md"
            content = t_data.get('content', '')
            metadata = {
                'language': t_data.get('language', lang),
                'title': t_data.get('title', ''),
                'image_alt': t_data.get('image_alt', ''),
            }
            if 'last_updated' in t_data and t_data['last_updated']:
                metadata['last_updated'] = t_data['last_updated']
            post = frontmatter.Post(content, **metadata)
            files_to_update[md_path] = frontmatter.dumps(post) + "\n"

        for img in images:
            filename = img.get('filename')
            b64_content = img.get('content_base64', '')
            if filename and b64_content:
                if ',' in b64_content:
                    b64_content = b64_content.split(',', 1)[1]
                img_bytes = base64.b64decode(b64_content)
                img_path = f"{mgr.static_ballot_folder}/{filename}"
                files_to_update[img_path] = img_bytes

    if files:
        for path, content in files.items():
            files_to_update[path] = content

    if not files_to_update:
        return JsonResponse({'error': 'No files or proposal changes provided to commit.'}, status=400)

    user = api.current_user()
    user_sso_id = user.get('username') or user.get('id')
    user_name = user.get('name') or user.get('first_name')
    user_email = user.get('email')

    try:
        result = mgr.commit_proposal_changes(
            base_sha=base_sha,
            files_to_update=files_to_update,
            message=message,
            slug=slug,
            user_sso_id=user_sso_id,
            user_name=user_name,
            user_email=user_email,
        )
        return JsonResponse(result, status=200)
    except GitConflictError as e:
        return JsonResponse({
            'error': 'conflict',
            'message': str(e),
            'head_sha': e.head_sha,
            'tree_sha': e.tree_sha,
            'conflicting_files': e.conflicting_files,
        }, status=409)
    except Exception as e:
        logger.exception('Failed to commit proposal changes')
        return JsonResponse({'error': str(e)}, status=500)
