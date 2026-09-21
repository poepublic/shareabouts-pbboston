import { showModalPopup } from './modal-popup-view';

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

    advanceAuthStep: async function(evt) {
      evt.preventDefault();

      if (this.currentState === 'attesting') {
        this.app.voterData.set('has_confirmed_requirements', true);
        this.app.voterData.set('neighborhood', this.el.querySelector('#voter-neighborhood-input').value);

        this.currentState = 'requesting_code';
        this.updateVisibleStep();
        this.app.router.navigate('/auth/request-code', { trigger: false });
      } else if (this.currentState === 'requesting_code') {
        const submitButtons = this.el.querySelectorAll('button[type="submit"]');
        submitButtons.forEach(button => button.disabled = true);

        const phoneNumber = this.el.querySelector('#voter-phone-number-input').value;
        const response = await fetch(Shareabouts.bootstrapped.generateVoterCodeEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ phone_number: phoneNumber })
        });

        if (response.ok) {
          this.currentState = 'verifying_code';
          this.updateVisibleStep();
          this.app.router.navigate('/auth/verify-code', { trigger: false });
        } else if (response.status === 403) {
          // The phone number has already been used to submit a ballot.
          const data = await response.json();
          showModalPopup({ content: Handlebars.templates['sa_vote/includes/auth-request-code-403'](data) });
        } else if (response.status === 400) {
          // Something is wrong with the data we sent to the endpoint. We should
          // never receive a 400 response from here, since we control the input
          // format and validation on the client side. But just in case, we
          // should let the user know that something went wrong and that they
          // should try again.
          const data = await response.json();
          showModalPopup({ content: Handlebars.templates['sa_vote/includes/auth-request-code-400'](data) });
        } else if (response.status === 502) {
          // The server encountered an error while processing our request.
          // Anything that caused a 502 error should also have written an error
          // to the logs; we should get a notification. We should inform the
          // user and ask them to try again later.
          const data = await response.json();
          showModalPopup({ content: Handlebars.templates['sa_vote/includes/auth-request-code-502'](data) });
        } else {
          alert('An unexpected error occurred. Please try again.');
        }

        submitButtons.forEach(button => button.disabled = false);

      } else if (this.currentState === 'verifying_code') {
        const submitButtons = this.el.querySelectorAll('button[type="submit"]');
        submitButtons.forEach(button => button.disabled = true);

        const voterCode = this.el.querySelector('#voter-code-input').value;
        const response = await fetch(Shareabouts.bootstrapped.verifyVoterCodeEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ code: voterCode })
        });

        if (response.ok) {
          this.currentState = 'success';
          this.updateVisibleStep();

          window.location = '/vote/ballot';
          // this.app.router.navigate('/ballot', { trigger: true });
          // window.location.reload();
        } else if (response.status === 404) {
          // The voter code was not found. This likely means the user entered an
          // incorrect code, or that the code has expired.
          const data = await response.json();
          showModalPopup({ content: Handlebars.templates['sa_vote/includes/auth-verify-code-404'](data) });
        } else if (response.status === 400) {
          // The request was malformed. This should not happen under normal
          // circumstances.
          const data = await response.json();
          showModalPopup({ content: Handlebars.templates['sa_vote/includes/auth-verify-code-400'](data) });
        }

        submitButtons.forEach(button => button.disabled = false);
      }
    },
  });