import { HomeView } from './home-view.js';
import { BallotView } from './ballot-view.js';
import { FaqView } from './faq-view.js';
import { PrivacyView } from './privacy-view.js';
import { TermsView } from './terms-view.js';
import { AuthView } from './auth-view.js';
import { SurveyView } from './survey-view.js';

const verified = Shareabouts.bootstrapped.voterVerified;


export const VotingAppView = Backbone.View.extend({
  events: {
    'click a[data-internal="true"]': 'handleInternalLinkClick',
  },

  initialize: function (options) {
    this.router = options.router;

    this.voterData = this.loadVoterData();
    this.voterData.on('change', this.saveVoterData, this);
  },

  loadVoterData: function() {
    const model = new Backbone.Model();
    const storedVoterData = localStorage.getItem('voterData');
    if (storedVoterData) {
      model.set(JSON.parse(storedVoterData));
    }
    return model;
  },

  saveVoterData: function() {
    localStorage.setItem('voterData', JSON.stringify(this.voterData.toJSON()));
  },

  clearVoterData: function() {
    localStorage.removeItem('voterData');
    this.voterData.clear();
  },

  setVoterVerified: function(verified) {
    Shareabouts.bootstrapped.voterVerified = verified;
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
    this.clearVoterData();
    this._replaceCurrentView(new HomeView());
  },

  showBallot: function () {
    this._replaceCurrentView(new BallotView({
      app: this,
      ballot: Shareabouts.bootstrapped.ballot,
      verified: Shareabouts.bootstrapped.voterVerified,
    }));
  },

  showFaq: function () {
    this._replaceCurrentView(new FaqView({ faqs: Shareabouts.config.faq }));
  },

  showPrivacy: function () {
    this._replaceCurrentView(new PrivacyView());
  },

  showTerms: function () {
    this._replaceCurrentView(new TermsView());
  },

  showAuth: function (state) {
    this._replaceCurrentView(new AuthView({
      app: this,
      state: state,
      verified: Shareabouts.bootstrapped.voterVerified,
      neighborhoods: Shareabouts.bootstrapped.neighborhoods.features
    }));
  },

  showSurvey: function () {
    this._replaceCurrentView(new SurveyView({ app: this }));
  }
});
