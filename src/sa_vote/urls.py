from django.urls import path

from . import views

urlpatterns = [
    # The following rule ensures that the index view is used even if the user
    # does not include a trailing slash in the URL:
    path("", views.index),

    # Any paths not matched by some other explicit patter will fall back to the
    # following rule:
    path("<path:frontend_path>", views.index),
]
