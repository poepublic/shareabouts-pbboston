import { VotingAppView } from './js/views/voting-app-view.js';

const S = Shareabouts;

const MOCK_BALLOT = { // to do: replace with ballot info in md files
  proposals: [
    { slug: 'New playground equipment', title: 'New Playground Equipment at Franklin Park', image_alt: 'Children on a playground', amount: '450000', description: 'Replace aging play structures with accessible, all-ages playground equipment and rubberized safety surfacing.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg'},
    { slug: 'Protected bike lanes', title: 'Protected Bike Lanes on Blue Hill Ave', image_alt: 'Bikers using a protected bikelane', amount: '1200000', description: 'Add physically separated bike lanes and upgraded crosswalks along a one-mile stretch of Blue Hill Avenue.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'Roxbury library renovation', title: 'Roxbury Branch Library Renovation', image_alt: 'People reading in a library', amount: '800000', description: 'Upgrade HVAC, lighting, and accessibility features at the Roxbury branch of the Boston Public Library.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'Community garden', title: 'Community Garden Expansion', image_alt: 'Senior citizens gardening', amount: '150000', description: 'Add raised beds, a tool shed, and a rainwater collection system to three neighborhood community gardens.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'LED streetlights', title: 'LED Streetlight Replacement', image_alt: 'LED streetlight on a city street', amount: '60000', description: 'Replace aging streetlights with energy-efficient LED fixtures to improve visibility and reduce energy costs.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'Public art', title: 'Public Art Installation', image_alt: 'Colorful mural on a building wall', amount: '100000', description: 'Commission local artists to create murals and sculptures in public spaces to enhance community identity and pride.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'Bus shelters', title: 'Bus Shelter Upgrades', image_alt: 'People waiting at a bus shelter', amount: '200000', description: 'Install new bus shelters with seating, lighting, and real-time arrival information at key transit stops.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'Community centers', title: 'Community Center Renovation', image_alt: 'People participating in activities at a community center', amount: '500000', description: 'Renovate the local community center to include new meeting rooms, a fitness area, and updated technology for community programs.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'Street trees', title: 'Street Tree Planting Program', image_alt: 'Newly planted street trees along a sidewalk', amount: '300000', description: 'Plant new street trees and maintain existing ones to improve air quality, provide shade, and enhance neighborhood aesthetics.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'Traffic calming', title: 'Traffic Calming Measures', image_alt: 'Speed bumps on a residential street', amount: '250000', description: 'Implement traffic calming measures such as speed bumps, curb extensions, and pedestrian islands to improve safety in residential areas.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'Recycling program', title: 'Enhanced Recycling Program', image_alt: 'Recycling bins in a public area', amount: '100000', description: 'Expand recycling services to include more materials and provide educational programs to encourage community participation.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
    { slug: 'Public Wi-Fi', title: 'Public Wi-Fi Expansion', image_alt: 'People using laptops in a public park', amount: '150000', description: 'Install public Wi-Fi hotspots in parks and community centers to improve internet access for residents.', image: Shareabouts.bootstrapped.staticUrl + 'ballot/neighborhood-fresh-food.jpg' },
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
    this.appView.showHome();
  },

  faq: function () {
    this.appView.showFaq();
  },

  ballot: function () {
    this.appView.showBallot(MOCK_BALLOT);
  },

  auth: function () {
    this.appView.showAuth();
  },

});

export { Router };
