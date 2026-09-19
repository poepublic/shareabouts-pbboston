<template>
  <button type="button" class="csv-download-button" @click="downloadCsv(filename, rows)">
    Download this data as a CSV
  </button>
</template>

<script setup>
import { downloadCsv } from '../../composables/downloadCsv.js';

defineProps({
  filename: { type: String, required: true },
  rows: { type: Array, required: true },
});
</script>
