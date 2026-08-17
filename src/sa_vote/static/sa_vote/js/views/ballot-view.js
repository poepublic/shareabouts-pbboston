export const BallotView = Backbone.View.extend({
    render: function() {
      this.$el.html(Handlebars.templates['sa_vote/pages/ballot'](this.options));
      return this;
    }
  });