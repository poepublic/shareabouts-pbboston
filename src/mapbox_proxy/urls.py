from django.urls import path
from . import views


urlpatterns = [
    path('json/<path:path>', views.mapbox_json_proxy),
]
