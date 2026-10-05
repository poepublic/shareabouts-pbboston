<template>
  <div class="ballot-content-manager">
    <!-- Header Notification Banner -->
    <div v-if="notification" class="banner" :data-state="notification.type">
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
        :dirty-count="dirtyCount"
        :is-saving="isSaving"
        :supported-languages="supportedLanguages"
        :is-proposal-dirty="isProposalDirty"
        :format-number="formatNumber"
        :get-proposal-title="getProposalTitle"
        @select="selectProposal"
        @add="addNewProposal"
        @delete="confirmDeleteProposal"
        @discard-all="confirmDiscardAll"
        @save-all="saveAllProposals"
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
                  :class="{
                    'has-missing': isTranslationMissing(activeProposal, activeLanguage),
                    'other-lang-dirty': isOtherLanguageDirty,
                  }"
                >
                  <option
                    v-for="lang in supportedLanguages"
                    :key="lang.code"
                    :value="lang.code"
                  >
                    {{ getLanguageOptionLabel(lang) }}
                  </option>
                </select>
              </div>
            </div>

            <span v-if="isProposalDirty(activeProposal)" class="pill" data-state="warning">Unsaved Edits</span>
            <span v-if="isSaving" class="status-indicator saving">Saving to GitHub...</span>
            <span v-else-if="saveSuccess" class="status-indicator success">Saved ✓</span>

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

        <!-- Action Buttons: Translate, Discard & Save -->
        <div v-if="activeProposal" class="editor-actions">
          <!-- Auto-translate Button (#166 / #175 / Multi-language Translation) -->
          <button
            class="button auto-translate-btn"
            data-variant="accent"
            :disabled="isTranslating || !hasSourceContent(activeProposal)"
            @click="showTranslateModal = true"
            :title="hasSourceContent(activeProposal) ? 'Auto-translate proposal into multiple languages' : 'Proposal title or description is required to translate'"
          >
            <span v-if="isTranslating" class="spinner-sm"></span>
            <span v-else class="magic-icon">✨</span>
            {{ isTranslating ? 'Translating...' : 'Auto-translate' }}
          </button>

          <button
            class="button save-btn"
            data-variant="primary"
            :disabled="!canSave"
            @click="saveCurrentProposal"
            :title="saveButtonTitle"
          >
            <span class="save-icon">💾</span> Save Changes
          </button>

          <!-- Discard / Reset button (#173) -->
          <button
            v-if="isProposalDirty(activeProposal)"
            class="button reset-btn"
            data-variant="danger"
            :disabled="isSaving"
            @click="resetCurrentProposal"
            title="Discard unsaved local changes and revert to GitHub version"
          >
            Discard Changes
          </button>
        </div>
      </main>
    </div>

    <!-- Conflict Resolution Modal (#173 / Task 2.3) -->
    <ConflictModal
      :show="showConflictModal"
      :conflicts="conflictedQueue"
      :head-proposal="conflictHeadProposal"
      :local-proposal="conflictLocalProposal"
      :format-number="formatNumber"
      @close="showConflictModal = false"
      @use-head="resolveConflictUseHead"
      @keep-local="resolveConflictKeepLocal"
      @all-resolved="onAllConflictsResolved"
    />

    <!-- Multi-Language Translation Modal -->
    <TranslateModal
      :show="showTranslateModal"
      :proposal="activeProposal"
      :supported-languages="supportedLanguages"
      :is-translating="isTranslating"
      @close="showTranslateModal = false"
      @translate="handleBatchTranslate"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import ProposalList from './components/ProposalList.vue';
import BallotWysiwygView from './components/BallotWysiwygView.vue';
import ConflictModal from './components/ConflictModal.vue';
import TranslateModal from './components/TranslateModal.vue';

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
const conflictedQueue = ref([]);

// Batch translation modal state
const showTranslateModal = ref(false);

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

function hasSourceContent(prop) {
  if (!prop || !prop.translations) return false;
  return Object.values(prop.translations).some(
    (t) => (t.title && t.title.trim()) || (t.content && t.content.trim())
  );
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

function isLanguageDirty(prop, lang) {
  if (!prop) return false;
  if (prop.isNew) {
    const t = prop.translations?.[lang];
    if (!t) return false;
    return !!(
      (t.title && t.title.trim()) ||
      (t.content && t.content.trim()) ||
      (t.image_alt && t.image_alt.trim())
    );
  }
  const server = getServerProposal(prop);
  if (!server) return false;
  return (
    isFieldDirty(prop, 'title', lang) ||
    isFieldDirty(prop, 'content', lang) ||
    isFieldDirty(prop, 'image_alt', lang)
  );
}

const isOtherLanguageDirty = computed(() => {
  if (!activeProposal.value) return false;
  return supportedLanguages.value.some(
    (lang) => lang.code !== activeLanguage.value && isLanguageDirty(activeProposal.value, lang.code)
  );
});

function getLanguageOptionLabel(lang) {
  if (!activeProposal.value) {
    return `${lang.label} (${lang.code})`;
  }
  if (isLanguageDirty(activeProposal.value, lang.code)) {
    return `${lang.label} (${lang.code}) •`;
  }
  if (isTranslationMissing(activeProposal.value, lang.code)) {
    return `${lang.label} (${lang.code}) ⚠️ [missing]`;
  }
  return `${lang.label} (${lang.code}) ✓`;
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
    if (isLanguageDirty(prop, lang)) {
      return true;
    }
  }

  return false;
}

const dirtyProposals = computed(() => {
  return proposals.value.filter((p) => isProposalDirty(p));
});

const dirtyCount = computed(() => dirtyProposals.value.length);

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

// Discard all unsaved changes across all proposals
function confirmDiscardAll() {
  const count = dirtyCount.value;
  if (count === 0) return;

  const msg = `Are you sure you want to discard unsaved changes across ${count} proposal${count === 1 ? '' : 's'}? This action cannot be undone.`;
  if (!confirm(msg)) {
    return;
  }

  for (const prop of dirtyProposals.value) {
    if (prop.slug) clearDraftForProposal(prop.slug);
    if (prop.previous_slug) clearDraftForProposal(prop.previous_slug);
    if (prop.original_slug) clearDraftForProposal(prop.original_slug);
  }

  proposals.value = proposals.value.filter((p) => !p.isNew);

  for (let i = 0; i < proposals.value.length; i++) {
    const prop = proposals.value[i];
    const server = getServerProposal(prop);
    if (server) {
      proposals.value[i] = normalizeProposal(JSON.parse(JSON.stringify(server)));
    }
  }

  if (activeProposal.value) {
    const currentActiveSlug = activeProposal.value.original_slug || activeProposal.value.slug;
    const restored = proposals.value.find((p) => p.slug === currentActiveSlug);
    activeProposal.value = restored || proposals.value[0] || null;
  } else {
    activeProposal.value = proposals.value[0] || null;
  }

  notification.value = {
    type: 'warning',
    message: `Discarded all unsaved changes across ${count} proposal${count === 1 ? '' : 's'}.`,
  };
}

// -------------------------------------------------------------
// Format Utilities
// -------------------------------------------------------------
function getProposalTitle(prop, lang = 'en') {
  if (!prop) return '';
  return (
    prop.translations?.[lang]?.title?.trim() ||
    prop.translations?.en?.title?.trim() ||
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
// Automated Batch Translation Service Integration (#166 / #175)
// -------------------------------------------------------------
async function handleBatchTranslate({ sourceLanguage, targetLanguages, fields }) {
  if (!activeProposal.value || !targetLanguages || targetLanguages.length === 0) return;

  const sourceTrans = activeProposal.value.translations?.[sourceLanguage] || {};
  const texts = {};
  if (fields.title) texts.title = sourceTrans.title || '';
  if (fields.content) texts.content = sourceTrans.content || '';
  if (fields.image_alt) texts.image_alt = sourceTrans.image_alt || '';

  const hasTextToTranslate = Object.values(texts).some((v) => v && v.trim());
  if (!hasTextToTranslate) {
    notification.value = {
      type: 'warning',
      message: `Source language (${sourceLanguage}) does not contain text for the selected fields.`,
    };
    return;
  }

  isTranslating.value = true;
  notification.value = null;

  try {
    const fetchPromises = targetLanguages.map(async (targetLang) => {
      const payload = {
        target_language: targetLang,
        source_language: sourceLanguage,
        texts,
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
      return { targetLang, translations: data.translations };
    });

    const results = await Promise.allSettled(fetchPromises);

    if (!activeProposal.value.translations) {
      activeProposal.value.translations = {};
    }

    let successCount = 0;
    const failedLangs = [];

    results.forEach((result, idx) => {
      const targetLang = targetLanguages[idx];
      if (result.status === 'fulfilled') {
        const { translations } = result.value;
        const currentTrans = activeProposal.value.translations[targetLang] || { language: targetLang };

        activeProposal.value.translations[targetLang] = {
          ...currentTrans,
          language: targetLang,
          ...(fields.title && translations?.title !== undefined ? { title: translations.title } : {}),
          ...(fields.content && translations?.content !== undefined ? { content: translations.content } : {}),
          ...(fields.image_alt && translations?.image_alt !== undefined ? { image_alt: translations.image_alt } : {}),
        };
        successCount++;
      } else {
        const targetLabel = getActiveLanguageLabel(targetLang);
        failedLangs.push(`${targetLabel} (${result.reason?.message || 'Error'})`);
      }
    });

    if (successCount > 0) {
      updateDraftForProposal(activeProposal.value);
    }

    if (failedLangs.length === 0) {
      notification.value = {
        type: 'success',
        message: `Successfully auto-translated proposal into ${successCount} language(s)! Changes are stored locally; click "Save Changes" to commit.`,
      };
      showTranslateModal.value = false;
    } else if (successCount > 0) {
      notification.value = {
        type: 'warning',
        message: `Translated into ${successCount} language(s), but failed for: ${failedLangs.join(', ')}.`,
      };
      showTranslateModal.value = false;
    } else {
      notification.value = {
        type: 'error',
        message: `Failed to translate proposal: ${failedLangs.join(', ')}.`,
      };
    }
  } catch (err) {
    console.error('Batch translation error:', err);
    notification.value = {
      type: 'error',
      message: `Failed to execute batch translation: ${err.message}`,
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
// Save Proposal to GitHub & Conflict Handling (Task 2.3 / 3.2 / 4.1)
// -------------------------------------------------------------
function serializeProposalPayload(prop) {
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

  return {
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
}

async function handleSaveConflict(data, attemptedProposals) {
  try {
    const freshRes = await fetch('/admin/ballot/proposals/', {
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin',
    });
    if (freshRes.ok) {
      const freshData = await freshRes.json();
      baseSha.value = freshData.head_sha || freshData.tree_sha;
      serverProposals.value = (freshData.proposals || []).map(normalizeProposal);
    }
  } catch (err) {
    console.error('Failed to reload proposals during conflict:', err);
  }

  const conflictingFilePaths = Object.keys(data.conflicting_files || {});
  let matched = attemptedProposals.filter((p) => {
    const slug1 = `/${p.slug}/`;
    const slug2 = p.original_slug ? `/${p.original_slug}/` : null;
    return conflictingFilePaths.some((fp) => fp.includes(slug1) || (slug2 && fp.includes(slug2)));
  });
  if (matched.length === 0) {
    matched = attemptedProposals;
  }

  conflictedQueue.value = matched.map((p) => {
    const originalOrCurrent = p.original_slug || p.slug;
    const head = serverProposals.value.find((hp) => hp.slug === originalOrCurrent) || null;
    return {
      slug: p.slug,
      title: getProposalTitle(p),
      localProposal: JSON.parse(JSON.stringify(p)),
      headProposal: head,
    };
  });

  if (conflictedQueue.value.length === 1) {
    conflictHeadProposal.value = conflictedQueue.value[0].headProposal;
    conflictLocalProposal.value = conflictedQueue.value[0].localProposal;
  } else {
    conflictHeadProposal.value = null;
    conflictLocalProposal.value = null;
  }

  showConflictModal.value = true;
}

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
    const payload = {
      base_sha: baseSha.value,
      ...serializeProposalPayload(prop),
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

    // 409 Conflict Handling
    if (res.status === 409) {
      await handleSaveConflict(data, [prop]);
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
      message: `Proposal "${getProposalTitle(prop)}" (${prop.slug}) saved successfully!`,
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

async function saveAllProposals() {
  if (dirtyCount.value === 0 || isSaving.value) return;

  const count = dirtyCount.value;
  const dirtyList = dirtyProposals.value;

  // 1. Pre-flight validation: check for empty slugs
  for (const p of dirtyList) {
    if (!p.slug || !p.slug.trim()) {
      notification.value = {
        type: 'error',
        message: `Cannot save: proposal "${getProposalTitle(p)}" has an empty slug.`,
      };
      return;
    }
  }

  // 2. Pre-flight validation: check for duplicate slugs across all proposals
  const allSlugs = proposals.value.map((p) => (p.slug || '').trim().toLowerCase());
  const slugSet = new Set();
  let dupSlug = null;
  for (const s of allSlugs) {
    if (slugSet.has(s)) {
      dupSlug = s;
      break;
    }
    slugSet.add(s);
  }
  if (dupSlug) {
    notification.value = {
      type: 'error',
      message: `Cannot save: slug "${dupSlug}" is used by more than one proposal.`,
    };
    return;
  }

  isSaving.value = true;
  saveSuccess.value = false;
  notification.value = null;

  try {
    const payload = {
      base_sha: baseSha.value,
      proposals: dirtyList.map(serializeProposalPayload),
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

    // 409 Conflict Handling
    if (res.status === 409) {
      await handleSaveConflict(data, dirtyList);
      return;
    }

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    baseSha.value = data.commit_sha || data.head_sha || baseSha.value;

    for (const prop of dirtyList) {
      clearDraftForProposal(prop.slug);
      if (prop.original_slug) clearDraftForProposal(prop.original_slug);
      if (prop.previous_slug) clearDraftForProposal(prop.previous_slug);

      const oldOriginalSlug = prop.original_slug;
      prop.isNew = false;
      prop.original_slug = prop.slug;
      prop.previous_slug = prop.slug;
      prop.pendingImage = null;

      const updatedServerCopy = normalizeProposal(JSON.parse(JSON.stringify(prop)));
      const serverIdx = serverProposals.value.findIndex(
        (p) => p.slug === prop.slug || (oldOriginalSlug && p.slug === oldOriginalSlug)
      );
      if (serverIdx !== -1) {
        serverProposals.value[serverIdx] = updatedServerCopy;
      } else {
        serverProposals.value.unshift(updatedServerCopy);
      }
    }

    saveSuccess.value = true;
    notification.value = {
      type: 'success',
      message: `Successfully saved all changes across ${count} proposal${count === 1 ? '' : 's'} to GitHub!`,
    };

    setTimeout(() => {
      saveSuccess.value = false;
    }, 4000);
  } catch (err) {
    console.error('Error saving all proposals:', err);
    notification.value = {
      type: 'error',
      message: `Failed to commit batch changes: ${err.message}`,
    };
  } finally {
    isSaving.value = false;
  }
}

// Conflict Resolution Actions (#173 / Task 5.2)
function resolveConflictKeepLocal(conflictItem) {
  // Local changes are kept, baseSha is already updated to latest HEAD
}

function resolveConflictUseHead(conflictItem) {
  const slug = conflictItem?.slug || activeProposal.value?.slug;
  const head = conflictItem?.headProposal || conflictHeadProposal.value;
  if (!slug) return;

  const target = proposals.value.find((p) => p.slug === slug || (p.original_slug && p.original_slug === slug));
  if (target) {
    if (head) {
      target.slug = head.slug;
      target.original_slug = head.slug;
      target.previous_slug = head.slug;
      target.info = JSON.parse(JSON.stringify(head.info || {}));
      target.translations = JSON.parse(JSON.stringify(head.translations || {}));
      target.pendingImage = null;
      target.customSlugSet = false;
    } else {
      proposals.value = proposals.value.filter((p) => p !== target);
      if (activeProposal.value === target) {
        activeProposal.value = proposals.value[0] || null;
      }
    }
    clearDraftForProposal(slug);
    if (target.original_slug) clearDraftForProposal(target.original_slug);
    if (target.previous_slug) clearDraftForProposal(target.previous_slug);
  }
}

function onAllConflictsResolved() {
  showConflictModal.value = false;
  notification.value = {
    type: 'warning',
    message: 'Loaded the latest repository state and reviewed conflicts. Click "Save All Changes" (or "Save Changes") to commit on top of HEAD.',
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

/* Notification banner close button */
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
  flex-direction: row;
  justify-content: center;
  align-items: flex-start;
  gap: 1rem;
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
  border-color: var(--admin-color-primary);
  box-shadow: var(--admin-focus-ring);
}

.lang-select-dropdown.has-missing {
  border-color: var(--admin-color-warning-border);
  background-color: var(--admin-color-warning-bg);
  color: var(--admin-color-warning-text);
}

.lang-select-dropdown.other-lang-dirty {
  background-color: var(--admin-color-dirty-bg);
  border-color: var(--admin-color-dirty-border);
  color: var(--admin-color-dirty-text);
}

.editor-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.editor-actions .button {
  width: 100%;
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

.status-indicator {
  font-size: 0.85rem;
  font-weight: 500;
}
.status-indicator.saving {
  color: var(--admin-color-primary);
}
.status-indicator.success {
  color: var(--admin-color-success);
}
</style>
