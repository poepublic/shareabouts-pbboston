export const TermsView = Backbone.View.extend({
  render: function() {
    this.$el.html(Handlebars.templates['sa_vote/pages/terms'](this.options));
    return this;
  }
});
