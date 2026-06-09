// Building footprint overlay for City Hall. This is used to give users more information about citywide ideas.
// When clicked, the map will zoom in on the building and reveal a popup with information about citywide ideas,
// including how they are displayed and where to read more about them.
// The building footprint geojson is derived from the building footprints published by the City of Boston.


(function () {
  const original_AppView_initialize = Shareabouts.AppView.prototype.initialize;
  Shareabouts.AppView.prototype.initialize = function () {
    const result = original_AppView_initialize.call(this, ...arguments);
    this.initCityHallOverlay();
    return result;
  };

  Shareabouts.AppView.prototype.initCityHallOverlay = function () {
    const map = this.mapView.map;
    const mapContainer = document.getElementById('map-container');

    const pane = map.createPane('cityHallPane');
    pane.style.zIndex = 450;

    const popup = document.createElement('div');
    popup.className = 'city-hall-popup';
    popup.innerHTML = Handlebars.templates['city-hall-info']();
    popup.style.display = 'none';
    mapContainer.appendChild(popup);

    popup.querySelector('.city-hall-popup-close').addEventListener('click', evt => {
      evt.stopPropagation();
      closePopup();
    });
    
    const computedStyles = getComputedStyle(document.documentElement);
    const colorFill  = computedStyles.getPropertyValue('--iia-urban-pink-alt').trim();

    const styleRest  = { fillColor: colorFill,  color: colorFill,  fillOpacity: 0.5, weight: 2 };
    const styleHover = { fillColor: colorFill, color: colorFill, fillOpacity: 0.9, weight: 2 };

    let featureLayer = null;
    let centroid = null;
    let isOpen = false;

    function updatePopupPosition() {
      if (!centroid) return;
      const pt = map.latLngToContainerPoint(centroid);
      popup.style.left = pt.x + 'px';
      popup.style.top = pt.y + 'px';
    }

    function openPopup() {
      isOpen = true;
      popup.style.display = 'block';
      updatePopupPosition();
      if (featureLayer) {
        featureLayer.setStyle(styleRest);
        featureLayer.getElement().classList.add('is-active');
      }
    }

    function closePopup() {
      isOpen = false;
      popup.style.display = 'none';
      if (featureLayer) {
        featureLayer.getElement().classList.remove('is-active');
      }
    }

    map.on('move zoom', () => {
      if (isOpen) updatePopupPosition();
    });

    const svgRenderer = L.svg({ pane: 'cityHallPane' });

    const geojsonUrl = Shareabouts.bootstrapped.staticUrl + 'data/boston_city_hall.geojson';
    fetch(geojsonUrl)
      .then(r => r.json())
      .then(data => {
        L.geoJSON(data, {
          pane: 'cityHallPane',
          renderer: svgRenderer,
          style: { ...styleRest, className: 'city-hall-footprint' },
          onEachFeature: (feature, layer) => {
            featureLayer = layer;
            centroid = layer.getBounds().getCenter();

            let mouseoutTimer = null;

            layer.on('mouseover', () => {
              clearTimeout(mouseoutTimer);
              mouseoutTimer = null;
              layer.setStyle(styleHover);
              layer.getElement().classList.add('is-hover');
            });

            layer.on('mouseout', () => {
              mouseoutTimer = setTimeout(() => {
                mouseoutTimer = null;
                layer.getElement().classList.remove('is-hover');
                if (!isOpen) layer.setStyle(styleRest);
              }, 80);
            });

            layer.on('click', () => {
              if (isOpen) {
                closePopup();
              } else {
                // Clear hover state so it doesn't linger while the popup is open
                clearTimeout(mouseoutTimer);
                mouseoutTimer = null;
                layer.getElement().classList.remove('is-hover');
                openPopup();
                if (map.getZoom() < 17) {
                  map.flyTo(centroid, 17, { duration: 0.8 });
                }
              }
            });
          },
        }).addTo(map);
      });
  };
})();
