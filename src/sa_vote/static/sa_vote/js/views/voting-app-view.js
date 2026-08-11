import { HomeView } from './home-view.js';
import { BallotView } from './ballot-view.js';
import { FaqView } from './faq-view.js';
import { AuthView } from './auth-view.js';

export const VotingAppView = Backbone.View.extend({
  initialize: function (options) {
    this.router = options.router;

    // Intercept internal link clicks and route them through Backbone navigate method
    $(document).on('click', 'a[data-internal="true"]', (evt) => {
      if (evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey) return;

      evt.preventDefault();

      var href = $(evt.currentTarget).attr('href'),
          fragment = href.replace(Shareabouts.bootstrapped.routePrefix, '').replace(/^\//, '');

      this.router.navigate(fragment, { trigger: true });
    });
  },

  showHome: function () {
    this.currentView = new HomeView({ el: this.el }).render();
  },

  showBallot: function (ballot) {
    this.currentView = new BallotView({ el: this.el, ballot: ballot }).render();
  },

  showFaq: function () {
    this.currentView = new FaqView({ el: this.el }).render();
  },

  showAuth: function () {
    this.currentView = new AuthView({ el: this.el }).render();
  },
});
