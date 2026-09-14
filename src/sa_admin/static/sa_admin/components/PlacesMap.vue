<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map" id="places-map"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as d3Color from 'https://cdn.jsdelivr.net/npm/d3-color@3.1.0/+esm';
import { useBootstrap } from '../composables/useBootstrap.js';

const props = defineProps({
  places: { type: Array, required: true },
  predicates: { type: Array, default: () => [] }
});

const emit = defineEmits(['place:mouseover', 'place:mouseout', 'place:click', 'place:reveal']);

const { config, mapboxToken } = useBootstrap();

const mapContainer = ref(null);
let map = null;
let placesLayer = null;
let markerPopup = null;
const placeIdToMarker = {};
const cachedColors = {};
const usedColors = {};

function cacheCategoryColors() {
  const placeTypes = (config && config.place_types) || {};
  for (const category of Object.keys(placeTypes)) {
    const color = placeTypes[category].color;
    if (color !== undefined) {
      cachedColors[category] = color;
    }
  }
}

function colorForCategory(category) {
  let color = cachedColors[category];
  if (color === undefined) {
    const colorKeys = Object.keys(cachedColors);
    if (colorKeys.length === 0) {
      color = cachedColors[category] = '#cc0000';
    } else if (colorKeys.length === 1) {
      const hsl = d3Color.hsl(Object.values(cachedColors)[0]);
      hsl.h = (hsl.h + 180) % 360;
      color = cachedColors[category] = hsl.formatHex();
    } else {
      const colors = Object.values(cachedColors);
      const hsls = colors.map((c) => d3Color.hsl(c));
      let hsl1, hsl2, color1, color2, maxdist;

      for (let i = 0; i < hsls.length; ++i) {
        for (let j = i + 1; j < hsls.length; ++j) {
          color1 = colors[i];
          color2 = colors[j];
          if (usedColors[color1] && usedColors[color1].includes(color2)) continue;

          const dist =
            Math.pow((hsls[i].h - hsls[j].h) / 360.0, 2) +
            Math.pow(hsls[i].s - hsls[j].s, 2) +
            Math.pow(hsls[i].l - hsls[j].l, 2);

          if (hsl1 === undefined || dist > maxdist) {
            hsl1 = hsls[i];
            hsl2 = hsls[j];
            maxdist = dist;
          }
        }
      }

      if (hsl1 && hsl2) {
        const hsl = d3Color.hsl(
          (hsl1.h + hsl2.h) / 2,
          (hsl1.s + hsl2.s) / 2,
          (hsl1.l + hsl2.l) / 2
        );
        color = cachedColors[category] = hsl.formatHex();
        color1 = hsl1.formatHex();
        color2 = hsl2.formatHex();
        usedColors[color1] = usedColors[color1] || [];
        usedColors[color1].push(color2);
      } else {
        color = cachedColors[category] = '#00cc66';
      }
    }
  }
  return color || '#3388ff';
}

function normalMarkerStyle(place) {
  return {
    radius: 5,
    color: colorForCategory(place.get('location_type')),
    fillOpacity: 0.5,
    opacity: 1,
    weight: 1,
  };
}

function hoverMarkerStyle(place) {
  return {
    radius: 8,
    color: 'white',
    fillColor: colorForCategory(place.get('location_type')),
    fillOpacity: 1,
    opacity: 1,
    weight: 2,
  };
}

function initMap() {
  if (!mapContainer.value || typeof window.L === 'undefined') return;

  cacheCategoryColors();

  map = window.L.map(mapContainer.value, { zoomSnap: 0 }).setView([0, 0], 1);
  placesLayer = window.L.featureGroup().addTo(map);
  markerPopup = window.L.popup();

  if (window.L.mapboxGL && mapboxToken) {
    window.L.mapboxGL({
      accessToken: mapboxToken,
      style: 'mapbox://styles/mapbox/dark-v11',
      projection: 'mercator',
    }).addTo(map);
  } else {
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
  }

  updateMarkers();
}

function updateMarkers() {
  if (!map || !placesLayer) return;

  placesLayer.clearLayers();
  for (const key in placeIdToMarker) delete placeIdToMarker[key];

  for (const place of props.places) {
    const geometry = place.get('geometry');
    if (!geometry || !geometry.coordinates) continue;

    const marker = window.L.circleMarker(
      [geometry.coordinates[1], geometry.coordinates[0]],
      normalMarkerStyle(place)
    ).addTo(placesLayer);

    const placeId = place.get('id');
    marker.place = place;
    marker.placeId = placeId;
    placeIdToMarker[placeId] = marker;

    marker.on('mouseover', () => {
      highlightMarker(placeId);
      showMarkerPopup(placeId, marker);
      emit('place:mouseover', { placeId });
    });

    marker.on('mouseout', () => {
      unhighlightMarker(placeId);
      emit('place:mouseout', { placeId });
    });

    marker.on('click', () => {
      emit('place:click', { placeId });
    });
  }

  filterMarkers(props.predicates);

  if (props.places.length > 0 && placesLayer.getLayers().length > 0) {
    try {
      map.fitBounds(placesLayer.getBounds(), { padding: [50, 50] });
    } catch (e) {
      // Bounds computation fallback
    }
  }
}

function filterMarkers(predicates = props.predicates) {
  for (const marker of Object.values(placeIdToMarker)) {
    const place = marker.place;
    const match = !predicates || predicates.length === 0 || predicates.every((p) => p(place));

    if (match) {
      marker.addTo(placesLayer);
    } else {
      marker.removeFrom(placesLayer);
    }
  }
}

function highlightMarker(placeId) {
  const marker = placeIdToMarker[placeId];
  if (marker) {
    marker.setStyle(hoverMarkerStyle(marker.place));
    marker.bringToFront();
  }
}

function unhighlightMarker(placeId) {
  const marker = placeIdToMarker[placeId];
  if (marker) {
    marker.setStyle(normalMarkerStyle(marker.place));
  }
}

function showMarkerPopup(placeId, marker = placeIdToMarker[placeId]) {
  if (!marker || !map) return;

  const place = marker.place;
  const content = document.createElement('div');
  content.innerHTML = `
    <div>
      ID: ${place.id}
      <button type="button" class="btn edit-place">Edit</button>
      <button type="button" class="btn show-place-in-list">Show in List</button>
    </div>
  `;

  const editBtn = content.querySelector('.edit-place');
  const showBtn = content.querySelector('.show-place-in-list');

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      emit('place:click', { placeId });
    });
  }

  if (showBtn) {
    showBtn.addEventListener('click', () => {
      emit('place:reveal', { placeId });
    });
  }

  markerPopup.setContent(content);
  markerPopup.setLatLng(marker.getLatLng());
  markerPopup.openOn(map);
}

watch(() => props.places, () => {
  updateMarkers();
}, { deep: false });

watch(() => props.predicates, (newPreds) => {
  filterMarkers(newPreds);
}, { deep: true });

onMounted(() => {
  initMap();
});

onUnmounted(() => {
  if (map) {
    map.remove();
    map = null;
  }
});

defineExpose({ filterMarkers, highlightMarker, unhighlightMarker });
</script>
