import os
from django.http import HttpRequest, HttpResponseRedirect, Http404
from django.shortcuts import render, redirect, resolve_url
from sa_util.config import get_shareabouts_config
from sa_util.api import ShareaboutsApi, ShareaboutsApiError, ShareaboutsAuthProviderError
from proxy.views import proxy_view


def login(request: HttpRequest):
    # Load app config settings
    config = get_shareabouts_config()
    api = ShareaboutsApi(config, request)

    api_user = ''
    error_str = ''

    # GET the current user session from the API
    if request.method == 'GET':
        api_user = api.current_user()
        next_url = request.GET.get('next', None)

    # POST a new user session to log in to the API
    elif request.method == 'POST' and request.POST.get('shadowmethod', '').upper() != 'DELETE':
        try:
            api.login(request.POST.get('username'), request.POST.get('password'))
            api_user = api.current_user()
        except ShareaboutsApiError as exc:
            error_str = f'Login failed. {"; ".join(exc.errors.values()) if exc.errors else "Please try again."}'
        next_url = request.POST.get('next', None)

    # DELETE the current user session to log out of the API
    elif request.method == 'POST' and request.POST.get('shadowmethod', '').upper() == 'DELETE':
        try:
            api.logout()
            api_user = api.current_user()
        except ShareaboutsApiError:
            error_str = 'Failed to log out. Please try again.'
        next_url = request.POST.get('next', None)

    if api_user and next_url is not None:
        response = redirect(next_url)

    else:
        response = render(request, 'sa_login.html', {
            'api_user': api_user,
            'errors': error_str,
            'config': config,
            'dataset_root': api.dataset_root,
            'auth_root': api.auth_root,
            'next_url': next_url,
        })

    return api.respond_with_session_cookie(response)


def oauth_begin(request: HttpRequest, provider: str):
    config = get_shareabouts_config()
    api = ShareaboutsApi(config, request)

    try:
        redirect_uri = api.oauth_begin(provider)
    except ShareaboutsAuthProviderError as exc:
        raise Http404(f'OAuth provider error: {exc}')

    response = HttpResponseRedirect(redirect_uri)
    return api.respond_with_session_cookie(response)


def oauth_complete(request: HttpRequest, provider: str):
    config = get_shareabouts_config()
    api = ShareaboutsApi(config, request)

    api_user = ''
    error_str = ''

    try:
        api.oauth_complete(provider, request.GET)
        api_user = api.current_user()
    except ShareaboutsAuthProviderError as exc:
        raise Http404(f'OAuth provider error: {exc}')
    except ShareaboutsApiError as exc:
        print(exc)
        error_str = f'Login failed. {"; ".join(exc.errors.values()) if exc.errors else "Please try again."}'
    next_url = request.GET.get('next', None)

    if api_user and next_url is not None:
        response = redirect(next_url)
    elif api_user:
        response = redirect(resolve_url('admin_home'))

    else:
        response = render(request, 'sa_login.html', {
            'api_user': api_user,
            'errors': error_str,
            'config': config,
            'dataset_root': api.dataset_root,
            'auth_root': api.auth_root,
            'next_url': next_url,
        })

    return api.respond_with_session_cookie(response)
