export const SurveyView = Backbone.View.extend({
  events: {
    'submit #survey-form': 'submitSurvey',
  },

  initialize: function(options) {
    this.app = options.app;
  },

  render: function() {
    this.$el.html(Handlebars.templates['sa_vote/pages/survey'](this.options));
    return this;
  },

  submitSurvey: async function(evt) {
    evt.preventDefault();

    const endpoint = Shareabouts.bootstrapped.submitSurveyEndpoint;
    const formData = new FormData(evt.currentTarget);
    const surveyData = Object.fromEntries(formData.entries());

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(surveyData)
      });

      if (response.status >= 500) {
        return await this.onSubmitSurveyServerError(response);
      }

      else if (response.status === 409) {
        return await this.onSubmitSurveyDuplicateError(response);
      }

      else if (response.status === 403) {
        return await this.onSubmitSurveyUnverifiedError(response);
      }

      else if (response.status >= 400) {
        return await this.onSubmitSurveyClientError(response);
      }

      else if (response.ok) {
        return await this.onSubmitSurveySuccess(response);
      }

    } catch (error) {
      console.error('Error submitting survey:', error);
      alert('Something went wrong while submitting your survey.');
    }
  },

  goToHome: async function () {
    await fetch(Shareabouts.bootstrapped.unverifyVoterEndpoint, {
      method: 'POST'
    });

    this.app.setVoterVerified(false);
    this.app.clearVoterData();
    this.app.router.navigate('', { trigger: true });
  },

  onSubmitSurveySuccess: async function (response) {
    this.goToHome();
  },

  onSubmitSurveyClientError: async function (response) {
    const data = await response.json();
    alert(data.label || 'Unknown error');
  },

  onSubmitSurveyServerError: async function (response) {
    const data = await response.json();
    alert('Something went wrong while submitting your survey. Please try again later.');
  },

  onSubmitSurveyDuplicateError: async function (response) {
    const data = await response.json();
    alert('It looks like you have already submitted a survey.');
    this.goToHome();
  },

  onSubmitSurveyUnverifiedError: async function (response) {
    const data = await response.json();
    alert('It looks like you are not verified as a voter.');
  },

});