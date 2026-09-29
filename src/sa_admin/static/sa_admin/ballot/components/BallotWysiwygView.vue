<template>
  <div class="wysiwyg-view-container">
    <!-- Slug field (Above the preview frame, per user feedback) -->
    <div class="external-field-row">
      <div class="field-label-row">
        <label class="external-field-label" for="proposal-slug-input">Slug:</label>
        <span v-if="isFieldDirty(proposal, 'slug')" class="dirty-tag">modified</span>
      </div>
      <input
        id="proposal-slug-input"
        type="text"
        class="external-field-input slug-input"
        :class="{ 'is-dirty': isFieldDirty(proposal, 'slug'), 'has-error': isSlugDuplicate }"
        v-model="proposal.slug"
        placeholder="e.g. bus-shelter-upgrades"
        @input="$emit('slug-input')"
      />
      <div v-if="isSlugDuplicate" class="field-error-message">
        ⚠️ This slug is already in use by another proposal.
      </div>
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
                :class="{ 'is-dirty': isFieldDirty(proposal, 'title') }"
                v-model="proposal.translations.en.title"
                placeholder="PROPOSAL TITLE"
                rows="1"
                @input="handleTitleInput"
              ></textarea>
            </div>
          </div>

          <!-- Proposal Cost (Green bold amount, editable) -->
          <div class="proposal-cost-row">
            <span class="cost-dollar">$</span>
            <input
              type="text"
              class="proposal-cost-input"
              :class="{ 'is-dirty': isFieldDirty(proposal, 'amount') }"
              :value="displayAmount"
              @input="handleAmountInput"
              @blur="handleAmountBlur"
              @focus="$event.target.select()"
              placeholder="200,000"
            />
          </div>

          <!-- Proposal Description (Uppercase bold Montserrat plain text) -->
          <div class="proposal-description-container">
            <textarea
              ref="descInputRef"
              class="proposal-description-input"
              :class="{ 'is-dirty': isFieldDirty(proposal, 'content') }"
              v-model="proposal.translations.en.content"
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
              'is-dirty': isFieldDirty(proposal, 'image'),
            }"
            @click="triggerImageUpload"
            title="Click to choose or change image"
          >
            <img
              v-if="currentImageUrl"
              class="proposal-image"
              :src="currentImageUrl"
              :alt="proposal.translations?.en?.image_alt || getProposalTitle(proposal)"
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
              @change="handleFileChange"
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
        <span v-if="isFieldDirty(proposal, 'image_alt')" class="dirty-tag">modified</span>
      </div>
      <input
        id="proposal-alt-input"
        type="text"
        class="external-field-input"
        :class="{ 'is-dirty': isFieldDirty(proposal, 'image_alt') }"
        v-model="proposal.translations.en.image_alt"
        placeholder="Describe the image for screen readers..."
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';

const props = defineProps({
  proposal: {
    type: Object,
    required: true,
  },
  currentImageUrl: {
    type: String,
    default: '',
  },
  isFieldDirty: {
    type: Function,
    required: true,
  },
  formatNumber: {
    type: Function,
    required: true,
  },
  getProposalTitle: {
    type: Function,
    required: true,
  },
  isSlugDuplicate: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  'title-input',
  'slug-input',
  'image-selected',
]);

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

function handleTitleInput(e) {
  autoResizeTextarea(e.target);
  emit('title-input', e);
}

const displayAmount = computed(() => {
  return props.formatNumber(props.proposal?.info?.amount ?? 0);
});

function handleAmountInput(e) {
  const raw = e.target.value.replace(/[^\d]/g, '');
  const val = raw ? parseInt(raw, 10) : 0;
  if (props.proposal) {
    if (!props.proposal.info) props.proposal.info = {};
    props.proposal.info.amount = val;
  }
}

function handleAmountBlur(e) {
  e.target.value = props.formatNumber(props.proposal?.info?.amount ?? 0);
}

function handleFileChange(event) {
  const file = event.target.files?.[0];
  if (file) {
    emit('image-selected', file);
  }
}

// Auto-adjust textareas on proposal change
watch(
  () => props.proposal,
  () => {
    nextTick(() => {
      autoResizeTextarea(titleInputRef.value);
      autoResizeTextarea(descInputRef.value);
    });
  },
  { immediate: true, deep: true }
);
</script>

<style scoped>
.wysiwyg-view-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 14px;
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

.external-field-input.has-error {
  border-color: #dc3545 !important;
  background-color: #fff8f8 !important;
}

.field-error-message {
  margin-top: 4px;
  font-size: 0.8rem;
  color: #dc3545;
  font-weight: 600;
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
</style>
