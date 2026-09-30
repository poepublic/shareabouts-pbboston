<template>
  <div class="ballot-content-manager">
    <!-- Header Notification Banner -->
    <div v-if="notification" :class="['notification-banner', notification.type]">
      <span>{{ notification.message }}</span>
      <button class="close-notif-btn" @click="notification = null">×</button>
    </div>

    <!-- Main 2-Pane Layout -->
    <div class="editor-layout">
      <!-- Left Pane: Proposal Sidebar List Component -->
      <ProposalList
        :proposals="proposals"
        :active-proposal="activeProposal"
        :loading="loading"
        :supported-languages="supportedLanguages"
        :is-proposal-dirty="isProposalDirty"
        :format-number="formatNumber"
        :get-proposal-title="getProposalTitle"
        @select="selectProposal"
        @add="addNewProposal"
        @delete="confirmDeleteProposal"
      />

      <!-- Right Pane: WYSIWYG Workspace -->
      <main class="preview-workspace">
        <div v-if="!activeProposal" class="empty-selection">
          <p>Select a proposal from the left pane to edit, or click "+ Add a new ballot proposal".</p>
        </div>

        <div v-else class="mobile-editor-container">
          <!-- Top Action / Status Bar -->
          <div class="editor-top-bar">
            <!-- Language Selector Group (#175) -->
            <div class="lang-selector-group">
              <label for="ballot-lang-select" class="lang-select-label">Language:</label>
              <div class="select-wrapper">
                <select
                  id="ballot-lang-select"
                  v-model="activeLanguage"
                  class="lang-select-dropdown"
                  :class="{ 'has-missing': isTranslationMissing(activeProposal, activeLanguage) }"
                >
                  <option
                    v-for="lang in supportedLanguages"
                    :key="lang.code"
                    :value="lang.code"
                  >
                    {{ lang.label }} ({{ lang.code }}) {{ isTranslationMissing(activeProposal, lang.code) ? '⚠️ [missing]' : '✓' }}
                  </option>
                </select>
              </div>

              <!-- Auto-translate Button (#166 / #175) -->
              <button
                v-if="activeLanguage !== 'en'"
                class="auto-translate-btn"
                :disabled="isTranslating || !hasEnglishSource(activeProposal)"
                @click="handleAutoTranslate"
                :title="hasEnglishSource(activeProposal) ? `Auto-translate from English into ${getActiveLanguageLabel()}` : 'English title or content is required to auto-translate'"
              >
                <span v-if="isTranslating" class="spinner-sm"></span>
                <span v-else class="magic-icon">✨</span>
                {{ isTranslating ? 'Translating...' : 'Auto-translate' }}
              </button>

              <span v-if="isProposalDirty(activeProposal)" class="unsaved-changes-pill">
                Unsaved Edits
              </span>
            </div>

            <!-- Action Buttons: Discard & Save -->
            <div class="editor-actions">
              <span v-if="isSaving" class="status-indicator saving">Saving to GitHub...</span>
              <span v-else-if="saveSuccess" class="status-indicator success">Saved ✓</span>

              <!-- Discard / Reset button (#173) -->
              <button
                v-if="isProposalDirty(activeProposal)"
                class="reset-btn"
                :disabled="isSaving"
                @click="resetCurrentProposal"
                title="Discard unsaved local changes and revert to GitHub version"
              >
                Discard Changes
              </button>

              <button
                class="save-btn"
                :disabled="!canSave"
                @click="saveCurrentProposal"
                :title="saveButtonTitle"
              >
                <span class="save-icon">💾</span> Save Changes
              </button>
            </div>
          </div>

          <!-- WYSIWYG Ballot View Component -->
          <BallotWysiwygView
            :proposal="activeProposal"
            :active-language="activeLanguage"
            :supported-languages="supportedLanguages"
            :current-image-url="currentImageUrl"
            :is-field-dirty="isFieldDirty"
            :is-translation-missing="isTranslationMissing"
            :is-slug-duplicate="isSlugDuplicate"
            :format-number="formatNumber"
            :get-proposal-title="getProposalTitle"
            @title-input="onTitleInput"
            @slug-input="onSlugInput"
            @image-selected="onImageSelected"
          />
        </div>
      </main>
    </div>

    <!-- Conflict Resolution Modal (#173 / Task 2.3) -->
    <ConflictModal
      :show="showConflictModal"
      :head-proposal="conflictHeadProposal"
      :local-proposal="conflictLocalProposal"
      :format-number="formatNumber"
      @close="showConflictModal = false"
      @use-head="resolveConflictUseHead"
      @keep-local="resolveConflictKeepLocal"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import ProposalList from './components/ProposalList.vue';
import BallotWysiwygView from './components/BallotWysiwygView.vue';
import ConflictModal from './components/ConflictModal.vue';

const LOCAL_STORAGE_KEY = 'pbboston_ballot_drafts';

const DEFAULT_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'ht', label: 'Kreyòl Ayisyen' },
  { code: 'zh-hans', label: '简体中文' },
  { code: 'ar', label: 'العربية' },
  { code: 'pt-br', label: 'Português' },
  { code: 'so', label: 'Soomaali' },
  { code: 'vi', label: 'Tiếng Việt' },
];

const supportedLanguages = ref([...DEFAULT_LANGUAGES]);
const activeLanguage = ref('en');
const isTranslating = ref(false);

const proposals = ref([]);
const serverProposals = ref([]);
const activeProposal = ref(null);
const baseSha = ref('');
const loading = ref(true);
const isSaving = ref(false);
const saveSuccess = ref(false);
const notification = ref(null);

// Conflict resolution modal state (#173 / Task 2.3)
const showConflictModal = ref(false);
const conflictHeadProposal = ref(null);
const conflictLocalProposal = ref(null);

// -------------------------------------------------------------
// Language Helpers (#175)
// -------------------------------------------------------------
function getActiveLanguageLabel(lang = activeLanguage.value) {
  const match = supportedLanguages.value.find((l) => l.code === lang);
  return match ? match.label : lang.toUpperCase();
}

function isTranslationMissing(prop, langCode) {
  if (!prop || !prop.translations) return true;
  const t = prop.translations[langCode];
  if (!t) return true;
  return !(t.title && t.title.trim()) || !(t.content && t.content.trim());
}

function hasEnglishSource(prop) {
  if (!prop || !prop.translations?.en) return false;
  const en = prop.translations.en;
  return !!((en.title && en.title.trim()) || (en.content && en.content.trim()));
}

// -------------------------------------------------------------
// Slug Generation with Collision Resolution (Task 2.1)
// -------------------------------------------------------------
function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .substring(0, 50);
}

function generateUniqueSlug(title, currentSlug = null) {
  const base = slugify(title) || 'new-ballot-proposal';
  let candidate = base;
  let counter = 1;

  const existingSlugs = new Set(
    proposals.value
      .filter((p) => p.slug !== currentSlug)
      .map((p) => p.slug)
  );

  while (existingSlugs.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter++;
  }
  return candidate;
}

const isSlugDuplicate = computed(() => {
  if (!activeProposal.value || !activeProposal.value.slug) return false;
  const current = (activeProposal.value.slug || '').trim().toLowerCase();
  return proposals.value.some(
    (p) => p !== activeProposal.value && (p.slug || '').trim().toLowerCase() === current
  );
});

function onSlugInput() {
  if (activeProposal.value) {
    activeProposal.value.customSlugSet = true;
    const oldSlug = activeProposal.value.previous_slug;
    const newSlug = activeProposal.value.slug;
    if (oldSlug && oldSlug !== newSlug) {
      clearDraftForProposal(oldSlug);
      activeProposal.value.previous_slug = newSlug;
    }
  }
}

function onTitleInput() {
  // Only auto-update slug when editing the primary English title
  if (
    activeLanguage.value === 'en' &&
    activeProposal.value &&
    activeProposal.value.isNew &&
    !activeProposal.value.customSlugSet
  ) {
    const oldSlug = activeProposal.value.slug;
    const title = activeProposal.value.translations?.en?.title;
    const newSlug = generateUniqueSlug(title, activeProposal.value.slug);
    if (oldSlug !== newSlug) {
      clearDraftForProposal(oldSlug);
      activeProposal.value.slug = newSlug;
      activeProposal.value.previous_slug = newSlug;
    }
  }
}

// -------------------------------------------------------------
// Local Storage Persistence & Dirty State Tracking (Task 2.2 / 3.2)
// -------------------------------------------------------------
function getStoredDrafts() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('Failed to parse drafts from localStorage:', err);
    return {};
  }
}

