<template>
  <div v-if="show" class="translate-modal-overlay" @click.self="handleOverlayClick">
    <div class="translate-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="translate-dialog-title">
      <div class="translate-modal-header">
        <h3 id="translate-dialog-title">
          <span class="magic-icon">✨</span> Translate Proposal
        </h3>
        <button
          type="button"
          class="modal-close-btn"
          :disabled="isTranslating"
          @click="handleClose"
          aria-label="Close"
        >×</button>
      </div>

      <div class="translate-modal-body">
        <!-- 1. Fields to translate -->
        <div class="form-section">
          <label class="section-title">Fields to translate:</label>
          <div class="fields-row">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="fields.title"
                :disabled="isTranslating"
              />
              <span>Titles</span>
            </label>
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="fields.content"
                :disabled="isTranslating"
              />
              <span>Descriptions</span>
            </label>
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="fields.image_alt"
                :disabled="isTranslating"
              />
              <span>Image Alt Text</span>
            </label>
          </div>
        </div>

        <!-- 2. Source language -->
        <div class="form-section">
          <label class="section-title" for="source-lang-select">Source language:</label>
          <div class="source-select-row">
            <span>From:</span>
            <select
              id="source-lang-select"
              v-model="sourceLanguage"
              class="source-select"
              :disabled="isTranslating"
            >
              <option
                v-for="lang in supportedLanguages"
                :key="lang.code"
                :value="lang.code"
              >
                {{ lang.label }} ({{ lang.code }})
              </option>
            </select>
          </div>
          <p v-if="!hasSourceContent" class="source-warning">
            ⚠️ The selected source language has no text for the chosen fields.
          </p>
        </div>

        <!-- 3. Target languages -->
        <div class="form-section">
          <label class="section-title">Target languages:</label>
          <div class="targets-grid">
            <label
              v-for="lang in supportedLanguages"
              :key="lang.code"
              class="target-lang-item"
              :class="{ 'is-source': lang.code === sourceLanguage }"
            >
              <input
                type="checkbox"
                :value="lang.code"
                v-model="selectedTargets"
                :disabled="lang.code === sourceLanguage || isTranslating"
              />
              <span class="target-lang-text">
                {{ lang.label }}
                <span class="lang-code">({{ lang.code }})</span>
                <span v-if="lang.code === sourceLanguage" class="tag-source">source</span>
                <span v-else-if="isLanguageMissing(lang.code)" class="tag-missing" title="Missing translations">⚠️</span>
              </span>
            </label>
          </div>

          <!-- Quick Select Toolbar -->
          <div class="quick-select-bar">
            <span class="quick-select-label">Quick select:</span>
            <button
              type="button"
              class="btn-quick-select"
              :disabled="isTranslating"
              @click="quickSelectAll"
            >All</button>
            <span class="quick-select-divider">|</span>
            <button
              type="button"
              class="btn-quick-select"
              :disabled="isTranslating"
              @click="quickSelectMissing"
            >Missing Only</button>
            <span class="quick-select-divider">|</span>
            <button
              type="button"
              class="btn-quick-select"
              :disabled="isTranslating"
              @click="quickSelectClear"
            >Clear</button>
          </div>
        </div>

        <!-- 4. Dynamic Overwrite Warning Banner -->
        <div v-if="hasExistingContent" class="overwrite-warning" role="alert">
          <span class="warning-icon">⚠️</span>
          <div class="warning-text">
            <strong>Note:</strong> Using automatic translation will override manual translations in selected languages.
          </div>
        </div>
      </div>

      <div class="translate-modal-footer">
        <button
          type="button"
          class="btn-modal-cancel"
          :disabled="isTranslating"
          @click="handleClose"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn-modal-translate"
          :disabled="!canTranslate"
          @click="handleTranslate"
        >
          <span v-if="isTranslating" class="spinner-sm"></span>
          <span v-else class="magic-icon">✨</span>
          {{ isTranslating ? 'Translating...' : `Translate (${selectedTargets.length})` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  proposal: {
    type: Object,
    default: null,
  },
  supportedLanguages: {
    type: Array,
    default: () => [],
  },
  isTranslating: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close', 'translate']);

const fields = ref({
  title: true,
  content: true,
  image_alt: true,
});

const sourceLanguage = ref('en');
const selectedTargets = ref([]);

function isLanguageMissing(langCode) {
  if (!props.proposal || !props.proposal.translations) return true;
  const t = props.proposal.translations[langCode];
  if (!t) return true;

  const src = props.proposal.translations[sourceLanguage.value] || {};

  let checkedAny = false;
  if (fields.value.title && src.title && src.title.trim()) {
    checkedAny = true;
    if (!t.title || !t.title.trim()) return true;
  }
  if (fields.value.content && src.content && src.content.trim()) {
    checkedAny = true;
    if (!t.content || !t.content.trim()) return true;
  }
  if (fields.value.image_alt && src.image_alt && src.image_alt.trim()) {
    checkedAny = true;
    if (!t.image_alt || !t.image_alt.trim()) return true;
  }

  if (!checkedAny) {
    return !(t.title && t.title.trim()) || !(t.content && t.content.trim());
  }

  return false;
}

function quickSelectAll() {
  selectedTargets.value = (props.supportedLanguages || [])
    .filter((l) => l.code !== sourceLanguage.value)
    .map((l) => l.code);
}

function quickSelectMissing() {
  selectedTargets.value = (props.supportedLanguages || [])
    .filter((l) => l.code !== sourceLanguage.value && isLanguageMissing(l.code))
    .map((l) => l.code);
}

function quickSelectClear() {
  selectedTargets.value = [];
}

// Ensure source language is never among target selections
watch(sourceLanguage, (newSource) => {
  selectedTargets.value = selectedTargets.value.filter((code) => code !== newSource);
});

// Initialize / reset selections when modal opens or active proposal changes
function resetSelections() {
  sourceLanguage.value = 'en';
  fields.value = {
    title: true,
    content: true,
    image_alt: true,
  };
  quickSelectMissing();
}

watch(
  () => props.show,
  (isOpen) => {
    if (isOpen) {
      resetSelections();
    }
  }
);

watch(
  () => props.proposal,
  () => {
    if (props.show) {
      resetSelections();
    }
  }
);

const hasSourceContent = computed(() => {
  if (!props.proposal || !props.proposal.translations) return false;
  const src = props.proposal.translations[sourceLanguage.value];
  if (!src) return false;

  if (fields.value.title && src.title && src.title.trim()) return true;
  if (fields.value.content && src.content && src.content.trim()) return true;
  if (fields.value.image_alt && src.image_alt && src.image_alt.trim()) return true;

  return false;
});

const hasExistingContent = computed(() => {
  if (!props.proposal || !props.proposal.translations) return false;
  if (selectedTargets.value.length === 0) return false;

  return selectedTargets.value.some((langCode) => {
    const t = props.proposal.translations[langCode];
    if (!t) return false;

    if (fields.value.title && t.title && t.title.trim()) return true;
    if (fields.value.content && t.content && t.content.trim()) return true;
    if (fields.value.image_alt && t.image_alt && t.image_alt.trim()) return true;

    return false;
  });
});

const canTranslate = computed(() => {
  if (props.isTranslating) return false;
  if (selectedTargets.value.length === 0) return false;
  if (!fields.value.title && !fields.value.content && !fields.value.image_alt) return false;
  if (!hasSourceContent.value) return false;
  return true;
});

function handleOverlayClick() {
  if (!props.isTranslating) {
    handleClose();
  }
}

function handleClose() {
  emit('close');
}

function handleTranslate() {
  if (!canTranslate.value) return;
  emit('translate', {
    sourceLanguage: sourceLanguage.value,
    targetLanguages: [...selectedTargets.value],
    fields: { ...fields.value },
  });
}

function handleKeyDown(e) {
  if (e.key === 'Escape' && props.show && !props.isTranslating) {
    handleClose();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.translate-modal-overlay {
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

.translate-modal-dialog {
  background: #ffffff;
  border-radius: 12px;
  max-width: 620px;
  width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 90vh;
}

.translate-modal-header {
  padding: 16px 20px;
  background-color: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.translate-modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #64748b;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}
.modal-close-btn:hover:not(:disabled) {
  color: #1e293b;
}
.modal-close-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.translate-modal-body {
  padding: 20px;
  overflow-y: auto;
  font-size: 0.95rem;
  color: #334155;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.fields-row {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  font-size: 0.95rem;
  color: #1e293b;
}

.source-select-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.95rem;
}

.source-select {
  padding: 6px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.9rem;
  background-color: #ffffff;
  color: #1e293b;
  cursor: pointer;
}
.source-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.source-warning {
  margin: 4px 0 0 0;
  font-size: 0.85rem;
  color: #b45309;
}

.targets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px 12px;
}

.target-lang-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #1e293b;
}

.target-lang-item:hover:not(.is-source) {
  background-color: #f1f5f9;
}

.target-lang-item.is-source {
  opacity: 0.55;
  cursor: not-allowed;
}

.target-lang-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.lang-code {
  color: #64748b;
  font-size: 0.82rem;
}

.tag-source {
  font-size: 0.72rem;
  background-color: #e2e8f0;
  color: #475569;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 600;
  text-transform: lowercase;
}

.tag-missing {
  font-size: 0.78rem;
}

.quick-select-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #64748b;
  padding-top: 4px;
}

.quick-select-label {
  font-weight: 600;
  color: #475569;
}

.btn-quick-select {
  background: none;
  border: none;
  color: #0284c7;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 2px 4px;
  font-weight: 500;
  text-decoration: underline;
}
.btn-quick-select:hover:not(:disabled) {
  color: #0369a1;
}
.btn-quick-select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.quick-select-divider {
  color: #cbd5e1;
}

.overwrite-warning {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background-color: #fffbeb;
  border: 1px solid #fef3c7;
  border-left: 4px solid #f59e0b;
  padding: 10px 14px;
  border-radius: 6px;
  color: #92400e;
  font-size: 0.88rem;
  line-height: 1.4;
}

.warning-icon {
  font-size: 1.05rem;
  flex-shrink: 0;
  margin-top: 1px;
}

.translate-modal-footer {
  padding: 14px 20px;
  background-color: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-modal-cancel {
  background: #ffffff;
  color: #475569;
  border: 1px solid #cbd5e1;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-modal-cancel:hover:not(:disabled) {
  background-color: #f1f5f9;
  color: #1e293b;
}
.btn-modal-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-modal-translate {
  background-color: #007bff;
  color: #ffffff;
  border: none;
  padding: 8px 18px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.15s;
}
.btn-modal-translate:hover:not(:disabled) {
  background-color: #0056b3;
}
.btn-modal-translate:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.magic-icon {
  font-size: 0.95rem;
}

.spinner-sm {
  width: 14px;
  height: 14px;
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
</style>
