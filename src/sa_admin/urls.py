from django.urls import path
from . import views


urlpatterns = [
    path('', views.admin_home, name='admin_home'),
    path('generate-code', views.admin_generate_code, name='admin_vote_generate_code'),
    path('report/', views.report, name='admin_report'),
    path('detail/<int:place_id>/', views.place_detail, name='admin_detail'),
    path('ballot/', views.ballot_editor, name='admin_ballot_editor'),
    path('ballot/proposals/', views.ballot_proposals_api, name='admin_ballot_proposals'),
    path('ballot/proposals/save/', views.ballot_proposal_save_api, name='admin_ballot_proposal_save'),
    path('ballot/images/<str:filename>', views.ballot_image_proxy, name='admin_ballot_image_proxy'),
    path('ballot/translate/', views.ballot_translate_api, name='admin_ballot_translate'),
]

