<template>
  <div class="ballot-content-manager">
    <!-- Header Notification Banner -->
    <div v-if="notification" :class="['notification-banner', notification.type]">
      <span>{{ notification.message }}</span>
      <button class="close-notif-btn" @click="notification = null">×</button>
    </div>

    <!-- Main 2-Pane Layout -->
    <div class="editor-layout">
      <!-- Left Pane: Proposal Sidebar List -->
      <aside class="proposal-sidebar">
        <div class="sidebar-header">
          <h2>BALLOT PROPOSALS <span class="badge">{{ proposals.length }}</span></h2>
          <button class="add-proposal-btn" @click="addNewProposal" :disabled="loading">
            + Add a new ballot proposal
          </button>
        </div>

        <div class="sidebar-filter" v-if="proposals.length > 5">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search proposals..."
            class="search-input"
          />
        </div>

        <div v-if="loading && proposals.length === 0" class="sidebar-loading">
          Loading proposals from GitHub...
        </div>

        <ul class="proposal-list" v-else>
          <li
            v-for="prop in filteredProposals"
            :key="prop.slug"
            :class="['proposal-list-item', { active: activeProposal && activeProposal.slug === prop.slug }]"
            @click="selectProposal(prop)"
          >
            <div class="item-left">
              <span class="selection-indicator">●</span>
              <span class="item-title">{{ getProposalTitle(prop) }}</span>
              <span
                v-if="isProposalDirty(prop)"
                class="dirty-indicator-dot"
                title="Unsaved changes in local storage"
              >●</span>
            </div>
            <div class="item-right">
              <span class="item-amount">${{ formatNumber(prop.info?.amount || 0) }}</span>
              <button
                class="delete-item-btn"
                title="Delete proposal"
                @click.stop="confirmDeleteProposal(prop)"
              >
                ×
              </button>
            </div>
          </li>
          <li v-if="filteredProposals.length === 0" class="no-proposals">
            No proposals found.
          </li>
        </ul>
      </aside>

      <!-- Right Pane: WYSIWYG Preview Editor -->
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

          <!-- Slug field (Above the preview frame, per user feedback) -->
          <div class="external-field-row">
            <div class="field-label-row">
              <label class="external-field-label" for="proposal-slug-input">Slug:</label>
              <span v-if="isFieldDirty(activeProposal, 'slug')" class="dirty-tag">modified</span>
            </div>
            <input
              id="proposal-slug-input"
              type="text"
              class="external-field-input slug-input"
              :class="{ 'is-dirty': isFieldDirty(activeProposal, 'slug') }"
              v-model="activeProposal.slug"
              placeholder="e.g. bus-shelter-upgrades"
              @input="onSlugInput"
            />
          </div>

          <!-- Ballot Preview Frame (Mimics /vote/ballot) -->
          <div class="ballot-preview-frame">
            <!-- Simulated Boston Header -->
            <div class="ballot-frame-header">
              <!-- Pink Hamburger Icon Box -->
              <div class="header-hamburger-box" title="Menu">
                <div class="hamburger-lines">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

              <!-- Navy Boston 'B' Logo Box with Red/Orange Underline -->
              <div class="header-boston-logo-box" title="City of Boston">
                <svg viewBox="136 0 32 40" class="boston-b-logo" width="22" height="28">
                  <path fill="#ffffff" d="M151.59,27.21h-11.6V.61h10.31c1.79,0,3.34.22,4.65.65,1.3.43,2.28,1.02,2.94,1.75,1.19,1.37,1.78,2.92,1.78,4.64,0,2.08-.67,3.63-2.01,4.65-.45.35-.77.58-.95.67s-.49.24-.95.44c1.64.36,2.95,1.1,3.93,2.23.97,1.13,1.46,2.53,1.46,4.2,0,1.85-.63,3.49-1.9,4.91-1.47,1.65-4.02,2.47-7.66,2.47ZM145.9,11.38h2.81c1.64,0,2.86-.18,3.66-.53.8-.35,1.19-1.12,1.19-2.3s-.37-1.96-1.1-2.34c-.73-.38-1.97-.57-3.72-.57h-2.84v5.75h0ZM145.9,22.19h4.06c1.69,0,2.96-.21,3.81-.63.85-.42,1.27-1.24,1.27-2.48s-.45-2.04-1.34-2.43c-.9-.4-2.33-.59-4.3-.59h-3.49v6.13h0Z" />
                  <rect x="139" y="33" width="26" height="5" fill="#FB4D42" />
                </svg>
              </div>

              <!-- Header Fill -->
              <div class="header-fill-area"></div>
            </div>

            <!-- Frame Body (Fog grey background matching /vote/ballot) -->
            <div class="ballot-frame-body">
              <!-- Proposal Card -->
              <div class="proposal-card">
                <!-- Proposal Title Row with Pill Checkbox -->
                <div class="proposal-card-top">
                  <span class="proposal-card-top-left">
                    <span class="proposal-pill-checkbox"></span>
                  </span>
                  <div class="proposal-title-container">
                    <textarea
                      ref="titleInputRef"
                      class="proposal-title-input"
                      :class="{ 'is-dirty': isFieldDirty(activeProposal, 'title') }"
                      v-model="activeProposal.translations.en.title"
                      placeholder="PROPOSAL TITLE"
                      rows="1"
                      @input="onTitleInput"
                    ></textarea>
                  </div>
                </div>

                <!-- Proposal Cost (Green bold amount, editable) -->
                <div class="proposal-cost-row">
                  <span class="cost-dollar">$</span>
                  <input
                    type="text"
                    class="proposal-cost-input"
                    :class="{ 'is-dirty': isFieldDirty(activeProposal, 'amount') }"
                    :value="displayAmount"
                    @input="onAmountInput"
                    @blur="onAmountBlur"
                    @focus="$event.target.select()"
                    placeholder="200,000"
                  />
                </div>

                <!-- Proposal Description (Uppercase bold Montserrat plain text) -->
                <div class="proposal-description-container">
                  <textarea
                    ref="descInputRef"
                    class="proposal-description-input"
                    :class="{ 'is-dirty': isFieldDirty(activeProposal, 'content') }"
                    v-model="activeProposal.translations.en.content"
                    placeholder="ENTER PROPOSAL DESCRIPTION (PLAIN TEXT PARAGRAPHS)..."
                    rows="3"
                    @input="autoResizeTextarea($event.target)"
                  ></textarea>
                </div>

                <!-- Proposal Image Area (Hover Picker per user feedback) -->
                <div
                  class="proposal-image-wrapper"
                  :class="{
                    'has-image': !!currentImageUrl,
                    'is-empty': !currentImageUrl,
                    'is-dirty': isFieldDirty(activeProposal, 'image'),
                  }"
                  @click="triggerImageUpload"
                  title="Click to choose or change image"
                >
                  <img
                    v-if="currentImageUrl"
                    class="proposal-image"
                    :src="currentImageUrl"
                    :alt="activeProposal.translations.en.image_alt || getProposalTitle(activeProposal)"
                  />
                  <div v-else class="image-empty-placeholder">
                    <svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span class="placeholder-text">Click to choose image</span>
                  </div>

                  <!-- Hover overlay with pencil icon badge (Image 4) -->
                  <div class="image-hover-overlay">
                    <div class="pencil-badge">
                      <svg class="pencil-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                      </svg>
                    </div>
                  </div>

                  <!-- Hidden native file input -->
                  <input
                    ref="fileInputRef"
                    type="file"
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    class="file-input-hidden"
                    @change="onImageSelected"
                    @click.stop
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Image Alternative Text field (Below the preview frame, per user feedback) -->
          <div class="external-field-row alt-field-row">
            <div class="field-label-row">
              <label class="external-field-label" for="proposal-alt-input">Image Alternative Text:</label>
              <span v-if="isFieldDirty(activeProposal, 'image_alt')" class="dirty-tag">modified</span>
            </div>
            <input
              id="proposal-alt-input"
              type="text"
              class="external-field-input"
              :class="{ 'is-dirty': isFieldDirty(activeProposal, 'image_alt') }"
              v-model="activeProposal.translations.en.image_alt"
              placeholder="Describe the image for screen readers..."
            />
          </div>
        </div>
      </main>
    </div>

    <!-- Conflict Resolution Modal (#173 / Task 2.3) -->
    <div v-if="showConflictModal" class="conflict-modal-overlay">
      <div class="conflict-modal-dialog">
        <div class="conflict-modal-header">
          <h3>⚠️ Concurrent Edit Conflict</h3>
          <button class="modal-close-btn" @click="showConflictModal = false">×</button>
        </div>

        <div class="conflict-modal-body">
          <p class="conflict-notice">
            Another admin has saved changes since you opened this page. We have loaded the current proposals.
            Please carefully verify your updates against the current proposals, make any new updates as necessary,
            and re-save your changes.
          </p>

          <div class="conflict-comparison" v-if="conflictHeadProposal && conflictLocalProposal">
            <h4>Comparison: Latest on GitHub vs Your Local Changes</h4>
            <div class="diff-table">
              <div class="diff-row diff-header-row">
                <div class="diff-col field-name">Field</div>
                <div class="diff-col col-head">Latest on GitHub (HEAD)</div>
                <div class="diff-col col-local">Your Unsaved Changes</div>
              </div>

              <!-- Title Diff -->
              <div class="diff-row">
                <div class="diff-col field-name">Title</div>
                <div class="diff-col col-head">{{ conflictHeadProposal.translations?.en?.title || '—' }}</div>
                <div
                  class="diff-col col-local"
                  :class="{ 'has-diff': conflictHeadProposal.translations?.en?.title !== conflictLocalProposal.translations?.en?.title }"
                >
                  {{ conflictLocalProposal.translations?.en?.title || '—' }}
                </div>
              </div>

              <!-- Amount Diff -->
              <div class="diff-row">
                <div class="diff-col field-name">Estimated Cost</div>
                <div class="diff-col col-head">${{ formatNumber(conflictHeadProposal.info?.amount || 0) }}</div>
                <div
                  class="diff-col col-local"
                  :class="{ 'has-diff': Number(conflictHeadProposal.info?.amount) !== Number(conflictLocalProposal.info?.amount) }"
                >
                  ${{ formatNumber(conflictLocalProposal.info?.amount || 0) }}
                </div>
              </div>

              <!-- Description Diff -->
              <div class="diff-row">
                <div class="diff-col field-name">Description</div>
                <div class="diff-col col-head">{{ conflictHeadProposal.translations?.en?.content || '—' }}</div>
                <div
                  class="diff-col col-local"
                  :class="{ 'has-diff': conflictHeadProposal.translations?.en?.content !== conflictLocalProposal.translations?.en?.content }"
                >
                  {{ conflictLocalProposal.translations?.en?.content || '—' }}
                </div>
              </div>

              <!-- Image Alt Diff -->
              <div class="diff-row">
                <div class="diff-col field-name">Alt Text</div>
                <div class="diff-col col-head">{{ conflictHeadProposal.translations?.en?.image_alt || '—' }}</div>
                <div
                  class="diff-col col-local"
                  :class="{ 'has-diff': conflictHeadProposal.translations?.en?.image_alt !== conflictLocalProposal.translations?.en?.image_alt }"
                >
                  {{ conflictLocalProposal.translations?.en?.image_alt || '—' }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="conflict-modal-footer">
          <button class="btn-conflict-revert" @click="resolveConflictUseHead">
            Discard My Changes & Use Latest HEAD
          </button>
          <button class="btn-conflict-keep" @click="resolveConflictKeepLocal">
            Keep My Local Changes
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';

const LOCAL_STORAGE_KEY = 'pbboston_ballot_drafts';

const proposals = ref([]);
const serverProposals = ref([]);
const activeProposal = ref(null);
const baseSha = ref('');
const loading = ref(true);
const isSaving = ref(false);
const saveSuccess = ref(false);
const notification = ref(null);
const searchQuery = ref('');

// Conflict resolution modal state (#173)
const showConflictModal = ref(false);
const conflictHeadProposal = ref(null);
const conflictLocalProposal = ref(null);

const titleInputRef = ref(null);
const descInputRef = ref(null);
const fileInputRef = ref(null);

function triggerImageUpload() {
  fileInputRef.value?.click();
}

function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
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

function onSlugInput() {
  if (activeProposal.value) {
    activeProposal.value.customSlugSet = true;
  }
}

// Auto-derive unique slug if proposal is newly created and slug wasn't manually edited
function onTitleInput(e) {
  autoResizeTextarea(e.target);
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
// Filter & Format Utilities
// -------------------------------------------------------------
const filteredProposals = computed(() => {
  if (!searchQuery.value.trim()) return proposals.value;
  const q = searchQuery.value.toLowerCase();
  return proposals.value.filter((p) => {
    const title = getProposalTitle(p).toLowerCase();
    const slug = (p.slug || '').toLowerCase();
    return title.includes(q) || slug.includes(q);
  });
});

function getProposalTitle(prop) {
  if (!prop) return '';
  return prop.translations?.en?.title || prop.slug || '(Untitled Proposal)';
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString();
}

const displayAmount = computed(() => {
  return formatNumber(activeProposal.value?.info?.amount ?? 0);
});

function onAmountInput(e) {
  const raw = e.target.value.replace(/[^\d]/g, '');
  const val = raw ? parseInt(raw, 10) : 0;
  if (activeProposal.value) {
    if (!activeProposal.value.info) activeProposal.value.info = {};
    activeProposal.value.info.amount = val;
  }
}

function onAmountBlur(e) {
  e.target.value = formatNumber(activeProposal.value?.info?.amount ?? 0);
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

function onImageSelected(event) {
  const file = event.target.files?.[0];
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

// Watch active proposal changes to persist to localStorage & auto-resize
watch(
  () => activeProposal.value,
  (newVal) => {
    if (newVal) {
      updateDraftForProposal(newVal);
      nextTick(() => {
        autoResizeTextarea(titleInputRef.value);
        autoResizeTextarea(descInputRef.value);
      });
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

/* Left Pane: Proposal Sidebar */
.proposal-sidebar {
  width: 360px;
  min-width: 320px;
  background-color: #ffffff;
  border-right: 1px solid #dee2e6;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e9ecef;
}

.sidebar-header h2 {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #212529;
}

.badge {
  background-color: #e9ecef;
  color: #495057;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 12px;
}

.add-proposal-btn {
  width: 100%;
  padding: 8px 12px;
  background-color: #ffffff;
  border: 1px dashed #6c757d;
  border-radius: 6px;
  color: #495057;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-proposal-btn:hover {
  background-color: #f8f9fa;
  border-color: #007bff;
  color: #007bff;
}

.sidebar-filter {
  padding: 8px 16px;
  border-bottom: 1px solid #f1f3f5;
}

.search-input {
  width: 100%;
  padding: 6px 10px;
  font-size: 0.85rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  box-sizing: border-box;
}

.sidebar-loading {
  padding: 24px;
  text-align: center;
  color: #6c757d;
  font-style: italic;
}

.proposal-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  overflow-y: auto;
}

.proposal-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f1f3f5;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.proposal-list-item:hover {
  background-color: #f8f9fa;
}

.proposal-list-item.active {
  background-color: #e8f4fd;
  border-left: 4px solid #007bff;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  margin-right: 8px;
}

.selection-indicator {
  color: #007bff;
  font-size: 0.8rem;
  opacity: 0;
}

.proposal-list-item.active .selection-indicator {
  opacity: 1;
}

.dirty-indicator-dot {
  color: #f59e0b;
  font-size: 0.85rem;
  margin-left: 2px;
  flex-shrink: 0;
}

.item-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: #212529;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-amount {
  font-size: 0.8rem;
  font-weight: 600;
  color: #28a745;
  background: #eafaf1;
  padding: 2px 6px;
  border-radius: 4px;
}

.delete-item-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: #adb5bd;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  border-radius: 4px;
}

.delete-item-btn:hover {
  color: #dc3545;
  background-color: #fee;
}

.no-proposals {
  padding: 20px;
  text-align: center;
  color: #6c757d;
  font-size: 0.9rem;
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

/* External Field Rows (Slug above, Alt Text below) */
.external-field-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.external-field-label {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1e293b;
}

.dirty-tag {
  font-size: 0.75rem;
  font-weight: 600;
  color: #b45309;
  background-color: #fef3c7;
  padding: 1px 6px;
  border-radius: 4px;
}

.external-field-input {
  width: 100%;
  padding: 8px 12px;
  font-size: 0.95rem;
  border: 1px solid #1e293b;
  border-radius: 4px;
  background: #ffffff;
  color: #1e293b;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
}

.slug-input {
  font-family: monospace;
}

.external-field-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

/* Dirty-State Visual Highlighting (#173) */
.is-dirty {
  background-color: #fef9c3 !important;
  border-color: #f59e0b !important;
}

.proposal-title-input.is-dirty,
.proposal-cost-input.is-dirty,
.proposal-description-input.is-dirty {
  background-color: #fef9c3 !important;
  border: 1px dashed #f59e0b !important;
  border-radius: 4px;
}

.proposal-image-wrapper.is-dirty {
  box-shadow: 0 0 0 3px #f59e0b !important;
}

/* Ballot Preview Frame (mimics /vote/ballot) */
.ballot-preview-frame {
  width: 100%;
  border: 2px solid #0E0E30;
  border-radius: 4px;
  background-color: #efeff4;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}

/* Header inside frame */
.ballot-frame-header {
  height: 48px;
  display: flex;
  align-items: stretch;
  background-color: #ffffff;
  border-bottom: 1px solid #d1d5db;
}

.header-hamburger-box {
  width: 48px;
  background-color: #E90055;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hamburger-lines {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 20px;
  height: 14px;
}

.hamburger-lines span {
  display: block;
  height: 2.5px;
  width: 100%;
  background-color: #ffffff;
  border-radius: 1px;
}

.header-boston-logo-box {
  width: 48px;
  background-color: #0E0E30;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.boston-b-logo {
  display: block;
}

.header-fill-area {
  flex: 1;
  background-color: #ffffff;
}

/* Body inside frame */
.ballot-frame-body {
  padding: 16px 14px;
  background-color: #efeff4;
}

/* Proposal Card matching sa_vote style */
.proposal-card {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  background: #ffffff;
  border-radius: 8px;
  border: 4px solid #ffffff;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.2);
  font-family: 'Montserrat', sans-serif;
  gap: 0.65rem;
}

/* Card Top: Pill and Title */
.proposal-card-top {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 0.6rem;
}

.proposal-card-top-left {
  display: inline-flex;
  align-items: center;
  padding-top: 3px;
}

.proposal-pill-checkbox {
  width: 2rem;
  height: 1rem;
  border: 2px solid #0E0E30;
  border-radius: 1rem;
  background: transparent;
  display: inline-block;
}

.proposal-title-container {
  flex: 1;
}

.proposal-title-input {
  font-family: 'Montserrat', sans-serif;
  font-size: 1.35rem;
  font-weight: 700;
  color: #0E0E30;
  text-transform: uppercase;
  line-height: 1.2;
  width: 100%;
  border: 1px dashed transparent;
  border-radius: 4px;
  background: transparent;
  resize: none;
  outline: none;
  padding: 2px 4px;
  box-sizing: border-box;
  overflow: hidden;
  transition: border-color 0.2s, background-color 0.2s;
}

.proposal-title-input:hover {
  border-color: #94a3b8;
  background-color: #f8fafc;
}

.proposal-title-input:focus {
  border-color: #3b82f6;
  background-color: #ffffff;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

/* Proposal Cost */
.proposal-cost-row {
  display: flex;
  align-items: center;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 1.5rem;
  color: #00cd5f;
  line-height: 1.2;
}

.cost-dollar {
  font-weight: 700;
  color: #00cd5f;
  margin-right: 1px;
}

.proposal-cost-input {
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 1.5rem;
  color: #00cd5f;
  border: 1px dashed transparent;
  border-radius: 4px;
  background: transparent;
  outline: none;
  width: 180px;
  padding: 0 4px;
  transition: border-color 0.2s, background-color 0.2s;
}

.proposal-cost-input:hover {
  border-color: #94a3b8;
  background-color: #f8fafc;
}

.proposal-cost-input:focus {
  border-color: #3b82f6;
  background-color: #ffffff;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

/* Proposal Description */
.proposal-description-container {
  width: 100%;
  margin-bottom: 0.25rem;
}

.proposal-description-input {
  font-family: 'Montserrat', sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: #0E0E30;
  text-transform: uppercase;
  line-height: 1.35;
  width: 100%;
  border: 1px dashed transparent;
  border-radius: 4px;
  background: transparent;
  resize: none;
  outline: none;
  padding: 4px;
  box-sizing: border-box;
  overflow: hidden;
  transition: border-color 0.2s, background-color 0.2s;
}

.proposal-description-input:hover {
  border-color: #94a3b8;
  background-color: #f8fafc;
}

.proposal-description-input:focus {
  border-color: #3b82f6;
  background-color: #ffffff;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

/* Proposal Image & Hover Overlay */
.proposal-image-wrapper {
  position: relative;
  width: 100%;
  height: 160px;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background-color: #cbd5e1;
  transition: filter 0.2s ease, box-shadow 0.2s ease;
}

.proposal-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}

.image-empty-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #475569;
  background-color: #cbd5e1;
}

.placeholder-icon {
  width: 32px;
  height: 32px;
}

.placeholder-text {
  font-size: 0.85rem;
  font-weight: 600;
  font-family: 'Montserrat', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.image-hover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  border-radius: 8px;
}

.proposal-image-wrapper:hover .image-hover-overlay {
  opacity: 1;
}

/* When empty, show the overlay/badge by default per user feedback */
.proposal-image-wrapper.is-empty .image-hover-overlay {
  opacity: 0.6;
}

.proposal-image-wrapper.is-empty:hover .image-hover-overlay {
  opacity: 0.9;
  background: rgba(255, 255, 255, 0.85);
}

.pencil-badge {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0E0E30;
  transition: transform 0.15s ease;
}

.proposal-image-wrapper:hover .pencil-badge {
  transform: scale(1.1);
}

.pencil-icon {
  width: 24px;
  height: 24px;
}

.file-input-hidden {
  display: none;
}

/* -------------------------------------------------------------
 * Conflict Resolution Modal (#173 / Task 2.3)
 * ------------------------------------------------------------- */
.conflict-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.conflict-modal-dialog {
  background: #ffffff;
  border-radius: 12px;
  max-width: 650px;
  width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 90vh;
}

.conflict-modal-header {
  padding: 16px 20px;
  background-color: #fff1f2;
  border-bottom: 1px solid #fecdd3;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.conflict-modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  color: #9f1239;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #9f1239;
  cursor: pointer;
  line-height: 1;
}

.conflict-modal-body {
  padding: 20px;
  overflow-y: auto;
  font-size: 0.95rem;
  color: #334155;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.conflict-notice {
  margin: 0;
  line-height: 1.5;
  background-color: #fffbeb;
  border-left: 4px solid #f59e0b;
  padding: 12px 14px;
  border-radius: 4px;
  color: #92400e;
}

.conflict-comparison h4 {
  margin: 0 0 10px 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
}

.diff-table {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
  font-size: 0.85rem;
}

.diff-row {
  display: flex;
  border-bottom: 1px solid #f1f5f9;
}
.diff-row:last-child {
  border-bottom: none;
}

.diff-header-row {
  background-color: #f8fafc;
  font-weight: 600;
  color: #475569;
}

.diff-col {
  padding: 8px 12px;
  flex: 1;
  word-break: break-word;
}

.diff-col.field-name {
  flex: 0 0 110px;
  font-weight: 600;
  color: #64748b;
  background-color: #f8fafc;
  border-right: 1px solid #f1f5f9;
}

.diff-col.col-head {
  border-right: 1px solid #f1f5f9;
  background-color: #ffffff;
}

.diff-col.col-local.has-diff {
  background-color: #fef9c3;
  color: #854d0e;
  font-weight: 600;
}

.conflict-modal-footer {
  padding: 14px 20px;
  background-color: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-conflict-revert {
  background-color: #ffffff;
  color: #dc2626;
  border: 1px solid #fca5a5;
  padding: 8px 14px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-conflict-revert:hover {
  background-color: #fee2e2;
}

.btn-conflict-keep {
  background-color: #007bff;
  color: #ffffff;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background-color 0.2s;
}
.btn-conflict-keep:hover {
  background-color: #0056b3;
}
</style>
