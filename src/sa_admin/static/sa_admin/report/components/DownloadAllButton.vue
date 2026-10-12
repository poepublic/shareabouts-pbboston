<template>
  <div class="download-all-wrapper">
    <button type="button" class="button" data-variant="primary" :disabled="!loaded" @click="downloadAllData">
      {{ loaded ? 'Download all data' : `Loading data… ${loadPercent}%` }}
    </button>
  </div>
</template>

<script setup>
import { downloadCsv } from '../../composables/downloadCsv.js';

const props = defineProps({
  ballots: { type: Object, required: true },
  surveys: { type: Object, required: true },
  loaded: { type: Boolean, default: false },
  loadPercent: { type: Number, default: 0 },
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
  const voteRows = props.ballots
    .map(ballot => [ballot.get('created_datetime'), ballot.get('neighborhood')])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  downloadCsv('votes.csv', [['Date', 'Neighborhood'], ...voteRows]);

  // Shuffle to protect anonymity
  const surveyRows = shuffle(props.surveys.map(survey => [
    survey.get('age'),
    joinList(survey.get('ethnicity')),
    survey.get('income'),
    joinList(survey.get('howheard')),
  ]));
  downloadCsv('surveys.csv', [['Age', 'Ethnicity', 'Income', 'How heard'], ...surveyRows]);
}
</script>
