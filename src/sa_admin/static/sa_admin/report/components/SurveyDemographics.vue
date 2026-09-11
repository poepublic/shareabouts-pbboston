<template>
  <!--  Age -->
  <div class="stat-card">
    <h1 class="stat-title">
      Age
    </h1>
    <p class="stat-line">
      The median voter is <span class="stat-callout">{{ medianAge }}</span> years old, slightly {{ ageDiffText }} than
      Boston's median of <span class="stat-callout">{{ bostonMedianAge }}</span>. Children voted at a <strong>{{
        childrenVoteRate }}</strong> rate than their share of the population and seniors voted at a <strong>{{
          seniorVoteRate }}</strong> rate.
    </p>
  </div>

  <!--  Ethnicity -->
  <div class="stat-card">
    <h1 class="stat-title">
      Ethnicity
    </h1>
    <p class="stat-line">
      Of <span class="stat-callout">{{ totalSurveys }}</span> survey respondents, the {{ whiteShareCat }} were
      <span class="stat-callout">white ({{
        (whitePct * 100).toFixed(1) }}%)</span>,
      compared to {{ bostonWhitePct }} of Boston residents. {{ top2ethnicity[0] }} and {{ top2ethnicity[1] }} were the
      next most common ethnicities, at <span class="stat-callout">{{
        (top2ethnicityPct[0] * 100).toFixed(1) }}%</span> and <span class="stat-callout">{{
          (top2ethnicityPct[1] * 100).toFixed(1) }}%</span> of respondents, respectively.
    </p>
  </div>

    <!--  Outreach method -->
    <div class="stat-card">
    <h1 class="stat-title">
      Outreach method
    </h1>
    <p class="stat-line">
      The most common way that respondents heard about IIA is through <span class="stat-callout">{{ howHeardMode }}</span>.
    </p>
  </div>
</template>

<script setup>
import { computed, watchEffect } from 'vue';
import { useBackboneCollection } from '../../composables/useBackboneCollection.js';

const props = defineProps({
  surveys: { type: Object, required: true },
});

const surveyModels = useBackboneCollection(props.surveys);

// Common
const totalSurveys = computed(() => surveyModels.value.length);

// Age
const medianAge = computed(() => {
  const ages = surveyModels.value.map(survey => survey.get('age')).filter(age => age !== undefined).sort((a, b) => a - b);
  const mid = Math.floor(ages.length / 2);
  return ages.length % 2 !== 0 ? ages[mid] : (ages[mid - 1] + ages[mid]) / 2;
});

const bostonMedianAge = 33
const ageDiff = bostonMedianAge - medianAge
const ageDiffText = ageDiff > 0 ? `younger` : `older`

const childrenVotes = computed(() => surveyModels.value.filter(survey => survey.get('age') < 18).length)
const voteChildrenPct = computed(() => childrenVotes.value / totalSurveys.value)
const bostonChildrenPct = 0.9
const childrenVoteRate = computed(() => voteChildrenPct.value > bostonChildrenPct ? 'higher' : 'lower')

const seniorVotes = computed(() => surveyModels.value.filter(survey => survey.get('age') >= 65).length)
const voteSeniorPct = computed(() => seniorVotes.value / totalSurveys.value)
const bostonSeniorPct = 0.19
const seniorVoteRate = computed(() => voteSeniorPct.value > bostonSeniorPct ? 'higher' : 'lower')

// Ethnicity
const ethnicities = computed(() => surveyModels.value.map(survey => survey.get('ethnicity')).filter(ethnicity => ethnicity !== undefined));
const whitePct = computed(() => ethnicities.value.filter(ethnicity => ethnicity.includes('White')).length / totalSurveys.value);
const bostonWhitePct = 0.52
const whiteShareCat = computed(() => whitePct.value > bostonWhitePct ? 'majority' : 'minority')

const latinPct = computed(() => ethnicities.value.filter(ethnicity => ethnicity.includes('Hispanic or Latino/-a/-e/-x')).length / totalSurveys.value);
const blackPct = computed(() => ethnicities.value.filter(ethnicity => ethnicity.includes('Black or African American')).length / totalSurveys.value);
const asianPct = computed(() => ethnicities.value.filter(ethnicity => ethnicity.includes('Asian')).length / totalSurveys.value);
const hiPacificPct = computed(() => ethnicities.value.filter(ethnicity => ethnicity.includes('Native Hawaiian or other Pacific Islander')).length / totalSurveys.value);
const otherPct = computed(() => ethnicities.value.filter(ethnicity => ethnicity.includes('Other')).length / totalSurveys.value);
const bostonLatinPct = 0.19
const bostonBlackPct = 0.22
const bostonAsianPct = 0.11
const bostonHiPacificPct = 0.01

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
// Income
// howHeard (outreach)
const howHeard = computed(() => surveyModels.value.flatMap(survey => survey.get('howheard') || []));
const howHeardMode = computed(() => {
  const counts = {};
  howHeard.value.forEach(h => counts[h] = (counts[h] || 0) + 1);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : undefined;
});

// voted before (will we have this?)
</script>