function saveDrafts(drafts) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(drafts));
  } catch (err) {
    console.warn('Failed to save drafts to localStorage:', err);
  }
}

function updateDraftForProposal(prop) {
  if (!prop) return;
  const drafts = getStoredDrafts();

  if (prop.previous_slug && prop.previous_slug !== prop.slug) {
    delete drafts[prop.previous_slug];
    prop.previous_slug = prop.slug;
  }

  if (isProposalDirty(prop)) {
    drafts[prop.slug] = {
      slug: prop.slug,
      original_slug: prop.original_slug,
      previous_slug: prop.slug,
      info: JSON.parse(JSON.stringify(prop.info || {})),
      translations: JSON.parse(JSON.stringify(prop.translations || {})),
      pendingImage: prop.pendingImage ? {
        filename: prop.pendingImage.filename,
        dataUrl: prop.pendingImage.dataUrl,
      } : null,
      isNew: !!prop.isNew,
      customSlugSet: !!prop.customSlugSet,
    };
  } else {
    delete drafts[prop.slug];
    if (prop.original_slug) delete drafts[prop.original_slug];
  }
  saveDrafts(drafts);
}

function clearDraftForProposal(slug) {
  if (!slug) return;
  const drafts = getStoredDrafts();
  if (drafts[slug]) {
    delete drafts[slug];
    saveDrafts(drafts);
  }
}

