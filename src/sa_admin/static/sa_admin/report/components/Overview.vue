<template>
  <div id="overview" class="stat-card">
    <h1 class="stat-title">
      Voting trends
    </h1>
    <p class="stat-line">
      <span class="stat-callout">{{ votesToday }}</span> residents voted today, for a total of <span
        class="stat-callout">{{ totalVotes }}</span> votes this cycle.
      <span class="stat-callout">{{ surveyResponseRate }}%</span> of voters have responded to the survey.
    </p>
    <div ref="overviewGraphEl" class="graph"></div>
    <CsvDownloadButton filename="voting-trends.csv" :rows="csvRows" />
  </div>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue';
import bb, { line, grid } from 'billboard.js';
import 'billboard.js/dist/billboard.css';
import { useBackboneCollection } from '../../composables/useBackboneCollection.js';
import CsvDownloadButton from './CsvDownloadButton.vue';

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

// Voting trends graph
const graphEndDate = '2026-06-30';

const votesByDay = computed(() => {
  const counts = {};
  ballotModels.value.forEach(ballot => {
    const created = ballot.get('created_datetime');
    if (!created) return;
    const day = created.slice(0, 10);
    if (day > graphEndDate) return;
    counts[day] = (counts[day] || 0) + 1;
  });
  return Object.keys(counts).sort().map(day => [day, counts[day]]);
});

const csvRows = computed(() => [['Date', 'Votes'], ...votesByDay.value]);

const overviewGraphEl = ref(null);
let overviewChart = null;

watchEffect(() => {
  if (!overviewGraphEl.value || !votesByDay.value.length) return;

  const days = votesByDay.value.map(([day]) => day);
  const votes = votesByDay.value.map(([, count]) => count);
  const lastIndex = votes.length - 1;

  if (overviewChart) overviewChart.destroy();

  overviewChart = bb.generate({
    ...grid(),
    padding: {
      left: 50,
    },
    data: {
      x: "x",
      columns: [
        ["x", ...days],
        ["votes", ...votes],
      ],
      type: line(),
      colors: {
        votes: "#FF1E71",
      },
      labels: {
        format: function (v, id, i) {
          return i === lastIndex ? v + "\nVotes" : "";
        }
      }
    },
    axis: {
      x: {
        type: "timeseries",
        tick: {
          format: "%b %d",
        }
      }
    },
    tooltip: {
      show: true,
      format: {
        title: (x) => new Date(x).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        value: (value) => `${value} votes`,
      }
    },
    legend: {
      show: false
    },
    point: {
      show: false
    },
    bindto: overviewGraphEl.value
  });
});
</script>
