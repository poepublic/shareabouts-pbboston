import { HomeView } from './home-view.js';
import { BallotView } from './ballot-view.js';
import { FaqView } from './faq-view.js';
import { AuthView } from './auth-view.js';
import { SurveyView } from './survey-view.js';

const verified = Shareabouts.bootstrapped.voterVerified;


export const VotingAppView = Backbone.View.extend({
  events: {
    'click a[data-internal="true"]': 'handleInternalLinkClick',
  },

  initialize: function (options) {
    this.router = options.router;
  },

  handleInternalLinkClick: function (evt) {
    // Intercept internal link clicks and route them through Backbone navigate method
    if (evt.altKey || evt.ctrlKey || evt.metaKey || evt.shiftKey) return;

    evt.preventDefault();

    var href = $(evt.currentTarget).attr('href'),
      fragment = href.replace(Shareabouts.bootstrapped.routePrefix, '').replace(/^\//, '');

    this.router.navigate(fragment, { trigger: true });
  },


  _replaceCurrentView: function (view) {
    if (this.currentView) {
      this.currentView.remove();
    }
    this.currentView = view.render();
    this.el.append(this.currentView.el);
  },

  showHome: function () {
    this._replaceCurrentView(new HomeView());
  },

  showBallot: function () {
    this._replaceCurrentView(new BallotView({ ballot: Shareabouts.bootstrapped.ballot, verified: verified }));
  },

  showFaq: function () {
    this._replaceCurrentView(new FaqView({ faqs: Shareabouts.config.faq }));
  },

  showAuth: function () {
    this._replaceCurrentView(new AuthView({ verified: verified, neighborhoods: Shareabouts.bootstrapped.neighborhoods.features }));
  },

  showSurvey: function () {
    this._replaceCurrentView(new SurveyView());
  }
});
