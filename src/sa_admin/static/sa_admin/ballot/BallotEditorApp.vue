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

      <!-- Right Pane: Mobile Preview Editor -->
      <main class="preview-workspace">
        <div v-if="!activeProposal" class="empty-selection">
          <p>Select a proposal from the left pane to edit, or click "+ Add a new ballot proposal".</p>
        </div>

        <div v-else class="mobile-device-container">
          <!-- Mobile Controls Bar -->
          <div class="mobile-controls-bar">
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

          <!-- Mobile Phone Simulation Frame -->
          <div class="mobile-phone-frame">
            <div class="phone-screen">
              <div class="phone-status-bar">
                <span class="time">9:41</span>
                <span class="phone-notch"></span>
                <span class="battery">100%</span>
              </div>

              <div class="phone-content">
                <!-- Proposal Ballot Card (WYSIWYG Inline Editor) -->
                <div class="proposal-card">
                  <div class="proposal-card-top">
                    <span class="proposal-checkbox-mock">✓</span>
                    <input
                      type="text"
                      class="wysiwyg-title-input"
                      v-model="activeProposal.translations.en.title"
                      placeholder="Proposal Title..."
                      @input="onTitleInput"
                    />
                  </div>

                  <!-- Slug details (inline editable for custom URLs) -->
                  <div class="proposal-slug-row">
                    <label class="slug-label">Slug:</label>
                    <input
                      type="text"
                      class="slug-input"
                      v-model="activeProposal.slug"
                      placeholder="proposal-slug"
                    />
                  </div>

                  <!-- Cost / Budget Amount -->
                  <div class="proposal-cost-row">
                    <label class="cost-label">Estimated:</label>
                    <div class="cost-input-wrapper">
                      <span class="dollar-sign">$</span>
                      <input
                        type="number"
                        step="10000"
                        min="100000"
                        max="500000"
                        class="wysiwyg-amount-input"
                        v-model.number="activeProposal.info.amount"
                        placeholder="500000"
                      />
                    </div>
                  </div>

                  <!-- Plain Text Description Body -->
                  <div class="proposal-description-wrapper">
                    <label class="section-label">Description (Plain Text Paragraphs):</label>
                    <textarea
                      class="wysiwyg-description-input"
                      v-model="activeProposal.translations.en.content"
                      placeholder="Enter proposal description..."
                      rows="6"
                    ></textarea>
                  </div>

                  <!-- Image Alt Text -->
                  <div class="proposal-alt-wrapper">
                    <label class="section-label">Image Alt Text (Accessibility):</label>
                    <input
                      type="text"
                      class="wysiwyg-alt-input"
                      v-model="activeProposal.translations.en.image_alt"
                      placeholder="Describe the image for screen readers..."
                    />
                  </div>

                  <!-- Image Preview and Upload Area -->
                  <div class="proposal-image-section">
                    <label class="section-label">Proposal Image:</label>
                    <div v-if="currentImageUrl" class="image-preview-box">
                      <img :src="currentImageUrl" :alt="activeProposal.translations.en.image_alt" class="preview-img" />
                    </div>
                    <div v-else class="image-placeholder-box">
                      <span>No image uploaded yet</span>
                    </div>

                    <div class="image-upload-controls">
                      <label class="upload-btn">
                        <span>📁 Choose Image</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, image/webp"
                          class="file-input-hidden"
                          @change="onImageSelected"
                        />
                      </label>
                      <span v-if="activeProposal.pendingImage" class="pending-filename">
                        New: {{ activeProposal.pendingImage.filename }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const proposals = ref([]);
const activeProposal = ref(null);
const baseSha = ref('');
const loading = ref(true);
const isSaving = ref(false);
const saveSuccess = ref(false);
const notification = ref(null);
const searchQuery = ref('');

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

// Format numbers with commas (e.g. 500,000)
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString();
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
function onTitleInput() {
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
        title: 'New ballot proposal...',
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
  padding: 24px;
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

/* Mobile Device Container */
.mobile-device-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 420px;
}

/* Mobile Controls Bar */
.mobile-controls-bar {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
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

/* Mobile Phone Frame */
.mobile-phone-frame {
  width: 380px;
  max-width: 100%;
  background: #ffffff;
  border: 10px solid #1a1a1a;
  border-radius: 36px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  position: relative;
}

.phone-screen {
  background: #f7f9fa;
  min-height: 600px;
  display: flex;
  flex-direction: column;
}

.phone-status-bar {
  height: 24px;
  background: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  font-size: 0.7rem;
  font-weight: 600;
  color: #495057;
  border-bottom: 1px solid #f1f3f5;
}

.phone-notch {
  width: 70px;
  height: 12px;
  background: #1a1a1a;
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
}

.phone-content {
  padding: 16px;
  flex: 1;
  overflow-y: auto;
}

/* Proposal Card inside phone */
.proposal-card {
  background: #ffffff;
  border-radius: 8px;
  border: 4px solid #ffffff;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.12);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.proposal-card-top {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.proposal-checkbox-mock {
  display: inline-flex;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 2px solid #28a745;
  color: #28a745;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.85rem;
  flex-shrink: 0;
  margin-top: 4px;
}

.wysiwyg-title-input {
  width: 100%;
  font-size: 1.15rem;
  font-weight: 700;
  color: #091f2f;
  border: 1px dashed transparent;
  border-radius: 4px;
  padding: 4px 6px;
  box-sizing: border-box;
  background: transparent;
  transition: all 0.2s;
}

.wysiwyg-title-input:hover,
.wysiwyg-title-input:focus {
  border-color: #007bff;
  background-color: #fbfdff;
  outline: none;
}

.proposal-slug-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: #6c757d;
  padding: 0 6px;
}

.slug-label {
  font-weight: 600;
}

.slug-input {
  font-family: monospace;
  font-size: 0.8rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  padding: 2px 6px;
  flex: 1;
}

.proposal-cost-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 6px;
}

