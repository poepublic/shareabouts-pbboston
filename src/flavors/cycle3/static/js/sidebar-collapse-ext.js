(function() {
  const body = document.body;
  const toggleBtn = document.getElementById('sidebar-toggle');
  const ticker = document.getElementById('ticker');

  toggleBtn.setAttribute('aria-controls', ticker.id);

  function updateSidebarCollapsedState() {
    const isCollapsed = body.classList.contains('sidebar-collapsed');

    ticker.setAttribute('aria-hidden', isCollapsed);
    toggleBtn.setAttribute('aria-expanded', !isCollapsed);
  }

  toggleBtn.addEventListener('click', function() {
    body.classList.toggle('sidebar-collapsed');

    updateSidebarCollapsedState();

    // Invalidate map size after transition to ensure tiles load properly
    setTimeout(function() {
      if (window.app?.appView?.mapView?.map) {
        window.app.appView.mapView.map.invalidateSize();
      }
    }, 350); // 350ms to ensure the 300ms CSS transition completes
  });

  // Initialize the sidebar collapsed state
  updateSidebarCollapsedState();
})();
