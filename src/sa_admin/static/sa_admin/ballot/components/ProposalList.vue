<template>
  <aside class="proposal-sidebar">
    <div class="sidebar-header">
      <h2>BALLOT PROPOSALS <span class="badge">{{ proposals.length }}</span></h2>
      <button class="add-proposal-btn" @click="$emit('add')" :disabled="loading">
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
            :class="['trans-indicator', getMissingTranslationsCount(prop) > 0 ? 'missing' : 'complete']"
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

defineEmits(['select', 'add', 'delete']);

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
  gap: 6px;
  flex-shrink: 0;
}

.trans-indicator {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: 4px;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.trans-indicator.missing {
  background-color: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.trans-indicator.complete {
  background-color: #d1fae5;
  color: #065f46;
  border: 1px solid #a7f3d0;
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
</style>
