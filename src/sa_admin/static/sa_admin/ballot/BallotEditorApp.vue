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
            <div class="lang-selector">
              <span class="lang-badge">English (en)</span>
              <span v-if="isProposalDirty(activeProposal)" class="unsaved-changes-pill">
                Unsaved Edits
              </span>
            </div>
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
                :disabled="isSaving"
                @click="saveCurrentProposal"
              >
                <span class="save-icon">💾</span> Save Changes
              </button>
            </div>
          </div>

          <!-- WYSIWYG Ballot View Component -->
          <BallotWysiwygView
            :proposal="activeProposal"
            :current-image-url="currentImageUrl"
            :is-field-dirty="isFieldDirty"
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

function onSlugInput() {
  if (activeProposal.value) {
    activeProposal.value.customSlugSet = true;
  }
}

function onTitleInput() {
  if (activeProposal.value && activeProposal.value.isNew && !activeProposal.value.customSlugSet) {
    const title = activeProposal.value.translations.en.title;
    activeProposal.value.slug = generateUniqueSlug(title, activeProposal.value.slug);
  }
}

// -------------------------------------------------------------
// Local Storage Persistence & Dirty State Tracking (Task 2.2)
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
  if (isProposalDirty(prop)) {
    drafts[prop.slug] = {
      slug: prop.slug,
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
  }
  saveDrafts(drafts);
}

function clearDraftForProposal(slug) {
  const drafts = getStoredDrafts();
  if (drafts[slug]) {
    delete drafts[slug];
    saveDrafts(drafts);
  }
}

function getServerProposal(slug) {
  return serverProposals.value.find((p) => p.slug === slug);
}

function isFieldDirty(prop, field) {
  if (!prop) return false;
  if (prop.isNew) return true;
  const server = getServerProposal(prop.slug);
  if (!server) return true;

  switch (field) {
    case 'slug':
      return prop.slug !== server.slug;
    case 'title':
      return (prop.translations?.en?.title || '') !== (server.translations?.en?.title || '');
    case 'amount':
      return Number(prop.info?.amount || 0) !== Number(server.info?.amount || 0);
    case 'content':
      return (prop.translations?.en?.content || '') !== (server.translations?.en?.content || '');
    case 'image_alt':
      return (prop.translations?.en?.image_alt || '') !== (server.translations?.en?.image_alt || '');
    case 'image':
      return (prop.info?.image || '') !== (server.info?.image || '') || !!prop.pendingImage;
    default:
      return false;
  }
}

function isProposalDirty(prop) {
  if (!prop) return false;
  if (prop.isNew) return true;
  return (
    isFieldDirty(prop, 'slug') ||
    isFieldDirty(prop, 'title') ||
    isFieldDirty(prop, 'amount') ||
    isFieldDirty(prop, 'content') ||
    isFieldDirty(prop, 'image_alt') ||
    isFieldDirty(prop, 'image')
  );
}

