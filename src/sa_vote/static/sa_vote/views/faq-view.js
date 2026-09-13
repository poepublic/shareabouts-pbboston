export const FaqView = Backbone.View.extend({
    render: function() {
      this.$el.html(Handlebars.templates['sa_vote/pages/faq'](this.options));
      return this;
    }
  });