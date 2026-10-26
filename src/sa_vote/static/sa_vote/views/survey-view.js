export const SurveyView = Backbone.View.extend({
  events: {
    'submit #survey-form': 'submitSurvey',
    'click .share-language-button': 'selectShareLanguage',
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
    const selectedCode = new URL(url).searchParams.get('language');

    // One share option per language image. Each shares a URL with its own
    // language, so the scraped OpenGraph image matches the selected preview.
    const languages = (Shareabouts.bootstrapped.shareImages || []).map((image) => {
      const languageUrl = new URL(url);
      languageUrl.searchParams.set('language', image.code);
      return {
        code: image.code,
        label: image.label,
        imagePath: image.path,
        selected: image.code === selectedCode,
        facebookUrl: this.getFacebookUrl(languageUrl.href),
        xUrl: this.getXUrl(languageUrl.href, title),
      };
    });

    return {
      url: url,
      title: title,
      description: meta('og:description'),
      domain: new URL(url).host,
      imagePath: new URL(meta('og:image')).pathname,
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