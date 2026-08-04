<template>
  <div class="map-wrapper">
    <div ref="mapContainer" class="map" id="place-map"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useBootstrap } from '../composables/useBootstrap.js';

const props = defineProps({
  coordinates: { type: Array, default: () => [0, 0] }
});

const emit = defineEmits(['marker:move']);

const { mapboxToken } = useBootstrap();
const mapContainer = ref(null);
let map = null;
let marker = null;

function initMap() {
  if (!mapContainer.value || typeof window.L === 'undefined') return;

  const lat = props.coordinates && props.coordinates.length === 2 ? props.coordinates[1] : 0;
  const lng = props.coordinates && props.coordinates.length === 2 ? props.coordinates[0] : 0;

  map = window.L.map(mapContainer.value).setView([lat, lng], 16);

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

  marker = window.L.marker([lat, lng], { draggable: true })
    .bindTooltip('Drag to reposition...')
    .addTo(map);

  marker.on('dragend', () => {
    const latlng = marker.getLatLng();
    emit('marker:move', { latlng });
  });

  map.on('click', (e) => {
    const popupContent = document.createElement('div');
    popupContent.innerHTML = `
      <button type="button" class="move-marker-button" data-lat="${e.latlng.lat}" data-lng="${e.latlng.lng}">
        Move marker here...
      </button>
    `;
    const btn = popupContent.querySelector('.move-marker-button');
    if (btn) {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        const nLat = parseFloat(btn.dataset.lat);
        const nLng = parseFloat(btn.dataset.lng);
        marker.setLatLng([nLat, nLng]);
        map.closePopup();
        emit('marker:move', { latlng: marker.getLatLng() });
      });
    }

    map.openPopup(popupContent, e.latlng);
  });

  setTimeout(() => {
    map?.invalidateSize({ animate: false });
  }, 200);
}

function setCoordinates(coords) {
  if (marker && coords && coords.length === 2) {
    const current = marker.getLatLng();
    if (current.lat !== coords[1] || current.lng !== coords[0]) {
      marker.setLatLng([coords[1], coords[0]]);
      map?.setView([coords[1], coords[0]], 16);
    }
  }
}

watch(() => props.coordinates, (newCoords) => {
  setCoordinates(newCoords);
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

defineExpose({ setCoordinates });
</script>
