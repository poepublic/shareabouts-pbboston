export const PrivacyView = Backbone.View.extend({
  render: function() {
    this.$el.html(Handlebars.templates['sa_vote/pages/privacy'](this.options));
    return this;
  }
});
