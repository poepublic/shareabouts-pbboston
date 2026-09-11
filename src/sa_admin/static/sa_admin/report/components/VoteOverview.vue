<template>
  <p class="vote-counts">
    {{ votesToday }} residents voted today, bringing the total to {{ totalVotes }} votes.
    {{ surveyResponseRate }}% of voters have responded to the survey.
  </p>
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
