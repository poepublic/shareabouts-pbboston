export const AuthView = Backbone.View.extend({
    render: function() {
      this.$el.html(Handlebars.templates['sa_vote/pages/auth'](this.options));
      return this;
    }
  });