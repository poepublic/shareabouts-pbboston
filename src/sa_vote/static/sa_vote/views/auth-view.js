export const AuthView = Backbone.View.extend({
    events: {
      'change input,select,textarea': 'clearValidityReport',
      'submit form.auth-step': 'advanceAuthStep',
      'change #voter-attestation-checkbox': 'updateVoterData',
      'change #voter-neighborhood-input': 'updateVoterData',
    },

    initialize: function(options) {
      this.app = options.app;

      // Possible states are:
      // 'attesting' - user should be presented with the attestation form
      // 'requesting_code' - user should be presented with the request code form
      // 'verifying_code' - user should be presented with the code verification form
      // 'verified' - user has successfully verified and is ready to vote
      this.currentState = options.state || 'attesting';
    },

    getTemplateContext: function () {
      return {
        state: {
          isAttesting: this.currentState === 'attesting',
          isRequestingCode: this.currentState === 'requesting_code',
          isVerifyingCode: this.currentState === 'verifying_code',
          isVerified: this.currentState === 'verified',
        },
        neighborhoods: this.options.neighborhoods,
      };
    },

    render: function() {
      const context = this.getTemplateContext();
      this.$el.html(Handlebars.templates['sa_vote/pages/auth'](context));
      this.updateVisibleStep();
      this.syncFromVoterData();
      return this;
    },

    delegateEvents: function() {
      Backbone.View.prototype.delegateEvents.apply(this, arguments);

      // Explicitly bind to `invalid` events, as the jQuery method that Backbone
      // uses only triggers for bubbled events. The `invalid` event does not
      // bubble, so we need to use the capturing phase.
      this.boundReportInvalidInput = this.reportInvalidInput.bind(this);
      this.el.addEventListener('invalid', this.boundReportInvalidInput, true);
    },

    undelegateEvents: function() {
      Backbone.View.prototype.undelegateEvents.apply(this, arguments);

      // Remove the bound event listener for `invalid` events.
      this.el.removeEventListener('invalid', this.boundReportInvalidInput, true);
    },

    verify: function() {
      fetch(Shareabouts.Util.prefixRoute('/verify-code-test?code=123456')).then(
        // reload auth page
        () => {
          window.location.reload()
        }
      )
    },

    unverify: function() {
      fetch(Shareabouts.Util.prefixRoute('/unverify')).then(
        // reload auth page
        () => {
          window.location.reload()
        }
      )
    },

    reportInvalidInput: function(evt) {
      if (evt.target.dataset.validationMessage) {
        evt.target.setCustomValidity(evt.target.dataset.validationMessage);
      }
    },

    clearValidityReport: function(evt) {
      if (evt.target.dataset.validationMessage) {
        evt.target.setCustomValidity('');
      }
    },

    syncFromVoterData: function() {
      this.el.querySelector('#voter-attestation-checkbox').checked = this.app.voterData.get('has_confirmed_requirements');
      this.el.querySelector('#voter-neighborhood-input').value = this.app.voterData.get('neighborhood');
    },

    updateVoterData: function() {
      this.app.voterData.set('has_confirmed_requirements', this.el.querySelector('#voter-attestation-checkbox').checked);
      this.app.voterData.set('neighborhood', this.el.querySelector('#voter-neighborhood-input').value);
    },

    updateVisibleStep: function() {
      // Do not allow any state beyond "attesting" if no attestation has been made.
      if (!this.app.voterData.get('has_confirmed_requirements') || !this.app.voterData.get('neighborhood')) {
        this.currentState = 'attesting';
      }

      for (const authStepEl of this.el.querySelectorAll('.auth-step')) {
        const state = authStepEl.dataset.state;
        authStepEl.classList.toggle('auth-current-step', state === this.currentState);
      }
    },

    advanceAuthStep: function(evt) {
      evt.preventDefault();

      if (this.currentState === 'attesting') {
        this.app.voterData.set('has_confirmed_requirements', true);
        this.app.voterData.set('neighborhood', this.el.querySelector('#voter-neighborhood-input').value);

        this.currentState = 'requesting_code';
        this.updateVisibleStep();
        this.app.router.navigate('/auth/request-code', { trigger: false });
      }
    },
  });