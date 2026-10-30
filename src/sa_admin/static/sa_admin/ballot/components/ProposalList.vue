<template>
  <aside class="proposal-sidebar">
    <div class="sidebar-header">
      <h2>BALLOT PROPOSALS <span class="badge">{{ proposals.length }}</span></h2>
      <button class="button add-proposal-btn" data-variant="ghost-dashed" @click="$emit('add')" :disabled="loading">
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
        @click="$emit('select', prop)"
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
          <span
            v-if="supportedLanguages.length > 0"
            class="pill trans-indicator"
            :data-state="getMissingTranslationsCount(prop) > 0 ? 'warning' : 'success'"
            :title="getMissingTranslationsCount(prop) > 0 ? `${getMissingTranslationsCount(prop)} language translation(s) missing` : 'All threshold languages translated'"
          >
            {{ getMissingTranslationsCount(prop) > 0 ? '⚠️' : '✓' }} {{ supportedLanguages.length - getMissingTranslationsCount(prop) }}/{{ supportedLanguages.length }}
          </span>
          <span class="item-amount">${{ formatNumber(prop.info?.amount || 0) }}</span>
          <button
            class="delete-item-btn"
            title="Delete proposal"
            @click.stop="$emit('delete', prop)"
          >
            ×
          </button>
        </div>
      </li>
      <li v-if="filteredProposals.length === 0" class="no-proposals">
        No proposals found.
      </li>
    </ul>

    <!-- Pinned Footer: Discard All & Save All Actions -->
    <div class="sidebar-footer actions-wrapper">
      <button
        class="button"
        data-variant="secondary"
        :disabled="dirtyCount === 0 || isSaving || loading"
        @click="$emit('discard-all')"
        title="Discard all unsaved changes across all proposals"
      >
        Discard All Changes
      </button>
      <button
        class="button"
        data-variant="primary"
        :disabled="dirtyCount === 0 || isSaving || loading"
        @click="$emit('save-all')"
        :title="dirtyCount > 0 ? `Save all changes (${dirtyCount} proposal${dirtyCount === 1 ? '' : 's'}) to GitHub` : 'No unsaved changes'"
      >
        <span v-if="isSaving" class="spinner-sm"></span>
        Save All Changes{{ dirtyCount > 0 ? ` (${dirtyCount})` : '' }}
      </button>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  proposals: {
    type: Array,
    required: true,
  },
  activeProposal: {
    type: Object,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  dirtyCount: {
    type: Number,
    default: 0,
  },
  isSaving: {
    type: Boolean,
    default: false,
  },
  isProposalDirty: {
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
  supportedLanguages: {
    type: Array,
    default: () => [],
  },
});

defineEmits(['select', 'add', 'delete', 'discard-all', 'save-all']);

const searchQuery = ref('');

const filteredProposals = computed(() => {
  if (!searchQuery.value.trim()) return props.proposals;
  const q = searchQuery.value.toLowerCase().trim();
  return props.proposals.filter((p) => {
    if ((p.slug || '').toLowerCase().includes(q)) return true;
    if (p.translations) {
      for (const t of Object.values(p.translations)) {
        if (t?.title && t.title.toLowerCase().includes(q)) return true;
        if (t?.content && t.content.toLowerCase().includes(q)) return true;
        if (t?.image_alt && t.image_alt.toLowerCase().includes(q)) return true;
      }
    }
    return false;
  });
});

function getMissingTranslationsCount(prop) {
  if (!prop || !props.supportedLanguages.length) return 0;
  let missing = 0;
  for (const lang of props.supportedLanguages) {
    const t = prop.translations?.[lang.code];
    if (!t || !t.title || !t.content) {
      missing++;
    }
  }
  return missing;
}
</script>

<style scoped>
.proposal-sidebar {
  width: 380px;
  min-width: 340px;
  background-color: var(--admin-color-surface);
  border-right: 1px solid var(--admin-color-border);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
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

.add-proposal-btn {
  width: 100%;
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
  color: var(--admin-color-text-muted);
  font-style: italic;
}

.proposal-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  min-height: 0;
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
  background-color: var(--admin-color-surface-hover);
}

.proposal-list-item.active {
  background-color: var(--admin-color-primary-subtle);
  border-left: 4px solid var(--admin-color-primary);
}

.item-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  margin-right: 8px;
}

.selection-indicator {
  color: var(--admin-color-primary);
  font-size: 0.8rem;
  opacity: 0;
}

.proposal-list-item.active .selection-indicator {
  opacity: 1;
}

.dirty-indicator-dot {
  color: var(--admin-color-warning-border);
  font-size: 0.85rem;
  margin-left: 2px;
  flex-shrink: 0;
}

.item-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--admin-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.item-amount {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--admin-color-success-text);
  background: var(--admin-color-success-bg);
  padding: 2px 6px;
  border-radius: var(--admin-radius-sm);
}

.delete-item-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: var(--admin-color-text-subtle);
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  border-radius: var(--admin-radius-sm);
}

.delete-item-btn:hover {
  color: var(--admin-color-danger);
  background-color: var(--admin-color-danger-bg);
}

.no-proposals {
  padding: 20px;
  text-align: center;
  color: var(--admin-color-text-muted);
  font-size: 0.9rem;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--admin-color-border);
  background-color: var(--admin-color-surface);
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.sidebar-footer .button {
  flex: 1;
  font-size: 0.85rem;
  padding: 8px 10px;
  white-space: nowrap;
}

.spinner-sm {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 4px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