function getServerProposal(propOrSlug) {
  if (!propOrSlug) return null;
  if (typeof propOrSlug === 'string') {
    return serverProposals.value.find((p) => p.slug === propOrSlug);
  }
  const lookup = propOrSlug.original_slug || propOrSlug.slug;
  return serverProposals.value.find((p) => p.slug === lookup);
}

function isFieldDirty(prop, field, lang = activeLanguage.value) {
  if (!prop) return false;
  if (prop.isNew) return true;
  const server = getServerProposal(prop);
  if (!server) return true;

  switch (field) {
    case 'slug':
      return prop.slug !== server.slug;
    case 'amount':
      return Number(prop.info?.amount || 0) !== Number(server.info?.amount || 0);
    case 'image':
      return (prop.info?.image || '') !== (server.info?.image || '') || !!prop.pendingImage;
    case 'title':
      return (prop.translations?.[lang]?.title || '') !== (server.translations?.[lang]?.title || '');
    case 'content':
      return (prop.translations?.[lang]?.content || '') !== (server.translations?.[lang]?.content || '');
    case 'image_alt':
      return (prop.translations?.[lang]?.image_alt || '') !== (server.translations?.[lang]?.image_alt || '');
    default:
      return false;
  }
}

function isProposalDirty(prop) {
  if (!prop) return false;
  if (prop.isNew) return true;
  const server = getServerProposal(prop);
  if (!server) return true;

  if (isFieldDirty(prop, 'slug') || isFieldDirty(prop, 'amount') || isFieldDirty(prop, 'image')) {
    return true;
  }

  // Check dirty across all languages
  const allLangs = new Set([
    ...Object.keys(prop.translations || {}),
    ...Object.keys(server.translations || {}),
    ...supportedLanguages.value.map((l) => l.code),
  ]);

  for (const lang of allLangs) {
    if (
      isFieldDirty(prop, 'title', lang) ||
      isFieldDirty(prop, 'content', lang) ||
      isFieldDirty(prop, 'image_alt', lang)
    ) {
      return true;
    }
  }

  return false;
}

