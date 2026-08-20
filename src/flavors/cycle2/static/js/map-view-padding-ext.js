// Offset the center of the map to account for the overlay panel

(function () {

  // Override the map's setView method to add padding to the center of the map.
  const Shareabouts_MapView_constructMap = Shareabouts.MapView.prototype.constructMap;
  Shareabouts.MapView.prototype.constructMap = function () {
    const map = Shareabouts_MapView_constructMap.apply(this, arguments);
    const view = this;

    // Override the map's getSize method to add padding to the map.
    // https://github.com/Leaflet/Leaflet/blob/v1.3.4/src/map/Map.js#L856
    map.getSize = function () {
      if (!this._size || this._sizeChanged) {
        this._contentPadding = view.contentPadding();

        this._size = L.point(
          (this._container.clientWidth || 0) - this._contentPadding.x,
          (this._container.clientHeight || 0) - this._contentPadding.y);
  
        this._sizeChanged = false;
      }
      return this._size.clone();
    };

    map.invalidateSize();

    return map;
  }

  Shareabouts.MapView.prototype.contentPadding = function () {
    // If the interface is not in "desktop" mode, don't add any offset.
    if (Shareabouts.Util.getPageLayout() !== 'desktop') {
      return L.point(0, 0);
    }

    // If the content panel is not open, don't add any offset.
    if (!document.body.classList.contains('content-visible')) {
      return L.point(0, 0);
    }

    // Account for the width of the visible content panel.
    const contentPanel = document.getElementById('content');
    const contentPanelWidth = contentPanel.offsetWidth;
    return L.point(contentPanelWidth, 0);
  }
})();