<script setup>
  import { useBackboneCollection } from '../composables/useBackboneCollection.js';

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
  ballotsCollection.fetchAllPages({
    pageSuccess: (page) => console.log(`Fetched ${page.length} ballots...`),
    success: () => console.log('All non-anonymous data for ballots loaded! Total:', ballotsCollection.length)
  });

  // Anonymous Ballot Data
  // --------------------
  // On the other hand, if you want to retrieve the actual ballot proposals, you
  // can access the anonymous data on the ballotsCollections:

  ballotsCollection.anonymous.fetchAllPages({
    pageSuccess: (page) => console.log(`Fetched ${page.length} anonymous ballots...`),
    success: () => console.log('All anonymous data for ballots loaded! Total:', ballotsCollection.anonymous.length)
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
    pageSuccess: (page) => console.log(`Fetched ${page.length} surveys...`),
    success: () => console.log('All survey data loaded! Total:', surveysCollection.length)
  });
  surveysCollection.anonymous.fetchAllPages({
    pageSuccess: (page) => console.log(`Fetched ${page.length} anonymous surveys...`),
    success: () => console.log('All anonymous data for surveys loaded! Total:', surveysCollection.anonymous.length)
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

  const respondentAges1 = surveysCollection.anonymous.map(response => response.get('age'));

  // If you prefer, you can also convert a collection of models to a plain array
  // of objects using the `toJSON` method. For example:

  const surveyResponses = surveysCollection.anonymous.toJSON();
  const respondentAges2 = surveyResponses.map(response => response.age);

  // For convenience, in case you want to experiment, I'm attaching the
  // collections to the window object, so that you can access them from the
  // browser console.
  window.ballots = ballotsCollection;
  window.surveys = surveysCollection;
</script>