// Reset / Discard changes to proposal (#173)
function resetCurrentProposal() {
  if (!activeProposal.value) return;
  const title = getProposalTitle(activeProposal.value);
  if (!confirm(`Are you sure you want to discard unsaved changes to "${title}"?`)) {
    return;
  }

  const slug = activeProposal.value.slug;
  clearDraftForProposal(slug);

  if (activeProposal.value.isNew) {
    proposals.value = proposals.value.filter((p) => p.slug !== slug);
    activeProposal.value = proposals.value[0] || null;
    notification.value = {
      type: 'warning',
      message: `Discarded new proposal "${title}".`,
    };
    return;
  }

  const server = getServerProposal(slug);
  if (server) {
    activeProposal.value.slug = server.slug;
    activeProposal.value.info = JSON.parse(JSON.stringify(server.info || {}));
    activeProposal.value.translations = JSON.parse(JSON.stringify(server.translations || {}));
    activeProposal.value.pendingImage = null;
    activeProposal.value.customSlugSet = false;

    const idx = proposals.value.findIndex((p) => p.slug === slug);
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
function getProposalTitle(prop) {
  if (!prop) return '';
  return prop.translations?.en?.title || prop.slug || '(Untitled Proposal)';
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
  return activeProposal.value.info?.image || '';
});

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

    // Deep clone server proposals for baseline dirty comparison
    serverProposals.value = (data.proposals || []).map((p) => normalizeProposal(JSON.parse(JSON.stringify(p))));
    const workingProposals = (data.proposals || []).map((p) => normalizeProposal(JSON.parse(JSON.stringify(p))));

    // Rehydrate local storage drafts
    const drafts = getStoredDrafts();
    for (const prop of workingProposals) {
      if (drafts[prop.slug]) {
        const draft = drafts[prop.slug];
        prop.info = { ...prop.info, ...(draft.info || {}) };
        prop.translations = { ...prop.translations, ...(draft.translations || {}) };
        if (draft.pendingImage) prop.pendingImage = draft.pendingImage;
        if (draft.customSlugSet) prop.customSlugSet = true;
      }
    }

    // Add any drafts that were newly created proposals not yet on server
    for (const [slug, draft] of Object.entries(drafts)) {
      if (draft.isNew && !workingProposals.some((p) => p.slug === slug)) {
        workingProposals.unshift(normalizeProposal({
          ...draft,
          isNew: true,
        }));
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
  const prop = {
    slug: raw.slug || '',
    info: {
      amount: raw.info?.amount ?? 100000,
      image: raw.info?.image || '',
      ...(raw.info || {}),
    },
    translations: {
      en: {
        language: 'en',
        title: raw.translations?.en?.title || '',
        image_alt: raw.translations?.en?.image_alt || '',
        content: raw.translations?.en?.content || '',
        last_updated: raw.translations?.en?.last_updated || '',
      },
      ...(raw.translations || {}),
    },
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
  saveSuccess.value = false;
  updateDraftForProposal(newProp);
}

function onImageSelected(file) {
  if (!file || !activeProposal.value) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const extension = file.name.split('.').pop() || 'jpg';
    const filename = `${activeProposal.value.slug || 'proposal'}-${Date.now()}.${extension}`;

    activeProposal.value.pendingImage = {
      filename: filename,
      dataUrl: dataUrl,
    };
    activeProposal.value.info.image = `/static/ballot/${filename}`;
    updateDraftForProposal(activeProposal.value);
  };
  reader.readAsDataURL(file);
}

// -------------------------------------------------------------
// Save Proposal to GitHub & Conflict Handling (Task 2.3)
// -------------------------------------------------------------
async function saveCurrentProposal() {
  if (!activeProposal.value) return;

  isSaving.value = true;
  saveSuccess.value = false;
  notification.value = null;

  try {
    const prop = activeProposal.value;
    const payload = {
      base_sha: baseSha.value,
      slug: prop.slug,
      info: {
        amount: parseInt(prop.info.amount, 10) || 0,
        image: prop.info.image || '',
      },
      translations: {
        en: {
          language: 'en',
          title: prop.translations.en?.title || '',
          image_alt: prop.translations.en?.image_alt || '',
          content: prop.translations.en?.content || '',
        },
      },
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
        conflictHeadProposal.value = serverProposals.value.find((p) => p.slug === prop.slug) || null;
      }
      showConflictModal.value = true;
      return;
    }

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    // Success: update base_sha with new commit SHA
    baseSha.value = data.commit_sha || data.head_sha || baseSha.value;
    prop.isNew = false;
    prop.pendingImage = null;

    // Update server baseline so dirty highlight clears
    const updatedServerCopy = normalizeProposal(JSON.parse(JSON.stringify(prop)));
    const serverIdx = serverProposals.value.findIndex((p) => p.slug === prop.slug);
    if (serverIdx !== -1) {
      serverProposals.value[serverIdx] = updatedServerCopy;
    } else {
      serverProposals.value.unshift(updatedServerCopy);
    }

    // Clear local storage draft on successful save
    clearDraftForProposal(prop.slug);
    saveSuccess.value = true;

    notification.value = {
      type: 'success',
      message: `Proposal "${prop.translations.en.title}" saved and committed to GitHub successfully!`,
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
}

.lang-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lang-badge {
  background: #ffffff;
  border: 1px solid #ced4da;
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #495057;
}

.unsaved-changes-pill {
  background-color: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
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
