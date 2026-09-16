<template>
  <!--  Age -->
  <div id="age" class="stat-card">
    <h1 class="stat-title">
      Age
    </h1>
    <p class="stat-line">
      The median voter is <span class="stat-callout">{{ medianAge }}</span> years old, slightly {{ ageDiffText }} than
      Boston's median of <span class="stat-callout">{{ bostonMedianAge }}</span>. Children voted at a <strong>{{
        childrenVoteRate }}</strong> rate than their share of the population and seniors voted at a <strong>{{
          seniorVoteRate }}</strong> rate.
    </p>
    <div id="age-visual">
      <div v-for="bucket in ageBuckets" :key="bucket.label" class="age-group"
        :class="{ 'age-top': bucket.pct === maxAgePct }">
        <div class="age-group-top">
          <p class="age-cat-label">{{ bucket.label }}</p>
        </div>
        <div class="age-group-bottom">
          <p class="age-cat-pct">{{ bucket.pct }}%</p>
          <p class="age-pct-note">of all votes</p>
        </div>
      </div>
    </div>
    <CsvDownloadButton filename="age.csv" :rows="ageCsvRows" />
  </div>
</template>

<script setup>
import { computed} from 'vue';
import { useBackboneCollection } from '../../composables/useBackboneCollection.js';
import CsvDownloadButton from './CsvDownloadButton.vue';

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
const ageDiff = computed(() => bostonMedianAge - medianAge.value)
const ageDiffText = computed(() => ageDiff.value > 0 ? `younger` : `older`)

const childrenVotes = computed(() => surveyModels.value.filter(survey => survey.get('age') < 18).length)
const voteChildrenPct = computed(() => childrenVotes.value / totalSurveys.value)
const bostonChildrenPct = 0.9
const childrenVoteRate = computed(() => voteChildrenPct.value > bostonChildrenPct ? 'higher' : 'lower')

const seniorVotes = computed(() => surveyModels.value.filter(survey => survey.get('age') >= 65).length)
const voteSeniorPct = computed(() => seniorVotes.value / totalSurveys.value)
const bostonSeniorPct = 0.19
const seniorVoteRate = computed(() => voteSeniorPct.value > bostonSeniorPct ? 'higher' : 'lower')

const ageBuckets = computed(() => {
  const buckets = [
    { label: '11-17 years', count: 0 },
    { label: '18-34 years', count: 0 },
    { label: '35-64 years', count: 0 },
    { label: '65 years +', count: 0 },
  ];
  surveyModels.value.forEach(survey => {
    const age = survey.get('age');
    if (age === undefined) return;
    if (age < 18) buckets[0].count++;
    else if (age < 35) buckets[1].count++;
    else if (age < 65) buckets[2].count++;
    else buckets[3].count++;
  });
  return buckets.map(bucket => ({
    ...bucket,
    pct: totalSurveys.value ? Math.round((bucket.count / totalSurveys.value) * 100) : 0,
  }));
});
const maxAgePct = computed(() => Math.max(...ageBuckets.value.map(bucket => bucket.pct)));
const ageCsvRows = computed(() => [
  ['Age group', 'Percent'],
  ...ageBuckets.value.map(bucket => [bucket.label, bucket.pct]),
]);

</script>