const canSave = computed(() => {
  if (isSaving.value) return false;
  if (isSlugDuplicate.value) return false;
  if (!activeProposal.value) return false;
  return isProposalDirty(activeProposal.value);
});

const saveButtonTitle = computed(() => {
  if (isSlugDuplicate.value) {
    return 'Cannot save: slug is already in use by another proposal';
  }
  if (!activeProposal.value || !isProposalDirty(activeProposal.value)) {
    return 'No unsaved changes to save';
  }
  return 'Save changes to GitHub';
});

// Reset / Discard changes to proposal (#173)
function resetCurrentProposal() {
  if (!activeProposal.value) return;
  const title = getProposalTitle(activeProposal.value);
  if (!confirm(`Are you sure you want to discard unsaved changes to "${title}"?`)) {
    return;
  }

  const currentSlug = activeProposal.value.slug;
  const originalSlug = activeProposal.value.original_slug;
  const previousSlug = activeProposal.value.previous_slug;

  clearDraftForProposal(currentSlug);
  if (previousSlug) clearDraftForProposal(previousSlug);
  if (originalSlug) clearDraftForProposal(originalSlug);

  if (activeProposal.value.isNew) {
    proposals.value = proposals.value.filter((p) => p !== activeProposal.value);
    activeProposal.value = proposals.value[0] || null;
    notification.value = {
      type: 'warning',
      message: `Discarded new proposal "${title}".`,
    };
    return;
  }

  const server = getServerProposal(activeProposal.value);
  if (server) {
    activeProposal.value.slug = server.slug;
    activeProposal.value.original_slug = server.slug;
    activeProposal.value.previous_slug = server.slug;
    activeProposal.value.info = JSON.parse(JSON.stringify(server.info || {}));
    activeProposal.value.translations = JSON.parse(JSON.stringify(server.translations || {}));
    activeProposal.value.pendingImage = null;
    activeProposal.value.customSlugSet = false;

    const idx = proposals.value.findIndex(
      (p) => p === activeProposal.value || p.slug === currentSlug || (originalSlug && p.slug === originalSlug)
    );
    if (idx !== -1) {
      proposals.value[idx] = activeProposal.value;
    }

    notification.value = {
      type: 'success',
      message: `Reverted "${title}" to the version saved on GitHub.`,
    };
  }
}

// -------------------------------------------------------------
// Format Utilities
// -------------------------------------------------------------
function getProposalTitle(prop, lang = activeLanguage.value) {
  if (!prop) return '';
  return (
    prop.translations?.[lang]?.title ||
    prop.translations?.en?.title ||
    prop.slug ||
    '(Untitled Proposal)'
  );
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString();
}

const currentImageUrl = computed(() => {
  if (!activeProposal.value) return '';
  if (activeProposal.value.pendingImage?.dataUrl) {
    return activeProposal.value.pendingImage.dataUrl;
  }
  const imgPath = activeProposal.value.info?.image || '';
  if (imgPath.startsWith('/static/ballot/')) {
    const filename = imgPath.slice('/static/ballot/'.length);
    return `/admin/ballot/images/${filename}`;
  }
  if (imgPath.startsWith('static/ballot/')) {
    const filename = imgPath.slice('static/ballot/'.length);
    return `/admin/ballot/images/${filename}`;
  }
  return imgPath;
});

