/* global L */

import { Component } from "./component.js";


class PlacesMap extends Component {
  constructor(el, places) {
    super(el);

    this.places = places;
    this.map = null;
    this.placesLayer = L.featureGroup();
  }

  fill() {
    if (this.map === null) {
      this.map = L.map(this.el).setView([0, 0], 1);
      L.mapboxGL({
        accessToken: 'pk.eyJ1IjoicG9lcHVibGljIiwiYSI6ImNseGpqbzk5ODAwZTMyam9heGp0amYxY3cifQ.z8HXEZq5rvWgg97PzPlBKA',
        style: 'mapbox://styles/mapbox/light-v11',
      }).addTo(this.map);
      this.placesLayer.addTo(this.map);
    }

    for (const place of this.places.models) {
      const geometry = place.get('geometry');
      if (geometry === null) {
        console.warn(`Place ${place.get('id')} has no geometry`);
      }
      L.marker([geometry.coordinates[1], geometry.coordinates[0]]).addTo(this.placesLayer);
    }

    if (this.places.models.length > 0) {
      this.map.fitBounds(this.placesLayer.getBounds());
    }

    return this;
  }

  empty() {
    this.placesLayer.clearLayers();
    return this;
  }
}

export { PlacesMap };
