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
            </div>
            <div class="editor-actions">
              <span v-if="isSaving" class="status-indicator saving">Saving to GitHub...</span>
              <span v-else-if="saveSuccess" class="status-indicator success">Saved ✓</span>
              <button
                class="save-btn"
                :disabled="isSaving"
                @click="saveCurrentProposal"
              >
                <span class="save-icon">💾</span> Save
              </button>
            </div>
          </div>

          <!-- Slug field (Above the preview frame, per user feedback) -->
          <div class="external-field-row">
            <label class="external-field-label" for="proposal-slug-input">Slug:</label>
            <input
              id="proposal-slug-input"
              type="text"
              class="external-field-input slug-input"
              v-model="activeProposal.slug"
              placeholder="e.g. bus-shelter-upgrades"
              @input="activeProposal.customSlugSet = true"
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
                    v-model="activeProposal.translations.en.content"
                    placeholder="ENTER PROPOSAL DESCRIPTION (PLAIN TEXT PARAGRAPHS)..."
                    rows="3"
                    @input="autoResizeTextarea($event.target)"
                  ></textarea>
                </div>

                <!-- Proposal Image Area (Hover Picker per user feedback) -->
                <div
                  class="proposal-image-wrapper"
                  :class="{ 'has-image': !!currentImageUrl, 'is-empty': !currentImageUrl }"
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
            <label class="external-field-label" for="proposal-alt-input">Image Alternative Text:</label>
            <input
              id="proposal-alt-input"
              type="text"
              class="external-field-input"
              v-model="activeProposal.translations.en.image_alt"
              placeholder="Describe the image for screen readers..."
            />
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue';

const proposals = ref([]);
const activeProposal = ref(null);
const baseSha = ref('');
const loading = ref(true);
const isSaving = ref(false);
const saveSuccess = ref(false);
const notification = ref(null);
const searchQuery = ref('');

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

// Computed filtered proposals based on search input
const filteredProposals = computed(() => {
  if (!searchQuery.value.trim()) return proposals.value;
  const q = searchQuery.value.toLowerCase();
  return proposals.value.filter((p) => {
    const title = getProposalTitle(p).toLowerCase();
    const slug = (p.slug || '').toLowerCase();
    return title.includes(q) || slug.includes(q);
  });
});

// Helper to extract display title
function getProposalTitle(prop) {
  if (!prop) return '';
  return prop.translations?.en?.title || prop.slug || '(Untitled Proposal)';
}

// Format numbers with commas (e.g. 200000 -> 200,000)
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

// Compute current preview image URL
const currentImageUrl = computed(() => {
  if (!activeProposal.value) return '';
  if (activeProposal.value.pendingImage?.dataUrl) {
    return activeProposal.value.pendingImage.dataUrl;
  }
  return activeProposal.value.info?.image || '';
});

// Slug generation utility from title
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

// Auto-derive slug if proposal is newly created and slug wasn't manually edited
function onTitleInput(e) {
  autoResizeTextarea(e.target);
  if (activeProposal.value && activeProposal.value.isNew && !activeProposal.value.customSlugSet) {
    const title = activeProposal.value.translations.en.title;
    activeProposal.value.slug = slugify(title) || 'new-ballot-proposal';
  }
}

// Fetch ballot proposals from GitHub API via backend proxy
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
    proposals.value = (data.proposals || []).map(normalizeProposal);

    if (proposals.value.length > 0) {
      // Retain active proposal if still present, or pick first
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

// Ensure proposal has all required nested objects
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
    isNew: false,
    customSlugSet: false,
    pendingImage: null,
  };
  return prop;
}

// Select a proposal in sidebar
function selectProposal(prop) {
  activeProposal.value = prop;
  saveSuccess.value = false;
}

// Add a new proposal
function addNewProposal() {
  const newSlug = `new-proposal-${Date.now().toString().slice(-4)}`;
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
}

// Handle image selection via input
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
  };
  reader.readAsDataURL(file);
}

// Save active proposal to GitHub
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

    if (res.status === 409) {
      notification.value = {
        type: 'warning',
        message: 'Concurrent change conflict detected on GitHub! Please reload to see updated content.',
      };
      return;
    }

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    // Success: update base_sha with new commit SHA
    baseSha.value = data.commit_sha || data.head_sha || baseSha.value;
    prop.isNew = false;
    prop.pendingImage = null;
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

// Confirm and delete proposal
async function confirmDeleteProposal(prop) {
  const title = getProposalTitle(prop);
  if (!confirm(`Are you sure you want to delete proposal "${title}"?`)) {
    return;
  }

  // If proposal was newly created and never saved to GitHub:
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

// Auto-adjust textareas on proposal activation
watch(activeProposal, () => {
  nextTick(() => {
    autoResizeTextarea(titleInputRef.value);
    autoResizeTextarea(descInputRef.value);
  });
});

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

.lang-badge {
  background: #ffffff;
  border: 1px solid #ced4da;
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #495057;
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

.external-field-label {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1e293b;
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
  transition: border-color 0.2s, box-shadow 0.2s;
}

.slug-input {
  font-family: monospace;
}

.external-field-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
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
  transition: filter 0.2s ease;
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
</style>
