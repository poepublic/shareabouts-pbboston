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
      <DownloadAllButton :voters="voters" :ballots="ballots" :surveys="surveys" :voters-progress="votersProgress" :ballots-progress="ballotsProgress" :surveys-progress="surveysProgress" />
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
import DownloadAllButton from './components/DownloadAllButton.vue';
import { useFetchAllPages } from '../composables/useFetchAllPages.js';


// Data Model
// ---------------------
// Per @mjumbewu comments 10/13, we are using the following naming conventions:
// A Voter submits a Ballot and optionally, a Survey. The ballot proposal selections and 
// survey responses are stored separately (anonymous) from the voter's records. So:

// `voters` is the non-anonymous ballot submission records. Each represents a Voter, and contains the submission date and neighborhood.

// `ballots` is the anonymous ballot data. Each contains the proposals selected on one Ballot submission.

// `surveys` is the anonymous survey data. Each one contains the responses to one Survey submission.


const ballotsCollection = new window.Shareabouts.SubmissionCollection([], {
  submissionType: 'ballots'
});

const surveysCollection = new window.Shareabouts.SubmissionCollection([], {
  submissionType: 'surveys'
});

const voters = ballotsCollection;
const ballots = ballotsCollection.anonymous;
const surveys = surveysCollection.anonymous;

// Fetch all pages of each collection from the API to track loading progress
const votersProgress = useFetchAllPages(voters);
const ballotsProgress = useFetchAllPages(ballots);
const surveysProgress = useFetchAllPages(surveys);

// Working with the Data
// ---------------------
// Each of `voters`, `ballots`, and `surveys` is a Backbone.js collection. You
// can work with the collections directly. Roughly speaking, collections are
// like JavaScript arrays of models, and models are like JavaScript objects
// literals. Not exactly, but similar.
//
// Collections have a very similar interface to arrays: you can use methods
// like `map`, `filter`, and `forEach` on them. Models do allow you to access
// their attributes, but indirectly using the `get` method. For example, if I
// wanted to get an array of all the respondent ages from the survey
// responses, I could do something like this:
//
//   const respondentAges = surveys.map(survey => survey.get('age'));

// If you prefer, you can also convert a collection of models to a plain array
// of objects using the `toJSON` method.

// For convenience, in case you want to experiment, I'm attaching the
// collections to the window object, so that you can access them from the
// browser console.
window.voters = voters;
window.ballots = ballots;
window.surveys = surveys;


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
  Overview: { voters, surveys },
  Neighborhood: { voters },
  Age: { surveys },
  Ethnicity: { surveys },
  Income: { surveys },
  Outreach: { surveys },
};

</script>
