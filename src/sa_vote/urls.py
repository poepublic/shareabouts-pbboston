from django.urls import path

from . import views

urlpatterns = [
    path("verify-code", views.verify_code),
    path("verify-code-test", views.verify_code_test),  # Only available when DEBUG=True
    path("unverify", views.unverify),

    # Any paths not matched by some other explicit patter will fall back to the
    # following rules:
    path("", views.index),
    path("<path:frontend_path>", views.index),
]