.cost-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #495057;
}

.cost-input-wrapper {
  display: flex;
  align-items: center;
  font-size: 1.25rem;
  font-weight: 700;
  color: #28a745;
}

.dollar-sign {
  margin-right: 2px;
}

.wysiwyg-amount-input {
  font-size: 1.2rem;
  font-weight: 700;
  color: #28a745;
  border: 1px dashed transparent;
  border-radius: 4px;
  padding: 2px 6px;
  width: 140px;
  background: transparent;
}

.wysiwyg-amount-input:hover,
.wysiwyg-amount-input:focus {
  border-color: #28a745;
  background-color: #fbfdff;
  outline: none;
}

.section-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6c757d;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.proposal-description-wrapper {
  display: flex;
  flex-direction: column;
}

.wysiwyg-description-input {
  width: 100%;
  font-size: 0.95rem;
  line-height: 1.5;
  color: #091f2f;
  border: 1px dashed transparent;
  border-radius: 4px;
  padding: 6px;
  box-sizing: border-box;
  resize: vertical;
  background: transparent;
  font-family: inherit;
  transition: all 0.2s;
}

.wysiwyg-description-input:hover,
.wysiwyg-description-input:focus {
  border-color: #007bff;
  background-color: #fbfdff;
  outline: none;
}

.proposal-alt-wrapper {
  display: flex;
  flex-direction: column;
}

.wysiwyg-alt-input {
  width: 100%;
  font-size: 0.85rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  padding: 6px;
  box-sizing: border-box;
}

.proposal-image-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.image-preview-box {
  width: 100%;
  height: 160px;
  border-radius: 6px;
  overflow: hidden;
  background-color: #000;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder-box {
  width: 100%;
  height: 120px;
  border: 2px dashed #ced4da;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #adb5bd;
  font-size: 0.9rem;
}

.image-upload-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.upload-btn:hover {
  background: #f1f3f5;
}

.file-input-hidden {
  display: none;
}

.pending-filename {
  font-size: 0.75rem;
  color: #007bff;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}
</style>
