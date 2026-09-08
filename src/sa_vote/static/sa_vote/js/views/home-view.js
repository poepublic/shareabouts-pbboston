export const HomeView = Backbone.View.extend({
    render: function() {
      this.$el.html(Handlebars.templates['sa_vote/pages/home'](this.options));
      return this;
    }
  });