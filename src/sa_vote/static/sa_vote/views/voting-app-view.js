import { HomeView } from './home-view.js';
import { BallotView } from './ballot-view.js';
import { FaqView } from './faq-view.js';
import { PrivacyView } from './privacy-view.js';
import { TermsView } from './terms-view.js';
import { AuthView } from './auth-view.js';
import { SurveyView } from './survey-view.js';

const FAQs = {
  sections: [
    {
      title: "Voting in this cycle",
      questions: [
        { question: "Who can vote in this cycle?", answer: "All residents of the city who are 18 years or older and registered to vote are eligible to participate in this cycle." },
        { question: "How do I submit my vote?", answer: "You can submit your vote online through our secure voting platform after registering to vote." },
        { question: "Can I change my vote after submitting it?", answer: "No, once your vote is submitted, it cannot be changed. Please review your choices carefully before finalizing your vote." },
        { question: "When will the results be announced?", answer: "The results will be announced on the official election website and through local media outlets after the voting period ends." },
        { question: "Is my vote public?", answer: "No, all votes are confidential and will not be disclosed to the public. Your privacy is protected throughout the voting process." },
      ],
    },
    {
      title: "About Ideas in Action (IIA)",
      questions: [
        { question: "What is Ideas in Action (IIA)?", answer: "Ideas in Action (IIA) is a community-driven initiative that allows residents to propose and vote on projects that will improve their neighborhoods." },
        { question: "How are projects selected for the ballot?", answer: "Projects are selected based on community input, feasibility, and alignment with city priorities. A committee reviews proposals and determines which ones will be included on the ballot." },
        { question: "What is participatory budgeting?", answer: "Participatory budgeting is a democratic process in which community members directly decide how to allocate a portion of the public budget for local projects and initiatives." },
      ],
    },
  ],
};

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
    this._replaceCurrentView(new BallotView({ app: this, ballot: Shareabouts.bootstrapped.ballot, verified: verified }));
  },

  showFaq: function () {
    this._replaceCurrentView(new FaqView({ app: this,faqs: FAQs }));
  },

  showPrivacy: function () {
    this._replaceCurrentView(new PrivacyView());
  },

  showTerms: function () {
    this._replaceCurrentView(new TermsView());
  },

  showAuth: function (state) {
    this._replaceCurrentView(new AuthView({ app: this, state: state, verified: verified, neighborhoods: Shareabouts.bootstrapped.neighborhoods.features }));
  },

  showSurvey: function () {
    this._replaceCurrentView(new SurveyView());
  }
});
