from django.conf.urls import include, url
from django.urls import path
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.contrib import admin
from django.views.i18n import set_language
from sa_login import views as auth_views


admin.autodiscover()

# Uncomment the next two lines to enable the admin:
# from django.contrib import admin
# admin.autodiscover()

# By default, static assets will be served from Django.  It is recommended that
# you use a better suited server instead.  Consult the documentation on serving
# static files with Django for your deploy platform.

urlpatterns = staticfiles_urlpatterns() + [
    # Examples:
    # url(r'^$', 'project.views.home', name='home'),
    # url(r'^project/', include('project.foo.urls')),

    # Uncomment the admin/doc line below to enable admin documentation:
    # url(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
    # url(r'^admin/', include(admin.site.urls)),

    url(r'^choose-language$', set_language, name='set_language'),
    url(r'^login/', include('sa_login.urls')),
    path('users/begin/<provider>', auth_views.oauth_begin, name='oauth_begin'),
    path('users/complete/<provider>', auth_views.oauth_complete, name='oauth_complete'),
    url(r'^admin/', include('sa_admin.urls')),
    url(r'^mapbox/', include('mapbox_proxy.urls')),
    url(r'^', include('sa_web.urls')),
]

from django.conf import settings
if settings.SHAREABOUTS['DATASET_ROOT'].startswith('/'):
    urlpatterns = [
        url(r'^full-api/', include('sa_api_v2.urls')),
    ] + urlpatterns