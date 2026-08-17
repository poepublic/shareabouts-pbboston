const MAX_SELECTIONS = 5;

export const BallotView = Backbone.View.extend({
    events: {
      'change .proposal-checkbox': 'updateSelectionCount',
      'click .selected-proposal': 'removeSelection',
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


      // Update the banner text based on number of selections
      // Case 1: no proposals selected
      if (count === 0) {
        this.$('#ballot-banner-count').text(`Select up to ${MAX_SELECTIONS} proposals`);
        this.$('#ballot-banner-subtext').text('');
        this.$('.ballot-banner-verified-summary').addClass('no-proposal-selections');
        this.$('.ballot-vote-button').empty();
      // Case 2: 1-4 proposals selected
      } else if (0 < count && count < MAX_SELECTIONS) {
        this.$('#ballot-banner-count').text(`${count} proposal${count === 1 ? '' : 's'} selected`);
        this.$('#ballot-banner-subtext').text(`You may pick up to ${remaining} more`);
        this.$('.ballot-vote-button').html('<button class="btn btn-primary" id="submit-ballot">Vote</button>');
      } else {
      // Case 3: 5 (max) proposals selected
        this.$('#ballot-banner-count').text(`${MAX_SELECTIONS} proposals selected`);
        this.$('#ballot-banner-subtext').text('Ready to vote?');
      }


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