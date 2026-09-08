<template>
  <div class="places-dashboard-app">
    <div class="overview-wrapper">
      <div>
        <div class="places-count">
          <span class="filtered-count">{{ filteredPlaces.length }} {{ responsePluralName }}</span>
          (out of <span class="total-count">{{ placesModels.length }}</span> total)
        </div>
        <div class="filtered-columns">
          <template v-if="activeFilteredColumns.length > 0">
            Filtered by:
            <span
              v-for="(col, index) in activeFilteredColumns"
              :key="col.attr"
              class="filtered-column"
            >
              {{ col.label }}{{ index < activeFilteredColumns.length - 1 ? ', ' : '' }}
            </span>
          </template>
        </div>
        <button
          class="clear-filters"
          :disabled="!hasActiveFilters"
          @click="onClearFilters"
        >
          Clear Filters
        </button>
      </div>

      <div class="download-buttons actions-wrapper">
        <button
          class="download download-filtered"
          :disabled="!hasActiveFilters"
          @click="downloadPlaces(filteredPlaces)"
        >
          Download Filtered (csv)
        </button>
        <button
          class="download download-all"
          @click="downloadPlaces(placesModels)"
        >
          Download All (csv)
        </button>
      </div>
    </div>

    <PlacesMap
      ref="mapRef"
      :places="placesModels"
      :predicates="activePredicates"
      @place:mouseover="onMapMouseOver"
      @place:mouseout="onMapMouseOut"
      @place:click="onPlaceClick"
      @place:reveal="onPlaceReveal"
    />

    <PlacesTable
      ref="tableRef"
      :places="placesModels"
      :columns="fields"
      :predicates="activePredicates"
      @filter="onFilterUpdate"
      @place:mouseover="onTableMouseOver"
      @place:mouseout="onTableMouseOut"
      @place:click="onPlaceClick"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { stringify } from 'csv-stringify/browser/esm/sync';
import { useBackboneCollection } from '../composables/useBackboneCollection.js';
import { useBootstrap } from '../composables/useBootstrap.js';
import { getFields } from '../config/adminFields.js';
import PlacesTable from '../components/PlacesTable.vue';
import PlacesMap from '../components/PlacesMap.vue';

const { config } = useBootstrap();
const fields = getFields();

const placesCollection = window.places || new window.Shareabouts.PlaceCollection();
window.places = placesCollection;

const placesModels = useBackboneCollection(placesCollection);

const responsePluralName = computed(() => {
  return config.place?.response_plural_name || 'places';
});

const activePredicates = ref([]);
const activeFilteredColumns = ref([]);
const mapRef = ref(null);
const tableRef = ref(null);

const hasActiveFilters = computed(() => activeFilteredColumns.value.length > 0);

const filteredPlaces = computed(() => {
  if (activePredicates.value.length === 0) return placesModels.value;
  return placesModels.value.filter((place) =>
    activePredicates.value.every((predicate) => predicate(place))
  );
});

function onFilterUpdate({ predicates, activeColumns }) {
  activePredicates.value = predicates;
  activeFilteredColumns.value = activeColumns;
}

function onClearFilters() {
  if (tableRef.value) {
    tableRef.value.clearFilters();
  }
}

function onMapMouseOver({ placeId }) {
  tableRef.value?.highlightRow(placeId);
}

function onMapMouseOut({ placeId }) {
  tableRef.value?.unhighlightRow(placeId);
}

function onTableMouseOver({ placeId }) {
  mapRef.value?.highlightMarker(placeId);
}

function onTableMouseOut({ placeId }) {
  mapRef.value?.unhighlightMarker(placeId);
}

function onPlaceClick({ placeId }) {
  const url = `/admin/detail/${placeId}/`;
  window.open(url, '_blank').focus();
}

function onPlaceReveal({ placeId }) {
  tableRef.value?.scrollToRow(placeId);
  tableRef.value?.highlightRow(placeId);
  mapRef.value?.highlightMarker(placeId);
}

function downloadPlaces(placeModels) {
  const targetModels = placeModels || placesModels.value;

  const header = [...fields.map((field) => field.label), 'longitude', 'latitude'];
  const data = targetModels.map((place) => {
    const row = [];
    for (const field of fields) {
      row.push(place.get(field.attr));
    }
    const geom = place.get('geometry');
    if (geom && geom.coordinates) {
      row.push(...geom.coordinates);
    } else {
      row.push('', '');
    }
    return row;
  });

  const output = stringify([header, ...data]);
  const blob = new Blob([output], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `data-${new Date().toISOString().replace(/:/g, '').replace(/-/g, '').slice(0, 15)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  if (placesCollection.models.length === 0) {
    placesCollection.fetchAllPages({
      pageSuccess: (page) => {
        console.log(`Fetched ${page.length} places`);
      },
      pageError: (page, error) => {
        if (error.status === 401 || error.status === 403) {
          console.error('Authentication error while fetching places:', error.responseText);
          return;
        }
        console.error('Error fetching places:', error.status, error.responseText);
      },
      data: {
        include_private: true,
        include_invisible: true,
      },
    });
  }
});
</script>
