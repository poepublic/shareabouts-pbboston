import { VotingAppView } from './js/views/voting-app-view.js';

const S = Shareabouts;

const Router = Backbone.Router.extend({
  routes: {
    '': 'home',
    'faq': 'faq',
    'ballot': 'ballot', // doesn't need to be a separate place for logged in, just dependent on user state
    'auth': 'auth',
    'success': 'success',
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
    this.appView.showHome();
  },

  faq: function () {
    this.appView.showFaq();
  },

  ballot: function () {
    this.appView.showBallot();
  },

  auth: function () {
    this.appView.showAuth();
  },

  success: function () {
    this.appView.showSurvey();
  }

});

export { Router };
