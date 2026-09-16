<template>
    <div id="neighborhood" class="stat-card">
    <h1 class="stat-title">Neighborhoods</h1>
    <p class="stat-line">
      <span class="stat-callout">{{ top3Neighborhoods[0]?.[0] }}</span> residents submitted the most votes ({{ top3Neighborhoods[0]?.[1] }}), followed by <span class="stat-callout">{{ top3Neighborhoods[1]?.[0] }}</span> ({{ top3Neighborhoods[1]?.[1] }}) and <span class="stat-callout">{{ top3Neighborhoods[2]?.[0] }}</span> ({{ top3Neighborhoods[2]?.[1] }}).
    </p>
    <div ref="neighborhoodMapEl" class="neighborhood-map"></div>
    <CsvDownloadButton filename="neighborhoods.csv" :rows="csvRows" />
    </div>
  </template>
  
  <script setup>
  import { computed, ref, shallowRef, watchEffect, onMounted, onUnmounted } from 'vue';
  import { scaleThreshold } from 'd3-scale';
  import { schemePuRd } from 'd3-scale-chromatic';
  import { useBackboneCollection } from '../../composables/useBackboneCollection.js';
  import CsvDownloadButton from './CsvDownloadButton.vue';
  
  // Common
  const props = defineProps({
    ballots: { type: Object, required: true },
  });
  
  const ballotModels = useBackboneCollection(props.ballots);
  
  const totalVotes = computed(() => ballotModels.value.length);
  
  // Neighborhoods
  const neighborhoodCounts = computed(() => {
    const counts = {};
    ballotModels.value.forEach(ballot => {
      const neighborhood = ballot.get('neighborhood');
      if (!neighborhood) return;
      counts[neighborhood] = (counts[neighborhood] || 0) + 1;
    });
    return counts;
  });
  
  const top3Neighborhoods = computed(() =>
    Object.entries(neighborhoodCounts.value).sort((a, b) => b[1] - a[1]).slice(0, 3)
  );
  
  const csvRows = computed(() => [
    ['Neighborhood', 'Votes'],
    ...Object.entries(neighborhoodCounts.value).sort((a, b) => b[1] - a[1]),
  ]);
  
  const colorScale = scaleThreshold()
    .domain([50, 100, 150, 200, 250, 300])
    .range(schemePuRd[7]);
  
  const neighborhoodMapEl = ref(null);
  const topo = shallowRef(null);
  let map = null;
  let geoJsonLayer = null;
  let labelsLayer = null;
  let legendControl = null;
  let hasFitBounds = false;
  
  onMounted(async () => {
    if (!neighborhoodMapEl.value) return;
  
    map = window.L.map(neighborhoodMapEl.value).setView([42.3601, -71.0589], 12);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);
  
    topo.value = await fetch('/static/sa_admin/report/data/votes-by-neighborhoods.geojson').then(res => res.json());
  });
  
  watchEffect(() => {
    const ballotCount = ballotModels.value.length;
    if (!map || !topo.value || !ballotCount) return;
  
    const counts = neighborhoodCounts.value;
    const top3Names = top3Neighborhoods.value.map(([name]) => name);
  
    if (geoJsonLayer) geoJsonLayer.remove();
    if (labelsLayer) labelsLayer.remove();
  
    geoJsonLayer = window.L.geoJSON(topo.value, {
      style: (feature) => {
        const total = counts[feature.properties.name] || 0;
        return {
          fillColor: colorScale(total),
          fillOpacity: 0.85,
          color: 'white',
          weight: 1,
        };
      },
      onEachFeature: (feature, layer) => {
        const total = counts[feature.properties.name] || 0;
        layer.bindTooltip(`<strong>${feature.properties.name}</strong><br>${total} votes`, { sticky: true });
      }
    }).addTo(map);
  
    labelsLayer = window.L.layerGroup(
      geoJsonLayer.getLayers()
        .filter(layer => top3Names.includes(layer.feature.properties.name))
        .map(layer => window.L.marker(layer.getBounds().getCenter(), {
          icon: window.L.divIcon({
            className: 'neighborhood-label',
            html: layer.feature.properties.name,
          }),
          interactive: false,
        }))
    ).addTo(map);
  
    if (!hasFitBounds) {
      map.fitBounds(geoJsonLayer.getBounds());
      hasFitBounds = true;
    }
  
    if (legendControl) legendControl.remove();
    legendControl = window.L.control({ position: 'bottomright' });
    legendControl.onAdd = () => {
      const domainBreaks = colorScale.domain();
      const colors = colorScale.range();
      const div = window.L.DomUtil.create('div', 'neighborhood-map-legend');
      div.innerHTML = '<strong>Votes</strong>' + colors.map((color, i) => {
        const from = i === 0 ? 0 : domainBreaks[i - 1];
        const label = domainBreaks[i] !== undefined ? `${from}–${domainBreaks[i]}` : `≥${from}`;
        return `<div><span style="background:${color}"></span>${label}</div>`;
      }).join('');
      return div;
    };
    legendControl.addTo(map);
  });
  
  onUnmounted(() => {
    if (map) map.remove();
  });
  </script>
  