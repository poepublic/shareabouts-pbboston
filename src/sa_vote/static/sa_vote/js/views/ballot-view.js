const MAX_SELECTIONS = Shareabouts.config.ballot.max_selections;

export const BallotView = Backbone.View.extend({
    events: {
      'change .proposal-checkbox': 'updateSelectionCount',
      'click .selected-proposal': 'scrollToProposal',
    },

    getTemplateContext: function(count, remaining) {
      return _.extend({
        count: count,
        remaining: remaining,
        MAX_SELECTIONS: MAX_SELECTIONS,
        ballotEmpty: count === 0,
        ballotFull: count === MAX_SELECTIONS,
      }, this.options);
    },

    render: function() {
      this.$el.html(Handlebars.templates['sa_vote/pages/ballot'](this.options));
      this.updateSelectionCount();
      return this;
    },

    updateSelectionCount: function() {
      const count = this.$('.proposal-checkbox:checked').length;
      const remaining = MAX_SELECTIONS - count;

      if (this.options.verified) {
        this.$('.proposal-checkbox:not(:checked)').prop('disabled', count >= MAX_SELECTIONS);
      } else { this.$('.selected-proposals').text(''); }

      const ballotBannerTemplate = Handlebars.templates['sa_vote/includes/ballot-banner'];
      const context = this.getTemplateContext(count, remaining);
      this.$('.ballot-banner-container').html(ballotBannerTemplate(context))

      // Insert / update selected proposals list
      const $list = this.$('.selected-proposals');
      $list.empty();

      if (count > 0) {

        this.$('.ballot-banner-verified-summary').removeClass('no-proposal-selections');

        const selected = this.$('.proposal-checkbox:checked').map(function() {
          return { title: $(this).val(), amount: $(this).data('amount'), slug: $(this).data('slug')};
        }
        ).get();

        selected.forEach(function(proposal) {
          $list.append(`<li class="selected-proposal" data-title="${proposal.title}"  data-slug="${proposal.slug}"><span class="selected-proposal-title">${proposal.title}</span><span class="selected-proposal-amount">${proposal.amount}</span></li>`);
        });
      }

    },

    scrollToProposal: function(evt) {
      const details = document.querySelector('.ballot-banner-details');
      details.open = false;

      const slug = $(evt.currentTarget).data('slug');
      const card = document.getElementById("proposal-card-" + slug);
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    removeSelection: function(evt) {
      const title = $(evt.currentTarget).data('title');
      this.$(`.proposal-checkbox[value="${title}"]`).prop('checked', false);
      this.updateSelectionCount();
    },

  });