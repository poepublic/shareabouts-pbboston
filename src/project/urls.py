from django.urls import include, path
from django.conf import settings
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.contrib import admin
from django.views.i18n import set_language
from sa_login import views as auth_views



admin.autodiscover()

urlpatterns = staticfiles_urlpatterns() + [
    path('choose-language', set_language, name='set_language'),
    path('login/', include('sa_login.urls')),
    path('users/begin/<provider>', auth_views.oauth_begin, name='oauth_begin'),
    path('users/complete/<provider>', auth_views.oauth_complete, name='oauth_complete'),
    path('admin/', include('sa_admin.urls')),
    path('mapbox/', include('mapbox_proxy.urls')),
    path('', include('sa_web.urls')),
]

if settings.SHAREABOUTS['DATASET_ROOT'].startswith('/'):
    urlpatterns = [
        path('full-api/', include('sa_api_v2.urls')),
    ] + urlpatterns
