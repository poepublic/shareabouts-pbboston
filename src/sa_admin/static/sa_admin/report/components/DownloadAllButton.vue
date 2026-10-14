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
  ballots: { type: Object, required: true },
  surveys: { type: Object, required: true },
  ballotsProgress: { type: Object, required: true },
  surveysProgress: { type: Object, required: true },
});

const loaded = computed(() => props.ballotsProgress.done && props.surveysProgress.done);

// Stays at 0 until both totals are known. otherwise the denominator grows when
// the second total arrives and the percentage jumps backwards.
const loadPercent = computed(() => {
  const { ballotsProgress: b, surveysProgress: s } = props;
  if (b.total === null || s.total === null) return 0;
  const total = b.total + s.total;
  return total ? Math.min(100, Math.floor(((b.loaded + s.loaded) / total) * 100)) : 0;
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
  downloadCsv('voters.csv', [['Date', 'Neighborhood'], ...voteRows]);

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
