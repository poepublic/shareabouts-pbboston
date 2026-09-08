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
      <p>The <code>{{ column.label }}</code> field should be:</p>
      <label>
        <input type="radio" v-model="filterValue" value="true" />
        True
      </label>
      <label>
        <input type="radio" v-model="filterValue" value="false" />
        False
      </label>
      <label>
        <input type="radio" v-model="filterValue" value="null" />
        Either True or False
      </label>
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

const filterValue = ref('null');
const dialogEl = ref(null);

function openDialog() {
  dialogEl.value?.showModal();
}

function closeDialog() {
  dialogEl.value?.close();
}

function filterPredicate(place) {
  const val = filterValue.value;
  if (val === 'null') return true;
  const attrValue = place.get(props.column.attr);
  if (val === 'true') return attrValue === 'true' || attrValue === true;
  if (val === 'false') return attrValue === 'false' || attrValue === false;
  return true;
}

function isClear() {
  return filterValue.value === 'null';
}

function clear() {
  filterValue.value = 'null';
}

function applyFilter() {
  closeDialog();
  emit('filter', { column: props.column, predicate: filterPredicate, isClear: isClear() });
}

defineExpose({ clear, isClear, filterPredicate });
</script>
