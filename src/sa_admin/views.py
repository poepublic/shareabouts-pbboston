import base64
import json
import logging
from urllib.parse import urlparse
from django.conf import settings
from django.http import JsonResponse, HttpResponseNotAllowed, HttpResponseForbidden
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
            user_dataset_root = (api.dataset_root or '').rstrip('/')
            user_dataset_path = urlparse(user_dataset_root).path.rstrip('/')

            def matches_dataset(group_dataset):
                if not group_dataset or not user_dataset_root:
                    return True
                g_clean = group_dataset.rstrip('/')
                if g_clean == user_dataset_root:
                    return True
                g_path = urlparse(g_clean).path.rstrip('/')
                return bool(g_path and user_dataset_path and g_path == user_dataset_path)

            groups = [
                g.get('name') for g in api_user.get('groups', [])
                if matches_dataset(g.get('dataset'))
            ]

            has_perm = required_group in groups
            if not has_perm:
                if should_return_json:
                    return JsonResponse({'error': 'Unauthorized', 'detail': f'Missing required group: {required_group}'}, status=403)
                return HttpResponseForbidden(
                    f"<h1>403 Forbidden</h1>"
                    f"<p>You are logged in as <strong>{api_user.get('username')}</strong>, but you do not have permission to access the Ballot Content Manager.</p>"
                    f"<p>Required group for this dataset (<em>{api.dataset_root}</em>): <strong>{required_group}</strong>.</p>"
                    f"<p>Your groups on this dataset: {groups if groups else 'None'}.</p>"
                    f"<p><a href='{reverse('admin_home')}'>Return to Admin Dashboard</a></p>"
                )

        return viewfunc(request, config, api, *args, **kwargs)

    return wrapper


def ballot_manager_required(viewfunc):
    """
    Decorator for views requiring ballot management permissions.
    Checks config.ballot.manager_group (defaults to 'admin').
    """
    def wrapper(request, *args, **kwargs):
        config = get_shareabouts_config()

        ballot_config = {}
        if hasattr(config, 'get'):
            ballot_config = config.get('ballot') or {}
        elif hasattr(config, '__getitem__'):
            try:
                ballot_config = config['ballot'] or {}
            except (KeyError, TypeError):
                ballot_config = {}

        manager_group = ballot_config.get('manager_group') or 'admin'

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
def ballot_editor(request, config, api):
    """
    GET /admin/ballot/
    Renders the WYSIWYG Ballot Content Manager Vue application.
    """
    path_prefix = settings.BASE_URL

    return render(request, 'sa_admin/ballot_editor.html', {
        'route_prefix': path_prefix,
        'api_prefix': path_prefix + '/api',
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
    files_to_delete = body.get('files_to_delete', [])
    delete_slug = body.get('delete_slug')
    message = body.get('message')

    if delete_slug and not message:
        message = f"Delete proposal {delete_slug}"

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

    if not files_to_update and not files_to_delete:
        return JsonResponse({'error': 'No files or proposal changes provided to commit.'}, status=400)

    user = api.current_user()
    user_sso_id = user.get('username') or user.get('id')
    user_name = user.get('name') or user.get('first_name')
    user_email = user.get('email')

    try:
        result = mgr.commit_proposal_changes(
            base_sha=base_sha,
            files_to_update=files_to_update,
            files_to_delete=files_to_delete,
            message=message,
            slug=slug or delete_slug,
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
