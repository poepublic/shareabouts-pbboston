<template>
  <div class="stat-card">
  <h1 class="stat-title">
  Neighborhoods
  </h1>
  <p class="stat-line">
  </p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useBackboneCollection } from '../../composables/useBackboneCollection.js';

// Common
const props = defineProps({
  ballots: { type: Object, required: true },
});

const ballotModels = useBackboneCollection(props.ballots);

const totalVotes = computed(() => ballotModels.value.length);

// Neighborhoods (TODO)

</script>
