<template>
  <div class="stat-card">
  <h1 class="stat-title">
  Voting trends
  </h1>
  <p class="stat-line">
    <span class="stat-callout">{{ votesToday }}</span> residents voted today, for a total of <span class="stat-callout">{{ totalVotes }}</span> votes this cycle.
    <span class="stat-callout">{{ surveyResponseRate }}%</span> of voters have responded to the survey.
  </p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useBackboneCollection } from '../../composables/useBackboneCollection.js';

const props = defineProps({
  ballots: { type: Object, required: true },
  surveys: { type: Object, required: true },
});

const ballotModels = useBackboneCollection(props.ballots);
const surveyModels = useBackboneCollection(props.surveys);

function isToday(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

const votesToday = computed(() =>
  ballotModels.value.filter(ballot => isToday(ballot.get('created_datetime'))).length
);

const totalVotes = computed(() => ballotModels.value.length);

const surveyResponseRate = computed(() => {
  if (!totalVotes.value) return 0;
  return Math.round((surveyModels.value.length / totalVotes.value) * 100);
});
</script>
