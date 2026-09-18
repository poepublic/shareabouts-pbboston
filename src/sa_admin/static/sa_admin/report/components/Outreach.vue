<template>
  <!--  Outreach method -->
  <div id="outreach" class="stat-card">
    <h1 class="stat-title">
      Outreach method
    </h1>
    <p class="stat-line">
      The most common way that respondents heard about IIA is through <span class="stat-callout">{{ howHeardMode
      }}</span>.
    </p>
    <div id="outreach-visual">
      <div v-for="([label, pct], i) in topHowHeard" :key="label" class="outreach-group"
        :class="{ 'outreach-top': i === 0 }">
        <div class="group-left">
          <h1 class="outreach-cat-icon">{{ howHeardIcon(label) }}</h1>
        </div>
        <div class="group-right">
          <h1 class="outreach-cat-pct">{{ pct }}%</h1>
          <p class="outreach-cat-label">{{ label }}</p>
        </div>
      </div>
    </div>
    <CsvDownloadButton filename="outreach.csv" :rows="outreachCsvRows" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import CsvDownloadButton from './CsvDownloadButton.vue';
import { useBackboneCollection } from '../../composables/useBackboneCollection.js';

const props = defineProps({
  surveys: { type: Object, required: true },
});

const surveyModels = useBackboneCollection(props.surveys);

// howHeard (outreach)
const howHeard = computed(() => surveyModels.value.flatMap(survey => survey.get('howheard') || []));
const howHeardCounts = computed(() => {
  const counts = {};
  howHeard.value.forEach(h => counts[h] = (counts[h] || 0) + 1);
  return counts;
});

const howHeardMode = computed(() => {
  const sorted = Object.entries(howHeardCounts.value).sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : undefined;
});
const topHowHeard = computed(() =>
  Object.entries(howHeardCounts.value)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, count]) => [label, Math.round((count / howHeard.value.length) * 100)])
);
const outreachCsvRows = computed(() => [['Category', 'Percent'], ...topHowHeard.value]);

const howHeardIcons = {
  'Word of mouth (family, friends, neighbors)': '🗣️',
  'City of Boston newsletter, social media, event, or public official': '🏛️',
  'Other (write-in)': '✍️',
  'Local community organization or event': '🏘️',
};
function howHeardIcon(label) {
  return howHeardIcons[label] || '📣';
}

</script>