<template>
  <span class="places-filter" :class="{ filtered: !isClear() }">
    <button type="button" class="filter-button" @click="openDialog">Filter</button>
  </span>

  <dialog ref="dialogEl" class="filter-dialog">
    <header>
      <h2>{{ column.label }}</h2>
      <button type="button" class="close" @click="closeDialog">Close</button>
    </header>
    <form @submit.prevent="applyFilter">
      <p>The <code>{{ column.label }}</code> field should be one of the following values:</p>
      <label v-for="opt in options" :key="opt.value">
        <input type="checkbox" :value="opt.value" v-model="selectedValues" />
        {{ opt.label || opt.value }}
      </label>
      <button type="submit">Apply</button>
    </form>
  </dialog>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  column: { type: Object, required: true }
});

const emit = defineEmits(['filter']);

const selectedValues = ref([]);
const dialogEl = ref(null);
const options = computed(() => props.column.options || []);

function openDialog() {
  dialogEl.value?.showModal();
}

function closeDialog() {
  dialogEl.value?.close();
}

function filterPredicate(place) {
  if (selectedValues.value.length === 0) return true;
  const attrValue = place.get(props.column.attr);
  if (Array.isArray(attrValue)) {
    return attrValue.some((val) => selectedValues.value.includes(val));
  }
  return selectedValues.value.includes(attrValue);
}

function isClear() {
  return selectedValues.value.length === 0;
}

function clear() {
  selectedValues.value = [];
}

function applyFilter() {
  closeDialog();
  emit('filter', { column: props.column, predicate: filterPredicate, isClear: isClear() });
}

defineExpose({ clear, isClear, filterPredicate });
</script>
