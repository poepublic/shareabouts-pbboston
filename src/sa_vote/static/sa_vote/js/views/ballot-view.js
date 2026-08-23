const MAX_SELECTIONS = Shareabouts.config.ballot.max_selections;

export const BallotView = Backbone.View.extend({
  events: {
    'change .proposal-checkbox': 'updateBannerSummary',
    'click .selected-proposal-info': 'scrollToProposal',
    'click .selected-proposal-remove': 'removeSelection',
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

      const selected = this.$('.proposal-checkbox:checked').map(function () {
        return { title: $(this).val(), amount: $(this).data('amount'), slug: $(this).data('slug') };
      }
      ).get();

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
  },

});