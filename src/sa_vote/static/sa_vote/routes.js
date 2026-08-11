import { VotingAppView } from './js/views/voting-app-view.js';

const S = Shareabouts;

const MOCK_BALLOT = { // to do: replace with ballot info in md files
  proposals: [
    { id: 1, title: 'New Playground Equipment at Franklin Park', cost: '$450,000', description: 'Replace aging play structures with accessible, all-ages playground equipment and rubberized safety surfacing.' },
    { id: 2, title: 'Protected Bike Lanes on Blue Hill Ave', cost: '$1,200,000', description: 'Add physically separated bike lanes and upgraded crosswalks along a one-mile stretch of Blue Hill Avenue.' },
    { id: 3, title: 'Roxbury Branch Library Renovation', cost: '$800,000', description: 'Upgrade HVAC, lighting, and accessibility features at the Roxbury branch of the Boston Public Library.' },
    { id: 4, title: 'Community Garden Expansion', cost: '$150,000', description: 'Add raised beds, a tool shed, and a rainwater collection system to three neighborhood community gardens.' },
  ],
};

const Router = Backbone.Router.extend({
  routes: {
    '': 'home',
    'faq': 'faq',
    'ballot': 'ballot', // doesn't need to be a separate place for logged in, just dependent on user state
    'auth': 'auth',
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

});

export { Router };
