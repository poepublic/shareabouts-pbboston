import { VotingAppView } from './js/views/voting-app-view.js';

const S = Shareabouts;

const MOCK_BALLOT = { // to do: replace with data fetched from shareabouts api
  proposals: [
    { id: 1, title: 'Placeholder Proposal A', cost: '$500k', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.' },
    { id: 2, title: 'Placeholder Proposal B', cost: '$1M', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.' },
    { id: 3, title: 'Placeholder Proposal C', cost: '$750k', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.' },
    { id: 4, title: 'Placeholder Proposal D', cost: '$250k', description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.' },

  ],
};

const Router = Backbone.Router.extend({
  routes: {
    '': 'home',
    'faq': 'faq',
    'ballot': 'ballot', // doesn't need to be a separate place for logged in, just dependent on user state
    'auth': 'auth',
    'ballot/selections': 'editVotes',
  },

  initialize: function (options) {
    // Initialize Shareabouts Vote App

    S.PlaceModel.prototype.getLoggingDetails = function () {
      return this.id;
    };

    // Global route changes
    this.bind('route', (route, args) => {
      S.Util.log('ROUTE', route, args);
    });

    this.appView = new VotingAppView({ el: '#app', router: this });

    this.loading = true;

    // Start tracking the history
    var historyOptions = { pushState: true };
    if (Shareabouts.bootstrapped.routePrefix) {
      historyOptions.root = Shareabouts.bootstrapped.routePrefix + '/';
    }
    Backbone.history.start(historyOptions);


    this.loading = false;

    console.log('You have access to the following as S.bootstrapped:');
    console.log(S.bootstrapped);

    console.log('You have access to the following as S.config:');
    console.log(S.config);
  },

  getCurrentPath: function () {
    var root = Backbone.history.root,
      fragment = Backbone.history.fragment;
    return root + fragment;
  },

  home: function () {
    console.log("home route")
    this.appView.showHome();
  },

  faq: function () {
    console.log("faq route")
    this.appView.showFaq();
  },

  ballot: function () {
    console.log("ballot route")
    this.appView.showBallot(MOCK_BALLOT);
  },

  auth: function () {
    console.log("auth route")
    this.appView.showAuth();
  },


  selections: function () {
    console.log("selections route")
  },
});

export { Router };
