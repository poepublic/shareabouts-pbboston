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
      <p>The <code>{{ column.label }}</code> field should be between:</p>
      <label>
        From <input type="datetime-local" v-model="fromDatetime" />
      </label>
      <label>
        To <input type="datetime-local" v-model="toDatetime" />
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

const fromDatetime = ref('');
const toDatetime = ref('');
const dialogEl = ref(null);

function openDialog() {
  dialogEl.value?.showModal();
}

function closeDialog() {
  dialogEl.value?.close();
}

function filterPredicate(place) {
  const attrValue = place.get(props.column.attr);
  if (!attrValue) return !fromDatetime.value && !toDatetime.value;
  const placeDate = new Date(attrValue);
  const fromOk = !fromDatetime.value || placeDate >= new Date(fromDatetime.value);
  const toOk = !toDatetime.value || placeDate <= new Date(toDatetime.value);
  return fromOk && toOk;
}

function isClear() {
  return !fromDatetime.value && !toDatetime.value;
}

function clear() {
  fromDatetime.value = '';
  toDatetime.value = '';
}

function applyFilter() {
  closeDialog();
  emit('filter', { column: props.column, predicate: filterPredicate, isClear: isClear() });
}

defineExpose({ clear, isClear, filterPredicate });
</script>
