<template>
  <div class="voting-report-app">
    <div class="report-wrapper">
      <component v-for="section in sections" :key="section" :is="sectionComponents[section]" :id="section.toLowerCase()"
        class="stat-card" v-bind="sectionProps[section]" />
    </div>
    <div class="table-of-contents-wrapper">
      <div id="outline">
        <a v-for="section in sections" :key="section.id" :href="'#' + section.toLowerCase()">{{ section }}</a>
      </div>
      <div class="download-all-wrapper">
        <button type="button" class="button" data-variant="primary" :disabled="!allDataLoaded" @click="downloadAllData">
          Download all data
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import Overview from './components/Overview.vue';
import Neighborhood from './components/Neighborhood.vue';
import Age from './components/Age.vue';
import Ethnicity from './components/Ethnicity.vue';
import Income from './components/Income.vue';
import Outreach from './components/Outreach.vue';
import { computed, ref } from 'vue';
import { downloadCsv } from '../composables/downloadCsv.js';


// Non-anonymous Ballot Data
// -------------------------
// By design, the actual ballot proposal selections are stored separately from
// the record of whether a user submitted a ballot. The non-anonymous ballot
// records may be useful for things like understanding how many ballots have
// been submitted over time.
//
// To get those records you can use the following:

// Create collection for all ballots
const ballotsCollection = new window.Shareabouts.SubmissionCollection([], {
  submissionType: 'ballots'
});

// Fetch all pages from the API (NOTE: you don't have to pass any options to
// fetchAllPages, but it can be useful for things like showing loading
// progress; the `pageSuccess` callback is called after each page is
// successfully fetched, and the `success` callback is called after all pages
// have been fetched.)
const ballotsLoaded = ref(false);
ballotsCollection.fetchAllPages({
  success: () => { ballotsLoaded.value = true; },
});

// Anonymous Ballot Data
// --------------------
// On the other hand, if you want to retrieve the actual ballot proposals, you
// can access the anonymous data on the ballotsCollections:

ballotsCollection.anonymous.fetchAllPages({
});

// Survey Data
// -----------
// Survey data is similar to ballot data in that the actual survey responses
// are stored separately from the record of whether a user submitted a survey.
// The non-anonymous survey records can help track submission counts over
// time, while the anonymous data contains the actual survey responses.

const surveysCollection = new window.Shareabouts.SubmissionCollection([], {
  submissionType: 'surveys'
});

surveysCollection.fetchAllPages({
});

const surveysLoaded = ref(false);
surveysCollection.anonymous.fetchAllPages({
  success: () => { surveysLoaded.value = true; },
});

// Working with the Data
// ---------------------
// Each of `ballotsCollection`, `ballotsCollection.anonymous`,
// `surveysCollection`, and `surveysCollection.anonymous` is a Backbone.js
// collection. You can work with the collections directly. Roughly speaking,
// collections are like JavaScript arrays of models, and models are like
// JavaScript objects literals. Not exactly, but similar.
//
// Collections have a very similar interface to arrays: you can use methods
// like `map`, `filter`, and `forEach` on them. Models do allow you to access
// their attributes, but indirectly using the `get` method. For example, if I
// wanted to get an array of all the respondent ages (which are in the
// anonymous data) from the survey responses, I could do something like this:
//
//   const respondentAges = surveysCollection.anonymous.map(response => response.get('age'));

// If you prefer, you can also convert a collection of models to a plain array
// of objects using the `toJSON` method.

// For convenience, in case you want to experiment, I'm attaching the
// collections to the window object, so that you can access them from the
// browser console.
window.ballots = ballotsCollection;
window.surveys = surveysCollection;


const sectionComponents = {
  Overview,
  Neighborhood,
  Age,
  Ethnicity,
  Income,
  Outreach,
};

const sections = Shareabouts.Config.report.sections

const sectionProps = {
  Overview: { ballots: ballotsCollection, surveys: surveysCollection },
  Neighborhood: { ballots: ballotsCollection },
  Age: { surveys: surveysCollection.anonymous },
  Ethnicity: { surveys: surveysCollection.anonymous },
  Income: { surveys: surveysCollection.anonymous },
  Outreach: { surveys: surveysCollection.anonymous },
};

// Download all data
const allDataLoaded = computed(() => ballotsLoaded.value && surveysLoaded.value);

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
  const voteRows = ballotsCollection
    .map(ballot => [ballot.get('created_datetime'), ballot.get('neighborhood')])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  downloadCsv('votes.csv', [['Date', 'Neighborhood'], ...voteRows]);

  // Shuffle to protect anonymity 
  const surveyRows = shuffle(surveysCollection.anonymous.map(survey => [
    survey.get('age'),
    joinList(survey.get('ethnicity')),
    survey.get('income'),
    joinList(survey.get('howheard')),
  ]));
  downloadCsv('surveys.csv', [['Age', 'Ethnicity', 'Income', 'How heard'], ...surveyRows]);
}

</script>