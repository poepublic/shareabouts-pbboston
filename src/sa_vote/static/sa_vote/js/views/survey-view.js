export const SurveyView = Backbone.View.extend({
    render: function() {
      this.$el.html(Handlebars.templates['sa_vote/pages/survey'](this.options));
      return this;
    }
  });