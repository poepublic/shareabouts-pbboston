<template>
  <div class="download-all-wrapper">
    <button type="button" class="button" data-variant="primary" :disabled="!loaded" @click="downloadAllData">
      {{ loaded ? 'Download all data' : `Loading data… ${loadPercent}%` }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { downloadCsv } from '../../composables/downloadCsv.js';

const props = defineProps({
  voters: { type: Object, required: true },
  ballots: { type: Object, required: true },
  surveys: { type: Object, required: true },
  votersProgress: { type: Object, required: true },
  ballotsProgress: { type: Object, required: true },
  surveysProgress: { type: Object, required: true },
});

const allProgress = computed(() => [props.votersProgress, props.ballotsProgress, props.surveysProgress]);

const loaded = computed(() => allProgress.value.every(p => p.done));

// Stays at 0 until all totals are known. otherwise the denominator changes and the percentage jumps
const loadPercent = computed(() => {
  const progresses = allProgress.value;
  if (progresses.some(p => p.total === null)) return 0;
  const total = progresses.reduce((sum, p) => sum + p.total, 0);
  const done = progresses.reduce((sum, p) => sum + p.loaded, 0);
  return total ? Math.min(100, Math.floor((done / total) * 100)) : 0;
});

function joinList(value) {
  return Array.isArray(value) ? value.join('; ') : value;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function downloadAllData() {
  const voterRows = props.voters
    .map(voter => [voter.get('created_datetime'), voter.get('neighborhood')])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  downloadCsv('voters.csv', [['Date', 'Neighborhood'], ...voterRows]);

  // Shuffle to protect anonymity
  const surveyRows = shuffle(props.surveys.map(survey => [
    survey.get('age'),
    joinList(survey.get('ethnicity')),
    survey.get('income'),
    joinList(survey.get('howheard')),
  ]));
  downloadCsv('surveys.csv', [['Age', 'Ethnicity', 'Income', 'How heard'], ...surveyRows]);

  // One column per proposal title, one row per ballot: 1 if the ballot
  // included that proposal, 0 otherwise. also shuffled to protect anonymity
  const selections = props.ballots.map(ballot => new Set(ballot.get('proposals') || []));
  const titles = [...new Set(selections.flatMap(s => [...s]))].sort();
  const ballotRows = shuffle(selections.map(s => titles.map(title => (s.has(title) ? 1 : 0))));
  downloadCsv('ballots.csv', [titles, ...ballotRows]);
}
</script>
