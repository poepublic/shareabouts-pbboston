export function useBootstrap() {
  const bootstrap = window.__SA_BOOTSTRAP__ || (window.Shareabouts ? {
    config: window.Shareabouts.Config,
    currentUser: window.Shareabouts.bootstrapped?.currentUser,
    dataset: window.Shareabouts.bootstrapped?.dataset,
    staticUrl: window.Shareabouts.bootstrapped?.staticUrl,
    mapboxToken: window.Shareabouts.bootstrapped?.mapboxToken,
  } : {});

  return {
    config: bootstrap.config || {},
    currentUser: bootstrap.currentUser || {},
    dataset: bootstrap.dataset || '',
    staticUrl: bootstrap.staticUrl || '',
    mapboxToken: bootstrap.mapboxToken || '',
  };
}
