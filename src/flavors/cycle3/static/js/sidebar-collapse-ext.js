(function($) {
  $(function() {
    var $body = $('body');

    var $toggleBtn = $('<button id="sidebar-toggle" aria-label="Toggle Sidebar">' +
      '<span class="collapse-icon">🞂</span>' +
      '<span class="expand-icon" style="display: none;">🞀</span>' +
    '</button>');

    $body.append($toggleBtn);

    $toggleBtn.on('click', function() {
      $body.toggleClass('sidebar-collapsed');

      if ($body.hasClass('sidebar-collapsed')) {
        $toggleBtn.find('.collapse-icon').hide();
        $toggleBtn.find('.expand-icon').show();
      } else {
        $toggleBtn.find('.collapse-icon').show();
        $toggleBtn.find('.expand-icon').hide();
      }

      // Invalidate map size after transition to ensure tiles load properly
      setTimeout(function() {
        if (window.app?.appView?.mapView?.map) {
          window.app.appView.mapView.map.invalidateSize();
        }
      }, 350); // 350ms to ensure the 300ms transition completes
    });
  });
})(jQuery);
