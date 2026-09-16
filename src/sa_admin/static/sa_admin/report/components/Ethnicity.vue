<template>
  <!--  Ethnicity -->
  <div id="ethnicity" class="stat-card">
    <h1 class="stat-title">
      Ethnicity
    </h1>
    <p class="stat-line">
      Of <span class="stat-callout">{{ totalSurveys }}</span> survey respondents, the {{ whiteShareCat }} were
      <span class="stat-callout">white ({{
        (whitePct * 100).toFixed(1) }}%)</span>,
      compared to {{ Math.round(100 * bostonWhitePct) + "%" }} of Boston residents. {{ top2ethnicity[0] }} and {{
        top2ethnicity[1] }} were the
      next most common ethnicities, at <span class="stat-callout">{{
        (top2ethnicityPct[0] * 100).toFixed(1) }}%</span> and <span class="stat-callout">{{
          (top2ethnicityPct[1] * 100).toFixed(1) }}%</span> of respondents, respectively.
    </p>
    <div ref="ethnicityGraphEl" class="graph"></div>
    <CsvDownloadButton filename="ethnicity.csv" :rows="ethnicityCsvRows" />
  </div>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue';
import bb, { bar, grid } from 'billboard.js';
import 'billboard.js/dist/billboard.css';
import { useBackboneCollection } from '../../composables/useBackboneCollection.js';
import CsvDownloadButton from './CsvDownloadButton.vue';

const props = defineProps({
  surveys: { type: Object, required: true },
});

const surveyModels = useBackboneCollection(props.surveys);

// Common
const totalSurveys = computed(() => surveyModels.value.length);

// Ethnicity
const ethnicities = computed(() => surveyModels.value.map(survey => survey.get('ethnicity')).filter(ethnicity => ethnicity !== undefined));
const whitePct = computed(() => ethnicities.value.filter(ethnicity => ethnicity.includes('White')).length / totalSurveys.value);
const bostonWhitePct = 0.463
const whiteShareCat = computed(() => whitePct.value > bostonWhitePct ? 'majority' : 'minority')

const latinPct = computed(() => ethnicities.value.filter(ethnicity => ethnicity.includes('Hispanic or Latino/-a/-e/-x')).length / totalSurveys.value);
const blackPct = computed(() => ethnicities.value.filter(ethnicity => ethnicity.includes('Black or African American')).length / totalSurveys.value);
const asianPct = computed(() => ethnicities.value.filter(ethnicity => ethnicity.includes('Asian')).length / totalSurveys.value);
const hiPacificPct = computed(() => ethnicities.value.filter(ethnicity => ethnicity.includes('Native Hawaiian or other Pacific Islander')).length / totalSurveys.value);
const otherPct = computed(() => ethnicities.value.filter(ethnicity => ethnicity.includes('Other')).length / totalSurveys.value);
const bostonLatinPct = 0.193
const bostonBlackPct = 0.205
const bostonAsianPct = 0.104
const bostonHiPacificPct = 0.001

const top2ethnicity = computed(() => {
  const ethnicityCounts = {
    'Hispanic or Latino/-a/-e/-x': latinPct.value,
    'Black or African American': blackPct.value,
    'Asian': asianPct.value,
    'Native Hawaiian or other Pacific Islander': hiPacificPct.value
  };
  const sortedEthnicities = Object.entries(ethnicityCounts).sort((a, b) => b[1] - a[1]);
  return sortedEthnicities.slice(0, 2).map(entry => entry[0]);
});
const top2ethnicityPct = computed(() => {
  const ethnicityCounts = {
    'Hispanic or Latino/-a/-e/-x': latinPct.value,
    'Black or African American': blackPct.value,
    'Asian': asianPct.value,
    'Native Hawaiian or other Pacific Islander': hiPacificPct.value
  };
  const sortedEthnicities = Object.entries(ethnicityCounts).sort((a, b) => b[1] - a[1]);
  return sortedEthnicities.slice(0, 2).map(entry => entry[1]);
});
const ethnicityCsvRows = computed(() => [
  ['Category', 'Voters %', 'Boston %'],
  ['White', whitePct.value * 100, bostonWhitePct * 100],
  ['Latinx', latinPct.value * 100, bostonLatinPct * 100],
  ['Black/African American', blackPct.value * 100, bostonBlackPct * 100],
  ['Asian', asianPct.value * 100, bostonAsianPct * 100],
  ['Native Hawaiian or other Pacific Islander', hiPacificPct.value * 100, bostonHiPacificPct * 100],
]);

// Order the non-White categories by voter share
const rankedEthnicities = computed(() => {
  const entries = {
    'Latinx': [latinPct.value, bostonLatinPct],
    'Black/African American': [blackPct.value, bostonBlackPct],
    'Asian': [asianPct.value, bostonAsianPct],
    'Native Hawaiian or other Pacific Islander': [hiPacificPct.value, bostonHiPacificPct],
  };
  return Object.entries(entries).sort((a, b) => b[1][0] - a[1][0]);
});

const ethnicityGraphEl = ref(null);
let ethnicityChart = null;

watchEffect(() => {
  if (!ethnicityGraphEl.value || !totalSurveys.value) return;

  if (ethnicityChart) ethnicityChart.destroy();

  ethnicityChart = bb.generate({
    ...grid(),
    padding: {
      left: 100,
    },
    data: {
      order: null,
      columns: [
        ["White", whitePct.value * 100, bostonWhitePct * 100],
        ...rankedEthnicities.value.map(([label, [pct, bostonPct]]) => [label, pct * 100, bostonPct * 100]),
      ],
      type: bar(),
      groups: [
        ["White", ...rankedEthnicities.value.map(([label]) => label)]
      ],
      colors: {
        "White": "var(--iia-urban-pink)",
        "Latinx": "var(--iia-callout-blue)",
        "Black/African American": "var(--iia-vibrant-green)",
        "Asian": "var(--iia-electric-purple)",
        "Native Hawaiian or other Pacific Islander": "var(--iia-fog-grey)"
      },
    },
    axis: {
      rotated: true,
      x: {
        show: true,
        type: "category",
        categories: ["Voters", "Boston"],
      },
      y: {
        show: false,
      }
    },
    tooltip: {
      grouped: false,
      format: {
        value: (value) => `${value.toFixed(1)}%`,
      }
    },
    bar: {
      padding: 1,
      radius: {
        ratio: 0.2,
      },
      width: {
        max: 65,
      },
    },
    grid: {
      y: {
        lines: [
          {
            value: 0
          }
        ]
      }
    },
    bindto: ethnicityGraphEl.value
  });
});

</script>