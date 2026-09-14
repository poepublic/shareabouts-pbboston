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
      <p>The <code>{{ column.label }}</code> field should contain the following text:</p>
      <input type="text" v-model="filterValue" />
      <button type="submit">Apply</button>
    </form>
  </dialog>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  column: { type: Object, required: true }
});

const emit = defineEmits(['filter']);

const filterValue = ref('');
const dialogEl = ref(null);

function openDialog() {
  dialogEl.value?.showModal();
}

function closeDialog() {
  dialogEl.value?.close();
}

function filterPredicate(place) {
  if (!filterValue.value) return true;
  const attrValue = place.get(props.column.attr) || '';
  return String(attrValue).includes(filterValue.value);
}

function isClear() {
  return !filterValue.value;
}

function clear() {
  filterValue.value = '';
}

function applyFilter() {
  closeDialog();
  emit('filter', { column: props.column, predicate: filterPredicate, isClear: isClear() });
}

defineExpose({ clear, isClear, filterPredicate });
</script>
