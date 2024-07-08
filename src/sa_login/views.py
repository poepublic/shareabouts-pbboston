import os
from django.http import HttpRequest, HttpResponseRedirect, Http404
from django.shortcuts import render, redirect
from sa_util.config import get_shareabouts_config
from sa_util.api import ShareaboutsApi, ShareaboutsApiError, ShareaboutsAuthProviderError
from proxy.views import proxy_view


def login(request: HttpRequest):
    # Load app config settings
    config = get_shareabouts_config()
    api = ShareaboutsApi(config, request)

    api_cookie = ''
    api_user = ''
    error_str = ''

    # GET the current user session from the API
    if request.method == 'GET':
        api_user = api.current_user()
        api_cookie = api.sessionid
        next_url = request.GET.get('next', None)

    # POST a new user session to log in to the API
    elif request.method == 'POST' and request.POST.get('shadowmethod', '').upper() != 'DELETE':
        try:
            api.login(request.POST.get('username'), request.POST.get('password'))
            api_user = api.current_user()
            api_cookie = api.sessionid
        except ShareaboutsApiError as exc:
            error_str = f'Login failed. {"; ".join(exc.errors.values()) if exc.errors else "Please try again."}'
        next_url = request.POST.get('next', None)

    # DELETE the current user session to log out of the API
    elif request.method == 'POST' and request.POST.get('shadowmethod', '').upper() == 'DELETE':
        try:
            api.logout()
            api_user = api.current_user()
            api_cookie = api.sessionid
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

    if api_cookie:
        response.set_cookie('sa-api-sessionid', api_cookie)
    else:
        response.delete_cookie('sa-api-sessionid')

    return response


def oauth_begin(request: HttpRequest, provider: str):
    config = get_shareabouts_config()
    api = ShareaboutsApi(config, request)

    try:
        redirect_uri = api.oauth_begin(provider)
    except ShareaboutsAuthProviderError as exc:
        raise Http404(f'OAuth provider error: {exc}')

    return HttpResponseRedirect(redirect_uri)


def oauth_complete(request: HttpRequest, provider: str):
    config = get_shareabouts_config()
    api = ShareaboutsApi(config, request)

    api_cookie = ''
    api_user = ''
    error_str = ''

    try:
        api.oauth_complete(provider, request.GET)
        api_user = api.current_user()
        api_cookie = api.sessionid
    except ShareaboutsAuthProviderError as exc:
        raise Http404(f'OAuth provider error: {exc}')
    except ShareaboutsApiError as exc:
        error_str = f'Login failed. {"; ".join(exc.errors.values()) if exc.errors else "Please try again."}'
    next_url = request.GET.get('next', None)

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

    if api_cookie:
        response.set_cookie('sa-api-sessionid', api_cookie)
    else:
        response.delete_cookie('sa-api-sessionid')

    return response
