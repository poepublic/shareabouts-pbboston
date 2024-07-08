from django.urls import path
from . import views


urlpatterns = [
    path('', views.login, name='login'),
    path('begin/<provider>/', views.oauth_begin, name='oauth_begin'),
    path('complete/<provider>/', views.oauth_complete, name='oauth_complete'),
]
