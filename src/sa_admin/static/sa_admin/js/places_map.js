/* global L */

import { Component } from "./component.js";


class PlacesMap extends Component {
  constructor(el, places) {
    super(el);

    this.places = places;
    this.map = null;
    this.placesLayer = L.featureGroup();

    this._placeIdToMarker = {};
  }

  fill() {
    if (this.map === null) {
      this.map = L.map(this.el).setView([0, 0], 1);
      L.mapboxGL({
        accessToken: 'pk.eyJ1IjoicG9lcHVibGljIiwiYSI6ImNseGpqbzk5ODAwZTMyam9heGp0amYxY3cifQ.z8HXEZq5rvWgg97PzPlBKA',
        style: 'mapbox://styles/mapbox/dark-v11',
      }).addTo(this.map);
      this.placesLayer.addTo(this.map);
    }

    for (const place of this.places.models) {
      const geometry = place.get('geometry');
      if (geometry === null) {
        console.warn(`Place ${place.get('id')} has no geometry`);
      }

      const marker = L.circleMarker(
        [geometry.coordinates[1], geometry.coordinates[0]],
        this.normalMarkerStyle(place),
      ).addTo(this.placesLayer);

      marker.place = place;
      marker.placeId = place.get('id');
      this._placeIdToMarker[place.get('id')] = marker;
    }

    if (this.places.models.length > 0) {
      this.map.fitBounds(this.placesLayer.getBounds());
    }

    return this;
  }

  empty() {
    this.placesLayer.clearLayers();
    this._placeIdToMarker = {};
    return this;
  }

  bind() {
    this.placesLayer.eachLayer((marker) => {
      const placeId = marker.placeId;
      this.listeners.add('mouseover', marker, () => {
        this.highlightMarker(placeId, marker);
        this.dispatcher.dispatchEvent(new CustomEvent('place:mouseover', { detail: { placeId } }));
      });
      this.listeners.add('mouseout', marker, () => {
        this.unhighlightMarker(placeId, marker);
        this.dispatcher.dispatchEvent(new CustomEvent('place:mouseout', { detail: { placeId } }));
      });
      this.listeners.add('click', marker, () => {
        this.dispatcher.dispatchEvent(new CustomEvent('place:click', { detail: { placeId } }));
      });
    });
    return this;
  }

  normalMarkerStyle(place) {
    return {
      radius: 5,
      color: Shareabouts.Config.place_types[place.get('location_type')].color,
      fillOpacity: 0.5,
      opacity: 1,
      weight: 1,
    };
  }

  hoverMarkerStyle(place) {
    return {
      radius: 8,
      color: 'white',
      fillColor: Shareabouts.Config.place_types[place.get('location_type')].color,
      fillOpacity: 1,
      opacity: 1,
      weight: 2,
    };
  }

  filterMarkers(predicates) {
    for (const marker of Object.values(this._placeIdToMarker)) {
      const place = marker.place;
      const match = predicates.every((predicate) => predicate(place));

      if (match) {
        marker.addTo(this.placesLayer);
      } else {
        marker.removeFrom(this.placesLayer);
      }
    }
  }

  highlightMarker(placeId, marker = null) {
    marker ||= this._placeIdToMarker[placeId];
    if (marker) {
      marker.setStyle(this.hoverMarkerStyle(marker.place));
      marker.bringToFront();
    }
  }

  unhighlightMarker(placeId, marker = null) {
    marker ||= this._placeIdToMarker[placeId];
    if (marker) {
      marker.setStyle(this.normalMarkerStyle(marker.place));
    }
  }
}

export { PlacesMap };
