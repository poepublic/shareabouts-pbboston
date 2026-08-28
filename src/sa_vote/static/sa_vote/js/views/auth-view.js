export const AuthView = Backbone.View.extend({
    events: {
      'click #verify-button': 'verify',
      'click #unverify-button': 'unverify',
    },

    render: function() {
      this.$el.html(Handlebars.templates['sa_vote/pages/auth'](this.options));
      return this;
    },

    verify: function() {
      fetch('/vote/verify-code-test?code=123456').then(
        // reload auth page
        () => {
          window.location.reload()
        }
      )
    },

    unverify: function() {
      fetch('/vote/unverify').then(
        // reload auth page
        () => {
          window.location.reload()
        }
      )
    },
  });