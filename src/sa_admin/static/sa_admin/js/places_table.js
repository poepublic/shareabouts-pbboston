import { Component } from './component.js';

class PlacesTableHeaderCell extends Component {
  constructor(el, places, column) {
    super(el);

    this.places = places;
    this.column = column;
  }

  fill() {
    this.el.innerHTML = `
      <span class="place-table-column-label">${this.column.label}</span>
      ${this.column.filter ? `
        <span class="place-table-column-filter">
          <button class="filter">Filter</button>
        </span>

        <dialog class="filter">
          <header>
            <h2>${this.column.label}</h2>
            <button class="close">Close</button>
          </header>
          <form method="dialog">
            <label>
              <span>Filter</span>
              <input type="text">
            </label>
            <button type="submit">Apply</button>
          </form>
        </dialog>
      ` : ''}
    `;

    return this;
  }

  bind() {
    if (this.column.filter) {
      const filterButton = this.el.querySelector('button.filter');
      const filterDialog = this.el.querySelector('dialog.filter');
      this.listeners.add('click', filterButton, () => {
        filterDialog.showModal();
      });
    }

    return this;
  }
}


class PlacesTableHeaderRow extends Component {
  constructor(el, places, columns) {
    super(el);

    this.places = places;
    this.columns = columns;
    this.cells = [];
  }

  fill() {
    for (const column of this.columns) {
      const cell = new PlacesTableHeaderCell(document.createElement('th'), this.places, column);
      this.el.appendChild(cell.render().el);
      this.cells.push(cell);
    }

    return this;
  }
}


class PlacesTableBodyRow extends Component {
  constructor(el, place, columns) {
    super(el);

    this.place = place;
    this.columns = columns;
  }

  fill() {
    this.el.dataset.placeId = this.place.get('id');
    this.el.innerHTML = `
      ${this.columns.map((column) => `<td class="${column.attr}-column">${column.format(this.place.get(column.attr))}</td>`).join('')}
    `;

    return this;
  }

  empty() {
    Component.prototype.empty.call(this);
    delete this.el.dataset.placeId;
    return this;
  }

  bind() {
    return this;
  }
}


class PlacesTable extends Component {
  constructor(el, places, columns) {
    super(el);

    this.places = places;
    this.columns = columns;

    this.head = null;
    this.rows = {};
  }

  fill() {
    this.headEl = document.createElement('thead');
    this.head = new PlacesTableHeaderRow(document.createElement('tr'), this.places, this.columns);
    this.headEl.appendChild(this.head.render().el);
    this.el.appendChild(this.headEl);

    this.bodyEl = document.createElement('tbody');
    for (const place of this.places.models) {
      const placeId = place.get('id');

      if (this.rows[placeId]) {
        this.rows[placeId].redraw();
      } else {
        this.rows[placeId] = new PlacesTableBodyRow(document.createElement('tr'), place, this.columns);
        this.bodyEl.appendChild(this.rows[placeId].render().el);
      }
    }
    this.el.appendChild(this.bodyEl);

    return this;
  }

  bind() {
    if (this.head) { this.head.bind(); }
    for (const row of Object.values(this.rows)) { row.bind(); }

    for (const tr of this.el.querySelectorAll('tbody tr')) {
      this.listeners.add('mouseover', tr, (e) => {
        const placeId = e.currentTarget.dataset.placeId;
        this.highlightRow(placeId, e.currentTarget);
        this.dispatcher.dispatchEvent(new CustomEvent('place:mouseover', { detail: { placeId } }));
      });

      this.listeners.add('mouseout', tr, (e) => {
        const placeId = e.currentTarget.dataset.placeId;
        this.unhighlightRow(placeId, e.currentTarget);
        this.dispatcher.dispatchEvent(new CustomEvent('place:mouseout', { detail: { placeId } }));
      });
    }

    return Component.prototype.bind.call(this);
  }

  unbind() {
    if (this.head) { this.head.unbind(); }
    for (const row of Object.values(this.rows)) { row.unbind(); }

    return Component.prototype.unbind.call(this);
  }

  highlightRow(placeId, tr = null) {
    tr ||= this.el.querySelector(`tr[data-place-id="${placeId}"]`);
    if (tr) {
      tr.classList.add('highlight');
    }
  }

  unhighlightRow(placeId, tr = null) {
    tr ||= this.el.querySelector(`tr[data-place-id="${placeId}"]`);
    if (tr) {
      tr.classList.remove('highlight');
    }
  }
};

export {
  PlacesTable,
};
