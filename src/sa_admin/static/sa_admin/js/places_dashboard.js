import { Component } from "./component.js";
import { PlacesTable } from "./places_table.js";
import { PlacesMap } from "./places_map.js";


class PlacesDashboard extends Component {
  constructor(el, places, fields) {
    super(el);

    this.places = places;
    this.fields = fields;
    this.table = new PlacesTable(this.el.querySelector('#places-table'), this.places, fields);
    this.map = new PlacesMap(this.el.querySelector('#places-map'), this.places);
  }

  fill() {
    this.table.fill();
    this.map.fill();
    return this;
  }

  empty() {
    this.table.empty();
    this.map.empty();
    return this;
  }

  bind() {
    this.table.bind();
    this.map.bind();

    this.listeners.add('place:mouseover', this.map.dispatcher, (e) => {
      const placeId = e.detail.placeId;
      this.highlightPlace(placeId, true, false);
    });

    this.listeners.add('place:mouseout', this.map.dispatcher, (e) => {
      const placeId = e.detail.placeId;
      this.unhighlightPlace(placeId, true, false);
    });

    this.listeners.add('place:mouseover', this.table.dispatcher, (e) => {
      const placeId = e.detail.placeId;
      this.highlightPlace(placeId, false, true);
    });

    this.listeners.add('place:mouseout', this.table.dispatcher, (e) => {
      const placeId = e.detail.placeId;
      this.unhighlightPlace(placeId, false, true);
    });

    this.listeners.add('place:click', this.table.dispatcher, (e) => {
      const placeId = e.detail.placeId;
      this.openPlaceDetail(placeId);
    });

    return Component.prototype.bind.call(this);
  }

  unbind() {
    this.table.unbind();
    this.map.unbind();
    return Component.prototype.unbind.call(this);
  }

  highlightPlace(placeId, skipMap = false, skipTable = false) {
    if (!skipMap) this.map.highlightMarker(placeId);
    if (!skipTable) this.table.highlightRow(placeId);
    return this;
  }

  unhighlightPlace(placeId, skipMap = false, skipTable = false) {
    if (!skipMap) this.map.unhighlightMarker(placeId);
    if (!skipTable) this.table.unhighlightRow(placeId);
    return this;
  }

  openPlaceDetail(placeId) {
    const url = `/admin/detail/${placeId}/`;
    window.open(url, '_blank').focus();
    return this;
  }
}


export { PlacesDashboard };