// -------------------------------------------------------------
// Automated Translation Service Integration (#166 / #175)
// -------------------------------------------------------------
async function handleAutoTranslate() {
  if (!activeProposal.value || activeLanguage.value === 'en') return;

  const targetLang = activeLanguage.value;
  const targetLabel = getActiveLanguageLabel(targetLang);
  const enTrans = activeProposal.value.translations?.en || {};

  if (!enTrans.title && !enTrans.content) {
    notification.value = {
      type: 'warning',
      message: 'English proposal title or description is required to generate translations.',
    };
    return;
  }

  const existingTarget = activeProposal.value.translations?.[targetLang];
  if (existingTarget && ((existingTarget.title && existingTarget.title.trim()) || (existingTarget.content && existingTarget.content.trim()))) {
    if (
      !confirm(
        `Note: Using automatic translation will override manual translations for ${targetLabel}. Are you sure you want to proceed?`
      )
    ) {
      return;
    }
  }

  isTranslating.value = true;
  notification.value = null;

  try {
    const payload = {
      target_language: targetLang,
      source_language: 'en',
      texts: {
        title: enTrans.title || '',
        content: enTrans.content || '',
        image_alt: enTrans.image_alt || '',
      },
    };

    const res = await fetch('/admin/ballot/translate/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    if (!activeProposal.value.translations) {
      activeProposal.value.translations = {};
    }
    activeProposal.value.translations[targetLang] = {
      language: targetLang,
      title: data.translations?.title || '',
      content: data.translations?.content || '',
      image_alt: data.translations?.image_alt || '',
    };

    updateDraftForProposal(activeProposal.value);

    notification.value = {
      type: 'success',
      message: `Successfully auto-translated proposal into ${targetLabel}! Changes are stored locally; click "Save Changes" to commit.`,
    };
  } catch (err) {
    console.error('Translation error:', err);
    notification.value = {
      type: 'error',
      message: `Failed to translate proposal: ${err.message}`,
    };
  } finally {
    isTranslating.value = false;
  }
}

// -------------------------------------------------------------
// Load Proposals with LocalStorage Drafts Rehydration
// -------------------------------------------------------------
async function loadProposals() {
  loading.value = true;
  try {
    const res = await fetch('/admin/ballot/proposals/', {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    });
    if (!res.ok) {
      throw new Error(`Failed to load proposals: HTTP ${res.status}`);
    }
    const data = await res.json();
    baseSha.value = data.head_sha || data.tree_sha;

    if (data.languages && Array.isArray(data.languages) && data.languages.length > 0) {
      supportedLanguages.value = data.languages;
    }

    // Deep clone server proposals for baseline dirty comparison
    serverProposals.value = (data.proposals || []).map((p) => normalizeProposal(JSON.parse(JSON.stringify(p))));
    const workingProposals = (data.proposals || []).map((p) => normalizeProposal(JSON.parse(JSON.stringify(p))));

    // Rehydrate local storage drafts
    const drafts = getStoredDrafts();
    for (const prop of workingProposals) {
      // Find matching draft by either current slug or original_slug
      const draftKey = Object.keys(drafts).find(
        (key) => key === prop.slug || drafts[key]?.original_slug === prop.slug
      );
      if (draftKey && drafts[draftKey]) {
        const draft = drafts[draftKey];
        if (draft.slug && draft.slug !== prop.slug) {
          prop.slug = draft.slug;
          prop.previous_slug = draft.slug;
        }
        prop.info = { ...prop.info, ...(draft.info || {}) };
        prop.translations = { ...prop.translations, ...(draft.translations || {}) };
        if (draft.pendingImage) prop.pendingImage = draft.pendingImage;
        if (draft.customSlugSet) prop.customSlugSet = true;
      }
    }

    // Add any drafts that were newly created proposals not yet on server
    for (const [slug, draft] of Object.entries(drafts)) {
      if (
        draft.isNew &&
        !workingProposals.some((p) => p.slug === slug || (draft.original_slug && p.original_slug === draft.original_slug))
      ) {
        workingProposals.unshift(
          normalizeProposal({
            ...draft,
            isNew: true,
          })
        );
      }
    }

    proposals.value = workingProposals;

    if (proposals.value.length > 0) {
      const currentSlug = activeProposal.value?.slug;
      const found = proposals.value.find((p) => p.slug === currentSlug);
      activeProposal.value = found || proposals.value[0];
    } else {
      activeProposal.value = null;
    }
  } catch (err) {
    console.error('Error loading proposals:', err);
    notification.value = {
      type: 'error',
      message: `Failed to load proposals from GitHub: ${err.message}`,
    };
  } finally {
    loading.value = false;
  }
}

