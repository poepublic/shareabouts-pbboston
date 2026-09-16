<template>
  <!--  Income -->
  <div id="income" class="stat-card">
    <h1 class="stat-title">
      Income
    </h1>
    <p class="stat-line">
      The most common household income bracket among survey respondents was <span class="stat-callout">{{ modeIncomeLabel }}</span>.
    </p>
    <div ref="incomeGraphEl" class="graph"></div>
    <CsvDownloadButton filename="income.csv" :rows="incomeCsvRows" />
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

const totalSurveys = computed(() => surveyModels.value.length);

// Income brackets in ascending order. The API stores the option's label text
// directly (e.g. "$150,000 or more"), not the `value` slug from config.yml,
// so we match against label text here.
const INCOME_BRACKETS = [
  'Less than $14,999',
  '$15,000 to $34,999',
  '$35,000 to $49,999',
  '$50,000 to $74,999',
  '$75,000 to $99,999',
  '$100,000 to $149,999',
  '$150,000 or more',
];
const NO_ANSWER_VALUES = ["I don't know", 'Prefer not to answer'];
const NO_ANSWER_LABEL = 'No Answer';

const incomes = computed(() => surveyModels.value.map(survey => survey.get('income')).filter(income => income !== undefined && income !== ''));

const incomeCounts = computed(() => {
  const counts = {};
  incomes.value.forEach(income => {
    const label = NO_ANSWER_VALUES.includes(income) ? NO_ANSWER_LABEL : income;
    counts[label] = (counts[label] || 0) + 1;
  });
  return counts;
});

// Ordered by income value ascending, with No Answer grouped at the end.
const orderedIncomeLabels = computed(() => [...INCOME_BRACKETS, NO_ANSWER_LABEL]);

const incomePcts = computed(() => orderedIncomeLabels.value.map(label => ({
  label,
  pct: totalSurveys.value ? Math.round(((incomeCounts.value[label] || 0) / totalSurveys.value) * 100) : 0,
})));

const modeIncomeLabel = computed(() => {
  const withoutNoAnswer = incomePcts.value.filter(({ label }) => label !== NO_ANSWER_LABEL);
  const mode = withoutNoAnswer.sort((a, b) => b.pct - a.pct)[0];
  return mode ? mode.label : undefined;
});

const incomeCsvRows = computed(() => [
  ['Income bracket', 'Percent'],
  ...incomePcts.value.map(({ label, pct }) => [label, pct]),
]);

const incomeGraphEl = ref(null);
let incomeChart = null;

watchEffect(() => {
  if (!incomeGraphEl.value || !totalSurveys.value) return;

  if (incomeChart) incomeChart.destroy();

  incomeChart = bb.generate({
    ...grid(),
    padding: {
      left: 180,
    },
    data: {
      order: null,
      columns: [
        ['Percent', ...incomePcts.value.map(({ pct }) => pct)],
      ],
      type: bar(),
      color: (color, d) => (
        d && typeof d.index === 'number' && orderedIncomeLabels.value[d.index] === NO_ANSWER_LABEL
          ? 'var(--iia-fog-grey)'
          : 'var(--iia-callout-blue)'
      ),
    },
    axis: {
      rotated: true,
      x: {
        show: true,
        type: 'category',
        categories: orderedIncomeLabels.value,
        tick: {
          multiline: false,
        },
      },
      y: {
        show: false,
      },
    },
    tooltip: {
      grouped: false,
      format: {
        value: (value) => `${value.toFixed(0)}%`,
      },
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
            value: 0,
          },
        ],
      },
    },
    legend: {
      show: false,
    },
    bindto: incomeGraphEl.value,
  });
});
</script>
