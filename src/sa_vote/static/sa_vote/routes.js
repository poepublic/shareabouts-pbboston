const Router = Backbone.Router.extend({
  routes: {
    '': 'homeRoute',
    'faq': 'faqRoute',
  },

  initialize: function(options) {
    // Initialize Shareabouts Vote App

    console.log('You have access to the following as Shareabouts.bootstrapped:');
    console.log(Shareabouts.bootstrapped);

    console.log('You have access to the following as Shareabouts.config:');
    console.log(Shareabouts.config);
  },

  homeRoute: function() {
  },

  faqRoute: function() {
  },
});

export { Router };