function normalizeProposal(raw) {
  const translations = {};
  if (raw.translations) {
    for (const [lang, t] of Object.entries(raw.translations)) {
      translations[lang] = {
        language: t.language || lang,
        title: t.title || '',
        image_alt: t.image_alt || '',
        content: t.content || '',
      };
    }
  }
  if (!translations.en) {
    translations.en = {
      language: 'en',
      title: '',
      image_alt: '',
      content: '',
    };
  }

  const prop = {
    slug: raw.slug || '',
    original_slug: raw.original_slug !== undefined ? raw.original_slug : (raw.isNew ? null : raw.slug || null),
    previous_slug: raw.previous_slug || raw.slug || '',
    info: {
      amount: raw.info?.amount ?? 100000,
      image: raw.info?.image || '',
      ...(raw.info || {}),
    },
    translations,
    files: raw.files || {},
    isNew: !!raw.isNew,
    customSlugSet: !!raw.customSlugSet,
    pendingImage: raw.pendingImage || null,
  };
  return prop;
}

function selectProposal(prop) {
  activeProposal.value = prop;
  saveSuccess.value = false;
}

function addNewProposal() {
  const newSlug = generateUniqueSlug('New Ballot Proposal');
  const newProp = {
    slug: newSlug,
    original_slug: null,
    previous_slug: newSlug,
    info: {
      amount: 100000,
      image: '',
    },
    translations: {
      en: {
        language: 'en',
        title: 'New Ballot Proposal',
        image_alt: '',
        content: '',
      },
    },
    files: {},
    isNew: true,
    customSlugSet: false,
    pendingImage: null,
  };

  proposals.value.unshift(newProp);
  activeProposal.value = newProp;
  activeLanguage.value = 'en';
  saveSuccess.value = false;
  updateDraftForProposal(newProp);
}

