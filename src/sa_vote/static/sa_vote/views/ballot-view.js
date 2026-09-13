const MAX_SELECTIONS = Shareabouts.config.ballot.max_selections;

export const BallotView = Backbone.View.extend({
  events: {
    'change .proposal-checkbox': 'updateBannerSummary',
    'click .selected-proposal-info': 'scrollToProposal',
    'click .selected-proposal-remove': 'removeSelection',
    'click #submit-ballot': 'openVoteConfirmModal',
    'click #vote-confirm-cancel': 'closeVoteConfirmModal',
    'submit form': 'submitVote',
  },

  getBannerSummaryContext: function (count, remaining) {
    return _.extend({
      count: count,
      remaining: remaining,
      MAX_SELECTIONS: MAX_SELECTIONS,
      ballotEmpty: count === 0,
      ballotFull: count === MAX_SELECTIONS,
    }, this.options);
  },

  getBannerDetailsContext: function (title, amount, slug) {
    return _.extend({
      title: title,
      amount: amount,
      slug: slug,
    }, this.options);
  },

  // Update the list of selected proposals in the expanded ballot banner (details) every time a proposal is selected/deselected
  updateBannerDetails: function (selected) {
    const $list = this.$('.selected-proposals');
    selected.forEach(function (proposal) {
      const ballotDetailsTemplate = Handlebars.templates['sa_vote/includes/selected-proposal'];
      const context = this.getBannerDetailsContext(proposal.title, proposal.amount, proposal.slug);
      $list.append(ballotDetailsTemplate(context));
    }, this);
  },

  render: function () {
    this.$el.html(Handlebars.templates['sa_vote/pages/ballot'](this.options));
    this.updateBannerSummary();
    return this;
  },

  getSelectedProposals: function () {
    return this.$('.proposal-checkbox:checked').map(function () {
      return { title: $(this).val(), amount: $(this).data('amount'), slug: $(this).data('slug') };
    }).get();
  },

  updateBannerSummary: function () {
    const count = this.$('.proposal-checkbox:checked').length;
    const remaining = MAX_SELECTIONS - count;

    // Disable unchecked checkboxes if maximum proposals selected
    if (this.options.verified) {
      this.$('.proposal-checkbox:not(:checked)').prop('disabled', count >= MAX_SELECTIONS);
    } else { this.$('.selected-proposals').text(''); }

    const ballotBannerTemplate = Handlebars.templates['sa_vote/includes/ballot-banner'];
    const context = this.getBannerSummaryContext(count, remaining);
    this.$('.ballot-banner-container').html(ballotBannerTemplate(context))

    // Insert / update selected proposals list
    const $list = this.$('.selected-proposals');
    $list.empty();

    if (count > 0) {
      // ballot banner only expands if 1 or more proposals selected
      this.$('.ballot-banner-verified-summary').removeClass('no-proposal-selections');

      const selected = this.getSelectedProposals();
      this.updateBannerDetails(selected);
    }
  },

  // Scroll to a proposal when it is selected in the ballot banner list
  scrollToProposal: function (evt) {
    const details = document.querySelector('.ballot-banner-details');
    details.open = false;

    const slug = $(evt.currentTarget).data('slug');
    const card = document.getElementById("proposal-card-" + slug);
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  removeSelection: function (evt) {
    const slug = $(evt.currentTarget).data('slug');
    this.$(`.proposal-checkbox[data-slug="${slug}"]`).prop('checked', false);
    this.updateBannerSummary();

    const details = document.querySelector('.ballot-banner-details');
    const count = this.$('.proposal-checkbox:checked').length;
    if (count > 0) {details.open = true}
  },

  openVoteConfirmModal: function (evt) {
    // Don't trigger the form to submit yet.
    evt.preventDefault();

    // If the `vote-confirm-overlay` is already shown, don't show again.
    if (this.$('#vote-confirm-overlay').length >= 1) {
      return;
    }
    
    const selected = this.getSelectedProposals();
    const modalTemplate = Handlebars.templates['sa_vote/includes/vote-confirm-modal'];
    this.$('form').append(modalTemplate({ proposals: selected }));
  },

  closeVoteConfirmModal: function () {
    this.$('#vote-confirm-overlay').remove();
  },

  submitVote: async function (evt) {
    evt.preventDefault();

    const selected = this.getSelectedProposals();
    const endpoint = Shareabouts.bootstrapped.submitBallotEndpoint;

    console.log('Submitting vote to endpoint:', endpoint);
    console.log('Selected proposals:', selected);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ proposals: selected.map(p => p.slug) })
      });

      if (response.status >= 500) {
        return await this.onSubmitVoteServerError(response);
      }

      else if (response.status === 409) {
        return await this.onSubmitVoteDupBallotError(response);
      }

      else if (response.status >= 400) {
        return await this.onSubmitVoteClientError(response);
      }

      else if (response.ok) {
        return await this.onSubmitVoteSuccess(response);
      }

    } catch (error) {
      console.error('Error submitting vote:', error);
      alert('Something went wrong while submitting your vote.')
    }
  },

  onSubmitVoteSuccess: async function (response) {
    window.app.navigate('/success', {trigger: true});
  },

  onSubmitVoteClientError: async function (response) {
    const data = await response.json();
    alert(data.label || 'Unknown error');
  },

  onSubmitVoteServerError: async function (response) {
    const data = await response.json();
    alert('Something went wrong while submitting your vote. Please try again later.');
  },

  onSubmitVoteDupBallotError: async function (response) {
    const data = await response.json();
    alert('It looks like you have already submitted a ballot.');
    window.app.navigate('/success', {trigger: true});
  },

});