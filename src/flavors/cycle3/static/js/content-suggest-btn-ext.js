// Add a "Share an Idea" button to the top of the content area, across from the
// "Close" button when on mobile. This makes it so that there's always a way to
// share an idea without having to close the content area first.

(function () {
  const contentSuggestButtonTemplate = Handlebars.templates['content-suggest-button'];
  const contentSuggestButton = contentSuggestButtonTemplate();

  document.querySelector('#content .close-btn').insertAdjacentHTML('afterend', contentSuggestButton);
})();