function resizeImageIfNeeded(file, maxWidth = 800) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for resizing.'));
      img.onload = () => {
        if (img.width <= maxWidth) {
          resolve(e.target.result);
          return;
        }

        const scale = maxWidth / img.width;
        const targetWidth = maxWidth;
        const targetHeight = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const mimeType = file.type || 'image/jpeg';
        const quality = mimeType === 'image/png' ? undefined : 0.85;
        const resizedDataUrl = canvas.toDataURL(mimeType, quality);
        resolve(resizedDataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function onImageSelected(file) {
  if (!file || !activeProposal.value) return;

  try {
    const dataUrl = await resizeImageIfNeeded(file, 800);
    let extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
    if (extension === 'jpeg') extension = 'jpg';
    const filename = `${activeProposal.value.slug || 'proposal'}-${Date.now()}.${extension}`;

    activeProposal.value.pendingImage = {
      filename: filename,
      dataUrl: dataUrl,
    };
    activeProposal.value.info.image = `/static/ballot/${filename}`;
    updateDraftForProposal(activeProposal.value);
  } catch (err) {
    console.error('Failed to process image:', err);
    notification.value = {
      type: 'error',
      message: `Failed to process image: ${err.message || err}`,
    };
  }
}

// -------------------------------------------------------------
// Save Proposal to GitHub & Conflict Handling (Task 2.3 / 3.2)
// -------------------------------------------------------------
async function saveCurrentProposal() {
  if (!activeProposal.value || !canSave.value) return;

  if (isSlugDuplicate.value) {
    notification.value = {
      type: 'error',
      message: `Cannot save: slug "${activeProposal.value.slug}" is already in use by another proposal.`,
    };
    return;
  }

  isSaving.value = true;
  saveSuccess.value = false;
  notification.value = null;

  try {
    const prop = activeProposal.value;

    // Serialize all language translations that have data (#175)
    const translationsPayload = {};
    const allLangs = new Set([
      'en',
      ...Object.keys(prop.translations || {}),
    ]);

    for (const lang of allLangs) {
      const t = prop.translations?.[lang];
      if (t && (t.title || t.content || t.image_alt || lang === 'en')) {
        translationsPayload[lang] = {
          language: lang,
          title: t.title || '',
          content: t.content || '',
          image_alt: t.image_alt || '',
        };
      }
    }

    const payload = {
      base_sha: baseSha.value,
      slug: prop.slug,
      original_slug: prop.isNew ? null : prop.original_slug,
      is_new: !!prop.isNew,
      info: {
        amount: parseInt(prop.info.amount, 10) || 0,
        image: prop.info.image || '',
      },
      translations: translationsPayload,
      images: prop.pendingImage ? [{
        filename: prop.pendingImage.filename,
        content_base64: prop.pendingImage.dataUrl,
      }] : [],
    };

    const res = await fetch('/admin/ballot/proposals/save/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    // 409 Conflict Handling (#173 / Task 2.3)
    if (res.status === 409) {
      const currentLocalCopy = JSON.parse(JSON.stringify(prop));
      conflictLocalProposal.value = currentLocalCopy;

      // Re-fetch current server state
      const freshRes = await fetch('/admin/ballot/proposals/', {
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin',
      });
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        baseSha.value = freshData.head_sha || freshData.tree_sha;
        serverProposals.value = (freshData.proposals || []).map(normalizeProposal);
        conflictHeadProposal.value = serverProposals.value.find((p) => p.slug === (prop.original_slug || prop.slug)) || null;
      }
      showConflictModal.value = true;
      return;
    }

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    // Success: update base_sha with new commit SHA
    baseSha.value = data.commit_sha || data.head_sha || baseSha.value;

    // Clear drafts for all versions of this slug
    clearDraftForProposal(prop.slug);
    if (prop.original_slug) clearDraftForProposal(prop.original_slug);
    if (prop.previous_slug) clearDraftForProposal(prop.previous_slug);

    const oldOriginalSlug = prop.original_slug;
    prop.isNew = false;
    prop.original_slug = prop.slug;
    prop.previous_slug = prop.slug;
    prop.pendingImage = null;

    // Update server baseline so dirty highlight clears
    const updatedServerCopy = normalizeProposal(JSON.parse(JSON.stringify(prop)));
    const serverIdx = serverProposals.value.findIndex(
      (p) => p.slug === prop.slug || (oldOriginalSlug && p.slug === oldOriginalSlug)
    );
    if (serverIdx !== -1) {
      serverProposals.value[serverIdx] = updatedServerCopy;
    } else {
      serverProposals.value.unshift(updatedServerCopy);
    }

    saveSuccess.value = true;

    notification.value = {
      type: 'success',
      message: `Proposal "${getProposalTitle(prop, activeLanguage.value)}" (${prop.slug}) saved successfully!`,
    };

    setTimeout(() => {
      saveSuccess.value = false;
    }, 4000);
  } catch (err) {
    console.error('Error saving proposal:', err);
    notification.value = {
      type: 'error',
      message: `Failed to commit proposal changes: ${err.message}`,
    };
  } finally {
    isSaving.value = false;
  }
}

// Conflict Resolution Actions (#173)
function resolveConflictKeepLocal() {
  showConflictModal.value = false;
  notification.value = {
    type: 'warning',
    message: 'Loaded the latest repository state. You kept your local edits; click "Save Changes" to commit them on top of the latest HEAD.',
  };
}

function resolveConflictUseHead() {
  if (conflictHeadProposal.value && activeProposal.value) {
    const head = conflictHeadProposal.value;
    activeProposal.value.slug = head.slug;
    activeProposal.value.original_slug = head.slug;
    activeProposal.value.previous_slug = head.slug;
    activeProposal.value.info = JSON.parse(JSON.stringify(head.info || {}));
    activeProposal.value.translations = JSON.parse(JSON.stringify(head.translations || {}));
    activeProposal.value.pendingImage = null;
    clearDraftForProposal(activeProposal.value.slug);
  }
  showConflictModal.value = false;
  notification.value = {
    type: 'success',
    message: 'Reverted to the latest version from GitHub.',
  };
}

async function confirmDeleteProposal(prop) {
  const title = getProposalTitle(prop);
  if (!confirm(`Are you sure you want to delete proposal "${title}"?`)) {
    return;
  }

  // Clear any draft from localStorage
  clearDraftForProposal(prop.slug);

  if (prop.isNew) {
    proposals.value = proposals.value.filter((p) => p.slug !== prop.slug);
    if (activeProposal.value?.slug === prop.slug) {
      activeProposal.value = proposals.value[0] || null;
    }
    return;
  }

  isSaving.value = true;
  notification.value = null;

  try {
    const payload = {
      base_sha: baseSha.value,
      delete_slug: prop.slug,
      files_to_delete: Object.keys(prop.files || {}),
      message: `Delete proposal ${prop.slug}`,
    };

    const res = await fetch('/admin/ballot/proposals/save/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    baseSha.value = data.commit_sha || data.head_sha || baseSha.value;
    proposals.value = proposals.value.filter((p) => p.slug !== prop.slug);
    serverProposals.value = serverProposals.value.filter((p) => p.slug !== prop.slug);
    if (activeProposal.value?.slug === prop.slug) {
      activeProposal.value = proposals.value[0] || null;
    }

    notification.value = {
      type: 'success',
      message: `Deleted proposal "${title}" from repository.`,
    };
  } catch (err) {
    console.error('Error deleting proposal:', err);
    notification.value = {
      type: 'error',
      message: `Failed to delete proposal: ${err.message}`,
    };
  } finally {
    isSaving.value = false;
  }
}

// Watch active proposal changes to persist to localStorage
watch(
  () => activeProposal.value,
  (newVal) => {
    if (newVal) {
      updateDraftForProposal(newVal);
    }
  },
  { deep: true }
);

onMounted(() => {
  loadProposals();
});
</script>

<style scoped>
.ballot-content-manager {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 70px);
  background-color: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* Notification banner */
.notification-banner {
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.95rem;
  font-weight: 500;
}
.notification-banner.success {
  background-color: #d4edda;
  color: #155724;
  border-bottom: 1px solid #c3e6cb;
}
.notification-banner.error {
  background-color: #f8d7da;
  color: #721c24;
  border-bottom: 1px solid #f5c6cb;
}
.notification-banner.warning {
  background-color: #fff3cd;
  color: #856404;
  border-bottom: 1px solid #ffeeba;
}
.close-notif-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: inherit;
}

/* 2-Pane Layout */
.editor-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Right Pane: Preview Workspace */
.preview-workspace {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background-color: #eaedf1;
}

.empty-selection {
  margin-top: 60px;
  color: #6c757d;
  font-size: 1.1rem;
}

/* Mobile Editor Container */
.mobile-editor-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 440px;
  gap: 14px;
  margin: 0 auto;
}

/* Top Action / Status Bar */
.editor-top-bar {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

/* Language Selector Group (#175) */
.lang-selector-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.lang-select-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
}

.select-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.lang-select-dropdown {
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e293b;
  cursor: pointer;
  outline: none;
  transition: all 0.2s;
}

.lang-select-dropdown:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.lang-select-dropdown.has-missing {
  border-color: #f59e0b;
  background-color: #fffbeb;
  color: #92400e;
}

.auto-translate-btn {
  background-color: #7c3aed;
  color: #ffffff;
  border: none;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: background-color 0.2s, opacity 0.2s;
}

.auto-translate-btn:hover:not(:disabled) {
  background-color: #6d28d9;
}

.auto-translate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.magic-icon {
  font-size: 0.85rem;
}

.spinner-sm {
  width: 12px;
  height: 12px;
  border: 2px solid #ffffff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.unsaved-changes-pill {
  background-color: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}

.editor-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-indicator {
  font-size: 0.85rem;
  font-weight: 500;
}
.status-indicator.saving {
  color: #007bff;
}
.status-indicator.success {
  color: #28a745;
}

.reset-btn {
  background-color: #ffffff;
  color: #64748b;
  border: 1px solid #cbd5e1;
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}
.reset-btn:hover:not(:disabled) {
  background-color: #fee2e2;
  color: #b91c1c;
  border-color: #fca5a5;
}

.save-btn {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 6px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.2s;
}

.save-btn:hover:not(:disabled) {
  background-color: #0056b3;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
