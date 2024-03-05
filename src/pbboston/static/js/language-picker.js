const showLanguagePickerButton = document.getElementById('show-language-picker-btn');
const hideLanguagePickerButton = document.getElementById('hide-language-picker-btn');
const languagePickerOverlay = document.querySelector('.language-picker__overlay');
const languageOptionBtns = document.querySelectorAll('.language-picker__option-btn');
const languagePickerWrapper = document.getElementById('language-picker-wrapper');

showLanguagePickerButton.addEventListener('click', showLanguagePicker);
hideLanguagePickerButton.addEventListener('click', hideLanguagePicker);
languagePickerOverlay.addEventListener('click', hideLanguagePicker);
languageOptionBtns.forEach(btn => btn.addEventListener('click', handleLanguageOptionClick));


function showLanguagePicker() {
  languagePickerWrapper.classList.remove('hidden');
  attachKeyboardCloseLanguagePicker();
  trapFocusInLanguagePicker();

  languageOptionBtns[0].focus();
}

function hideLanguagePicker() {
  releaseFocusFromLanguagePicker();
  detachKeyboardCloseLanguagePicker();
  languagePickerWrapper.classList.add('hidden');

  showLanguagePickerButton.focus();
}

function handleLanguageOptionClick(event) {
  const selectedLanguage = event.target.dataset.language;
  const pageUrl = window.location.href;
  const encodedPageUrl = encodeURIComponent(pageUrl);
  const translatedUrl = `https://translate.google.com/translate?hl=en&sl=en&u=${encodedPageUrl}&tl=${selectedLanguage}`
  window.location = translatedUrl;
}


/* Keyboard event listeners for language picker */
function attachKeyboardCloseLanguagePicker() {
  document.addEventListener('keydown', handleKeyboardCloseLanguagePicker);
}

function detachKeyboardCloseLanguagePicker() {
  document.removeEventListener('keydown', handleKeyboardCloseLanguagePicker);
}

function handleKeyboardCloseLanguagePicker(event) {
  if (event.key === 'Escape') {
    hideLanguagePicker();
  }
}


/* Focus trap outline borrowed from
   https://hidde.blog/using-javascript-to-trap-focus-in-an-element/ */

function trapFocusInLanguagePicker() {
  document.addEventListener('keydown', handleTrappedLanguagePickerFocus);
}

function releaseFocusFromLanguagePicker() {
  document.removeEventListener('keydown', handleTrappedLanguagePickerFocus);
}

const languagePickerFocussableElements = languagePickerWrapper.querySelectorAll('.language-picker__option-btn, #hide-language-picker-btn');
function handleTrappedLanguagePickerFocus(event) {
  const focusEls = languagePickerFocussableElements;
  const firstFocusEl = focusEls[0];
  const lastFocusEl = focusEls[focusEls.length - 1];

  if (event.key === 'Tab') {
    if (event.shiftKey) /* shift + tab */ {
      if (document.activeElement === firstFocusEl) {
        event.preventDefault();
        lastFocusEl.focus();
      }
    } else /* tab */ {
      if (document.activeElement === lastFocusEl) {
        event.preventDefault();
        firstFocusEl.focus();
      }
    }
  }
};
