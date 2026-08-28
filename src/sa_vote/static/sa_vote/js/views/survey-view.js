export const SurveyView = Backbone.View.extend({
    events: {
      'click #submit-survey': 'submitSurvey',
    },

    render: function() {
      this.$el.html(Handlebars.templates['sa_vote/pages/survey'](this.options));
      return this;
    },

    submitSurvey: function(evt) {
      evt.preventDefault();
      fetch('/vote/unverify').then(
        () => {
          window.location.href = '/vote';
        }
      );
    },
  });