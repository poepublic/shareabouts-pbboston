from django.urls import path
from . import views
from sa_vote import views as vote_views


urlpatterns = [
    path('', views.admin_home, name='admin_home'),
    path('generate-code', vote_views.admin_generate_code, name='admin_vote_generate_code'),
    path('detail/<int:place_id>/', views.place_detail, name='admin_detail'),
]
