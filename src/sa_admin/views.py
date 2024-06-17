from django.shortcuts import render, redirect
from django.urls import reverse
from sa_util.config import get_shareabouts_config
from sa_util.api import ShareaboutsApi


def admin_home(request):
    config = get_shareabouts_config()
    api = ShareaboutsApi(config, request)

    api_user = api.current_user()
    if not api_user:
        return redirect(reverse('login') + '?next=' + request.path)

    return render(request, 'sa_admin/dashboard.html', {
        'api': api,
        'config': config,
    })


def place_detail(request, place_id):
    return render(request, 'sa_admin/place_detail.html', {'place_id': place_id})
