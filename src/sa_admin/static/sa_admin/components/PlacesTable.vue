<template>
  <div class="table-wrapper">
    <table id="places-table">
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.attr"
            :class="[`${col.attr}-column`, { filtered: filterStates[col.attr]?.isFiltered }]"
          >
            <span class="place-table-column-label">{{ col.label }}</span>
            <component
              v-if="col.filter && getFilterComponent(col.filter)"
              :is="getFilterComponent(col.filter)"
              :column="col"
              :ref="(el) => setFilterRef(col.attr, el)"
              @filter="onFilterChange"
            />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="place in visiblePlaces"
          :key="getPlaceId(place)"
          :data-place-id="getPlaceId(place)"
          :class="{ highlighted: highlightedId === getPlaceId(place) }"
          @mouseover="onMouseOver(getPlaceId(place))"
          @mouseout="onMouseOut(getPlaceId(place))"
          @click="onClick(getPlaceId(place))"
        >
          <td
            v-for="col in columns"
            :key="col.attr"
            :class="`${col.attr}-cell`"
            v-html="formatCell(col, place)"
          ></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue';
import PlacesSubstringFilter from './filters/PlacesSubstringFilter.vue';
import PlacesBooleanFilter from './filters/PlacesBooleanFilter.vue';
import PlacesChoiceFilter from './filters/PlacesChoiceFilter.vue';
import PlacesDateTimeFilter from './filters/PlacesDateTimeFilter.vue';

const filterMap = {
  PlacesSubstringFilter,
  PlacesBooleanFilter,
  PlacesChoiceFilter,
  PlacesDateTimeFilter,
};

function getFilterComponent(name) {
  return typeof name === 'string' ? filterMap[name] : name;
}

const props = defineProps({
  places: { type: Array, required: true },
  columns: { type: Array, required: true },
  predicates: { type: Array, default: () => [] }
});

const emit = defineEmits(['place:mouseover', 'place:mouseout', 'place:click', 'filter']);

const filterRefs = reactive({});
const filterStates = reactive({});
const highlightedId = ref(null);

function getPlaceId(place) {
  return place.id || place.get('id') || place.cid;
}

function setFilterRef(attr, el) {
  if (el) {
    filterRefs[attr] = el;
  }
}

function onFilterChange({ column }) {
  const activePredicates = [];
  const activeFilteredCols = [];

  for (const col of props.columns) {
    const filterRef = filterRefs[col.attr];
    if (filterRef) {
      const isClear = filterRef.isClear();
      filterStates[col.attr] = { isFiltered: !isClear };
      if (!isClear) {
        activePredicates.push(filterRef.filterPredicate);
        activeFilteredCols.push(col);
      }
    }
  }

  emit('filter', { predicates: activePredicates, activeColumns: activeFilteredCols });
}

function clearFilters() {
  for (const attr in filterRefs) {
    filterRefs[attr]?.clear();
    filterStates[attr] = { isFiltered: false };
  }
  emit('filter', { predicates: [], activeColumns: [] });
}

const visiblePlaces = computed(() => {
  if (!props.predicates || props.predicates.length === 0) return props.places;
  return props.places.filter((place) =>
    props.predicates.every((predicate) => predicate(place))
  );
});

function formatCell(col, place) {
  const rawValue = place.get(col.attr);
  if (typeof col.format === 'function') {
    return col.format(rawValue, place);
  }
  return rawValue ?? '';
}

function onMouseOver(placeId) {
  emit('place:mouseover', { placeId });
}

function onMouseOut(placeId) {
  emit('place:mouseout', { placeId });
}

function onClick(placeId) {
  emit('place:click', { placeId });
}

function highlightRow(placeId) {
  highlightedId.value = placeId;
}

function unhighlightRow(placeId) {
  if (highlightedId.value === placeId) {
    highlightedId.value = null;
  }
}

function scrollToRow(placeId) {
  const el = document.querySelector(`tr[data-place-id="${placeId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

defineExpose({ clearFilters, highlightRow, unhighlightRow, scrollToRow });
</script>
