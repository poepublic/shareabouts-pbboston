export const SurveyView = Backbone.View.extend({
  events: {
    'submit #survey-form': 'submitSurvey',
    'click .share-language-button': 'selectShareLanguage',
    'click .share-button-copy': 'copyShareLink',
  },

  initialize: function(options) {
    this.app = options.app;
  },

  render: function() {
    const context = _.extend({ share: this.getShareContext() }, this.options);
    this.$el.html(Handlebars.templates['sa_vote/pages/survey'](context));
    return this;
  },

  // Share details from OpenGraph tags
  getShareContext: function () {
    const meta = (property) => document.querySelector(`meta[property="${property}"]`).content;
    const url = meta('og:url');
    const title = meta('og:title');

    // Add the current language to the URL with the `language` query parameter
    const language = Shareabouts.bootstrapped.languageCode;
    const urlWithLanguage = new URL(url);
    urlWithLanguage.searchParams.set('language', language);

    ```
    const languages = (Shareabouts.bootstrapped.shareImages || []).map((image) => ({
      ...image,
      facebookUrl: this.getFacebookUrl(image.url),
      xUrl: this.getXUrl(image.url, title),
    }));
    const selected = languages.find((language) => language.selected);

    return {
      copyUrl: urlWithLanguage.toString(),
      title: title,
      description: meta('og:description'),
      domain: urlWithLanguage.host,
      imagePath: selected?.path,
      imageAlt: meta('og:image:alt'),
      facebookUrl: this.getFacebookUrl(url),
      xUrl: this.getXUrl(url, title),
      languages: languages,
      hasMultipleLanguages: languages.length > 1,
    };
  },

  getFacebookUrl: function (url) {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  },

  getXUrl: function (url, title) {
    return `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  },

  // Swap the preview image and share links to the chosen language
  selectShareLanguage: function (evt) {
    const $button = this.$(evt.currentTarget);

    this.$('.share-language-button').attr('aria-pressed', 'false');
    $button.attr('aria-pressed', 'true');

    this.$('.share-preview-image').attr('src', $button.data('image-path'));
    this.$('.share-button-facebook').attr('href', $button.data('facebook-url'));
    this.$('.share-button-x').attr('href', $button.data('x-url'));
    this.clearCopyStatus();
  },

  copyShareLink: async function (evt) {
    const $status = this.$('.share-copy-status');
    const url = this.$(evt.currentTarget).data('url');

    this.clearCopyStatus();

    try {
      await navigator.clipboard.writeText(url);
      $status.text($status.data('copied-message'));

      // Hide the success message after a few seconds
      this.copyStatusTimeout = setTimeout(() => this.clearCopyStatus(), 3000);
    } catch (error) {
      console.error('Error copying share link:', error);
      $status.text($status.data('failed-message'));
    }
  },

  clearCopyStatus: function () {
    clearTimeout(this.copyStatusTimeout);
    this.$('.share-copy-status').text('');
  },

  submitSurvey: async function(evt) {
    evt.preventDefault();

    const endpoint = Shareabouts.bootstrapped.submitSurveyEndpoint;
    const formData = new FormData(evt.currentTarget);
    const surveyData = Object.fromEntries(formData.entries());

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(surveyData)
      });

      if (response.status >= 500) {
        return await this.onSubmitSurveyServerError(response);
      }

      else if (response.status === 409) {
        return await this.onSubmitSurveyDuplicateError(response);
      }

      else if (response.status === 403) {
        return await this.onSubmitSurveyUnverifiedError(response);
      }

      else if (response.status >= 400) {
        return await this.onSubmitSurveyClientError(response);
      }

      else if (response.ok) {
        return await this.onSubmitSurveySuccess(response);
      }

    } catch (error) {
      console.error('Error submitting survey:', error);
      alert('Something went wrong while submitting your survey.');
    }
  },

  endVoterSession: async function () {
    await fetch(Shareabouts.bootstrapped.unverifyVoterEndpoint, {
      method: 'POST'
    });

    this.app.setVoterVerified(false);
    this.app.clearVoterData();
  },

  // Stay on the page after the survey is done and scroll to promo screen
  showSurveyComplete: function () {
    this.$('#submit-survey').prop('disabled', true);
    this.$('.survey-submitted-message').prop('hidden', false);
    this.$('.share-promo')[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  onSubmitSurveySuccess: async function (response) {
    await this.endVoterSession();
    this.showSurveyComplete();
  },

  onSubmitSurveyClientError: async function (response) {
    const data = await response.json();
    alert(data.label || 'Unknown error');
  },

  onSubmitSurveyServerError: async function (response) {
    const data = await response.json();
    alert('Something went wrong while submitting your survey. Please try again later.');
  },

  onSubmitSurveyDuplicateError: async function (response) {
    const data = await response.json();
    alert('It looks like you have already submitted a survey.');
    await this.endVoterSession();
    this.showSurveyComplete();
  },

  onSubmitSurveyUnverifiedError: async function (response) {
    const data = await response.json();
    alert('It looks like you are not verified as a voter.');
  },

});