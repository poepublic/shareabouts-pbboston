import base64
import json
import logging
import mimetypes
import os
from urllib.parse import urlparse
from django.conf import settings
from django.contrib.staticfiles import finders
from django.http import JsonResponse, HttpResponseNotAllowed, HttpResponseForbidden, FileResponse, HttpResponse, HttpResponseNotFound
from django.shortcuts import render, redirect
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt
import frontmatter
import yaml

from sa_util.config import get_shareabouts_config
from sa_util.api import ShareaboutsApi
from .github import GitHubContentManager, GitConflictError
from .translation import GoogleTranslationService

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
                return render(request, 'sa_admin/403.html', {
                    'api': api,
                    'required_group': required_group,
                    'groups': groups,
                }, status=403)

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
            'languages': config.get('languages', []),
        }, status=200)
    except Exception as e:
        logger.exception('Failed to fetch ballot proposals from GitHub')
        return JsonResponse({'error': str(e)}, status=500)


def _prepare_proposal_files(mgr, prop_dict):
    """
    Serializes info.yaml, <lang>.md translation files, and base64 images
    for a proposal dictionary into repo-relative file paths and content.
    Returns: (files_to_update, proposal_meta)
    """
    files_to_update = {}
    slug = prop_dict.get('slug')
    info = prop_dict.get('info')
    translations = prop_dict.get('translations', {})
    images = prop_dict.get('images', [])
    original_slug = prop_dict.get('original_slug')
    is_new = prop_dict.get('is_new', False)

    if slug:
        if info is not None:
            clean_info = {k: v for k, v in info.items() if k != 'last_updated'}
            info_yaml_path = f"{mgr.ballot_folder}/{slug}/info.yaml"
            files_to_update[info_yaml_path] = yaml.dump(clean_info, sort_keys=False)

        for lang, t_data in translations.items():
            md_path = f"{mgr.ballot_folder}/{slug}/{lang}.md"
            content = t_data.get('content', '')
            metadata = {
                'language': t_data.get('language', lang),
                'title': t_data.get('title', ''),
                'image_alt': t_data.get('image_alt', ''),
            }
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

    meta = {
        'slug': slug,
        'original_slug': original_slug,
        'is_new': is_new,
    }
    return files_to_update, meta


@csrf_exempt
@ballot_manager_required
def ballot_proposal_save_api(request, config, api):
    """
    POST /admin/ballot/proposals/save/
    Commits proposal modifications directly to GitHub repository.
    Supports either a single proposal payload or a batch `proposals: [...]` payload.
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

    raw_proposals = body.get('proposals')
    is_batch = raw_proposals is not None
    proposals_list = raw_proposals if is_batch else [body]

    mgr = GitHubContentManager()
    files_to_update = {}
    files_to_delete = list(body.get('files_to_delete', []))
    proposals_meta = []

    for prop_dict in proposals_list:
        p_files, p_meta = _prepare_proposal_files(mgr, prop_dict)
        files_to_update.update(p_files)
        if p_meta.get('slug'):
            proposals_meta.append(p_meta)

    # Any extra arbitrary files in payload
    if body.get('files'):
        for path, content in body['files'].items():
            files_to_update[path] = content

    delete_slug = body.get('delete_slug')
    message = body.get('message')
    if delete_slug and not message:
        message = f"Delete proposal {delete_slug}"

    has_renames = any(p.get('original_slug') and p.get('original_slug') != p.get('slug') for p in proposals_meta)
    if not files_to_update and not files_to_delete and not has_renames and not delete_slug:
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
            original_slug=proposals_meta[0]['original_slug'] if len(proposals_meta) == 1 else None,
            is_new=proposals_meta[0]['is_new'] if len(proposals_meta) == 1 else False,
            message=message,
            slug=delete_slug or (proposals_meta[0]['slug'] if len(proposals_meta) == 1 else None),
            proposals_meta=proposals_meta,
            user_sso_id=user_sso_id,
            user_name=user_name,
            user_email=user_email,
        )
        return JsonResponse(result, status=200)
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
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


@ballot_manager_required
def ballot_image_proxy(request, config, api, filename):
    """
    GET /admin/ballot/images/<filename>
    Serves ballot images to the admin editor.
    First checks local staticfiles on disk (sub-millisecond delivery).
    If not found on disk, fetches from GitHub branch and streams with caching headers.
    """
    if request.method != 'GET':
        return HttpResponseNotAllowed(['GET'])

    clean_filename = os.path.basename(filename)
    if not clean_filename or clean_filename != filename or clean_filename in ('.', '..'):
        return HttpResponseForbidden("Invalid filename")

    content_type, _ = mimetypes.guess_type(clean_filename)
    content_type = content_type or 'application/octet-stream'

    # 1. Check local static files on disk
    local_path = finders.find(f"ballot/{clean_filename}")
    if local_path and os.path.exists(local_path):
        response = FileResponse(open(local_path, 'rb'), content_type=content_type)
        response['Cache-Control'] = 'public, max-age=3600'
        return response

    # 2. Check GitHub repository
    mgr = GitHubContentManager()
    try:
        blob_data = mgr.get_image_blob(clean_filename)
        if blob_data:
            raw_bytes, ct = blob_data
            response = HttpResponse(raw_bytes, content_type=ct or content_type)
            response['Cache-Control'] = 'public, max-age=3600'
            return response
    except Exception as e:
        logger.exception("Error proxying ballot image %s from GitHub: %s", clean_filename, e)
        return JsonResponse({'error': f'Failed to fetch image: {e}'}, status=500)

    return HttpResponseNotFound("Image not found")


@csrf_exempt
@ballot_manager_required
def ballot_translate_api(request, config, api):
    """
    POST /admin/ballot/translate/
    Translates proposal fields (title, content, image_alt) from source to target language
    using Google Cloud Translation API.
    """
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception as e:
        return JsonResponse({'error': f'Invalid JSON payload: {e}'}, status=400)

    target_lang = body.get('target_language')
    if not target_lang or not str(target_lang).strip():
        return JsonResponse({'error': 'Missing required target_language parameter.'}, status=400)

    target_lang = str(target_lang).strip().lower().replace('_', '-')
    source_lang = str(body.get('source_language', 'en')).strip().lower().replace('_', '-')

    # Support either top-level fields (title, content, image_alt) or a texts dict
    texts_to_translate = {}
    if 'texts' in body and isinstance(body['texts'], dict):
        texts_to_translate = {k: str(v) for k, v in body['texts'].items() if v is not None}
    else:
        for field in ('title', 'content', 'image_alt'):
            if field in body and body[field] is not None:
                texts_to_translate[field] = str(body[field])

    if not texts_to_translate:
        return JsonResponse({'error': 'No text provided for translation.'}, status=400)

    translator = GoogleTranslationService()
    try:
        translated = translator.translate_dict(
            texts_to_translate,
            target_language=target_lang,
            source_language=source_lang,
        )
        return JsonResponse({
            'status': 'success',
            'target_language': target_lang,
            'source_language': source_lang,
            'translations': translated,
        }, status=200)
    except ValueError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        logger.exception("Failed to execute translation for %s", target_lang)
        return JsonResponse({'error': f'Translation failed: {e}'}, status=502)


