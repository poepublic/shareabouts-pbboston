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
    if (this.currentView) {
      this.currentView.remove();
    } 

    this.currentView = new HomeView().render();
    this.el.append(this.currentView.el);
  },

  showBallot: function (ballot) {
    if (this.currentView) {
      this.currentView.remove();
    } 

    const verified = Shareabouts.bootstrapped.voterVerified

    this.currentView = new BallotView({ballot: ballot, verified: verified}).render();
    this.el.append(this.currentView.el);
  },

  showFaq: function () {
    if (this.currentView) {
      this.currentView.remove();
    } 

    this.currentView = new FaqView().render();
    this.el.append(this.currentView.el);
  },

  showAuth: function () {
    if (this.currentView) {
      this.currentView.remove();
    } 

    this.currentView = new AuthView().render();
    this.el.append(this.currentView.el);
  },
});
