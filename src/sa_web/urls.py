from django.conf.urls import url
from . import views
from sa_login import views as login_views

# Uncomment the next two lines to enable the admin:
# from django.contrib import admin
# admin.autodiscover()


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
    return HttpResponse('Sent the email.')


urlpatterns = [
    # Examples:
    # url(r'^$', 'project.views.home', name='home'),
    # url(r'^project/', include('project.foo.urls')),

    # Uncomment the admin/doc line below to enable admin documentation:
    # url(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
    # url(r'^admin/', include(admin.site.urls)),

    url(r'^api/(.*)$', views.api, name='api_proxy'),
    url(r'^users/complete/', users_complete, name='users_complete'),
    url(r'^users/(.*)$', views.users, name='auth_proxy'),
    url(r'^download/(.*).csv$', views.csv_download, name='csv_proxy'),
    url(r'^place/(?P<place_id>[^/]+)$', views.index, name='place'),
    url(r'^login/$', login_views.login, name='login'),
    url(r'^', views.index, name='index'),
]
