const MAX_SELECTIONS = Shareabouts.config.ballot.max_selections;

export const BallotView = Backbone.View.extend({
    events: {
      'change .proposal-checkbox': 'updateSelectionCount',
      'click .selected-proposal': 'removeSelection',
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
          return { slug: $(this).val(), amount: $(this).data('amount') };
        }
        ).get();

        selected.forEach(function(proposal) {
          $list.append(`<li class="selected-proposal" data-slug="${proposal.slug}">${proposal.slug}<span class="selected-proposal-amt">${proposal.amount}</span></li>`);
        });
      }

    },

    removeSelection: function(evt) {
      const slug = $(evt.currentTarget).data('slug');
      this.$(`.proposal-checkbox[value="${slug}"]`).prop('checked', false);
      this.updateSelectionCount();
    },

  });