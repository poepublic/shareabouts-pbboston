from django.urls import path, re_path

from . import views
from sa_login import views as login_views


def users_complete(request):
    # Send an email with the request body to the admin. Add the request path to
    # the subject.
    from django.core.mail import send_mail
    from django.conf import settings

    response_body = f'''
    Request Method: {request.method}
    Request Path: {request.path}
    Request Query Params: {request.GET.dict()}
    Request Headers: {request.headers}
    Request Body: {request.body}
    '''

    send_mail(
        f'User Complete Request - ({request.method}) {request.path}',
        response_body,
        settings.EMAIL_ADDRESS,
        ['mjumbewu@gmail.com'],
    )

    from django.http import HttpResponse
    from sa_util.config import get_shareabouts_config
    from sa_util.api import ShareaboutsApi

    config = get_shareabouts_config()
    api = ShareaboutsApi(config, request)

    return api.respond_with_session_cookie(HttpResponse('Sent the email.'))


urlpatterns = [
    re_path(r'^api/(.*)$', views.api, name='api_proxy'),
    # re_path(r'^users/complete/', users_complete, name='users_complete'),
    re_path(r'^users/(.*)$', views.users, name='auth_proxy'),
    re_path('^download/(.*)$.csv', views.csv_download, name='csv_proxy'),
    path('place/<place_id>', views.index, name='place'),
    path('login/', login_views.login, name='login'),
    re_path(r'^', views.index, name='index'),
]
