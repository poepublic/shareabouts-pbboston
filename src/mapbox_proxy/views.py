from proxy.views import proxy_view


def mapbox_json_proxy(request, path):
    return proxy_view(request, f'https://{path}', requests_args={
        'headers': {'Accept': 'application/json', 'Content-Type': 'application/json'}
    })
