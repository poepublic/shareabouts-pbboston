<template>
  <div v-if="show && currentConflict" class="modal-overlay">
    <div class="modal-dialog">
      <div class="modal-header conflict-modal-header">
        <h3>
          ⚠️ Concurrent Edit Conflict
          <span v-if="totalConflicts > 1" class="conflict-step-badge">
            ({{ currentIndex + 1 }} of {{ totalConflicts }})
          </span>
        </h3>
        <button class="modal-close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <p class="conflict-notice">
          Another admin has saved changes since you opened this page. We have loaded the current proposals from GitHub.
          Please verify your updates for <strong v-if="currentConflict.slug">"{{ currentConflict.title || currentConflict.slug }}"</strong>, make any adjustments needed, and resolve the conflict below.
        </p>

        <div v-if="!currentHeadProposal" class="banner" data-state="danger">
          This proposal was removed from GitHub by another administrator. Choosing "Discard My Changes" will remove it from your editor.
        </div>

        <div class="conflict-comparison" v-else-if="currentHeadProposal && currentLocalProposal">
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
              <div class="diff-col col-head">{{ currentHeadProposal.translations?.en?.title || '—' }}</div>
              <div
                class="diff-col col-local"
                :class="{ 'has-diff': currentHeadProposal.translations?.en?.title !== currentLocalProposal.translations?.en?.title }"
              >
                {{ currentLocalProposal.translations?.en?.title || '—' }}
              </div>
            </div>

            <!-- Amount Diff -->
            <div class="diff-row">
              <div class="diff-col field-name">Estimated Cost</div>
              <div class="diff-col col-head">${{ formatNumber(currentHeadProposal.info?.amount || 0) }}</div>
              <div
                class="diff-col col-local"
                :class="{ 'has-diff': Number(currentHeadProposal.info?.amount) !== Number(currentLocalProposal.info?.amount) }"
              >
                ${{ formatNumber(currentLocalProposal.info?.amount || 0) }}
              </div>
            </div>

            <!-- Description Diff -->
            <div class="diff-row">
              <div class="diff-col field-name">Description</div>
              <div class="diff-col col-head">{{ currentHeadProposal.translations?.en?.content || '—' }}</div>
              <div
                class="diff-col col-local"
                :class="{ 'has-diff': currentHeadProposal.translations?.en?.content !== currentLocalProposal.translations?.en?.content }"
              >
                {{ currentLocalProposal.translations?.en?.content || '—' }}
              </div>
            </div>

            <!-- Image Alt Diff -->
            <div class="diff-row">
              <div class="diff-col field-name">Alt Text</div>
              <div class="diff-col col-head">{{ currentHeadProposal.translations?.en?.image_alt || '—' }}</div>
              <div
                class="diff-col col-local"
                :class="{ 'has-diff': currentHeadProposal.translations?.en?.image_alt !== currentLocalProposal.translations?.en?.image_alt }"
              >
                {{ currentLocalProposal.translations?.en?.image_alt || '—' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          type="button"
          class="button"
          data-variant="danger"
          @click="onUseHead"
        >
          Discard My Changes & Use Latest HEAD
        </button>
        <button
          type="button"
          class="button"
          data-variant="primary"
          @click="onKeepLocal"
        >
          Keep My Local Changes
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  conflicts: {
    type: Array,
    default: () => [],
  },
  headProposal: {
    type: Object,
    default: null,
  },
  localProposal: {
    type: Object,
    default: null,
  },
  formatNumber: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(['close', 'use-head', 'keep-local', 'all-resolved']);

const currentIndex = ref(0);

const activeConflicts = computed(() => {
  if (props.conflicts && props.conflicts.length > 0) {
    return props.conflicts;
  }
  if (props.headProposal || props.localProposal) {
    return [{
      headProposal: props.headProposal,
      localProposal: props.localProposal,
      slug: props.localProposal?.slug || props.headProposal?.slug || '',
      title: props.localProposal?.translations?.en?.title || props.headProposal?.translations?.en?.title || '',
    }];
  }
  return [];
});

watch(
  () => props.show,
  (val) => {
    if (val) currentIndex.value = 0;
  }
);

const totalConflicts = computed(() => activeConflicts.value.length);
const currentConflict = computed(() => activeConflicts.value[currentIndex.value] || null);
const currentHeadProposal = computed(() => currentConflict.value?.headProposal || null);
const currentLocalProposal = computed(() => currentConflict.value?.localProposal || null);

function onUseHead() {
  const item = currentConflict.value;
  emit('use-head', item);
  if (currentIndex.value < totalConflicts.value - 1) {
    currentIndex.value++;
  } else {
    emit('all-resolved');
    emit('close');
  }
}

function onKeepLocal() {
  const item = currentConflict.value;
  emit('keep-local', item);
  if (currentIndex.value < totalConflicts.value - 1) {
    currentIndex.value++;
  } else {
    emit('all-resolved');
    emit('close');
  }
}
</script>

<style scoped>
.conflict-modal-header {
  background-color: var(--admin-color-danger-bg);
  border-bottom: 1px solid var(--admin-color-danger-border);
}

.conflict-modal-header h3 {
  color: var(--admin-color-danger-text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.conflict-step-badge {
  font-size: 0.85rem;
  font-weight: 500;
  opacity: 0.85;
}

.conflict-modal-header .modal-close-btn {
  color: var(--admin-color-danger-text);
}

.conflict-notice {
  margin: 0;
  line-height: 1.5;
  background-color: var(--admin-color-warning-bg);
  border-left: 4px solid var(--admin-color-warning-border);
  padding: 12px 14px;
  border-radius: var(--admin-radius-sm);
  color: var(--admin-color-warning-text);
}

.conflict-comparison h4 {
  margin: 0 0 10px 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--admin-color-text);
}

.diff-table {
  border: 1px solid var(--admin-color-border-subtle);
  border-radius: var(--admin-radius-md);
  overflow: hidden;
  font-size: 0.85rem;
}

.diff-row {
  display: flex;
  border-bottom: 1px solid var(--admin-color-surface-hover);
}
.diff-row:last-child {
  border-bottom: none;
}

.diff-header-row {
  background-color: var(--admin-color-surface-subtle);
  font-weight: 600;
  color: var(--admin-color-text-muted);
}

.diff-col {
  padding: 8px 12px;
  flex: 1;
  word-break: break-word;
}

.diff-col.field-name {
  flex: 0 0 110px;
  font-weight: 600;
  color: var(--admin-color-text-muted);
  background-color: var(--admin-color-surface-subtle);
  border-right: 1px solid var(--admin-color-surface-hover);
}

.diff-col.col-head {
  border-right: 1px solid var(--admin-color-surface-hover);
  background-color: var(--admin-color-surface);
}

.diff-col.col-local.has-diff {
  background-color: var(--admin-color-dirty-bg);
  color: var(--admin-color-dirty-text);
  font-weight: 600;
}
</style>
