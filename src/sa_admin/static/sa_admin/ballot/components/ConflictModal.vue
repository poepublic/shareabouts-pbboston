<template>
  <div v-if="show" class="modal-overlay">
    <div class="modal-dialog">
      <div class="modal-header conflict-modal-header">
        <h3>⚠️ Concurrent Edit Conflict</h3>
        <button class="modal-close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <p class="conflict-notice">
          Another admin has saved changes since you opened this page. We have loaded the current proposals.
          Please carefully verify your updates against the current proposals, make any new updates as necessary,
          and re-save your changes.
        </p>

        <div class="conflict-comparison" v-if="headProposal && localProposal">
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
              <div class="diff-col col-head">{{ headProposal.translations?.en?.title || '—' }}</div>
              <div
                class="diff-col col-local"
                :class="{ 'has-diff': headProposal.translations?.en?.title !== localProposal.translations?.en?.title }"
              >
                {{ localProposal.translations?.en?.title || '—' }}
              </div>
            </div>

            <!-- Amount Diff -->
            <div class="diff-row">
              <div class="diff-col field-name">Estimated Cost</div>
              <div class="diff-col col-head">${{ formatNumber(headProposal.info?.amount || 0) }}</div>
              <div
                class="diff-col col-local"
                :class="{ 'has-diff': Number(headProposal.info?.amount) !== Number(localProposal.info?.amount) }"
              >
                ${{ formatNumber(localProposal.info?.amount || 0) }}
              </div>
            </div>

            <!-- Description Diff -->
            <div class="diff-row">
              <div class="diff-col field-name">Description</div>
              <div class="diff-col col-head">{{ headProposal.translations?.en?.content || '—' }}</div>
              <div
                class="diff-col col-local"
                :class="{ 'has-diff': headProposal.translations?.en?.content !== localProposal.translations?.en?.content }"
              >
                {{ localProposal.translations?.en?.content || '—' }}
              </div>
            </div>

            <!-- Image Alt Diff -->
            <div class="diff-row">
              <div class="diff-col field-name">Alt Text</div>
              <div class="diff-col col-head">{{ headProposal.translations?.en?.image_alt || '—' }}</div>
              <div
                class="diff-col col-local"
                :class="{ 'has-diff': headProposal.translations?.en?.image_alt !== localProposal.translations?.en?.image_alt }"
              >
                {{ localProposal.translations?.en?.image_alt || '—' }}
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
          @click="$emit('use-head')"
        >
          Discard My Changes & Use Latest HEAD
        </button>
        <button
          type="button"
          class="button"
          data-variant="primary"
          @click="$emit('keep-local')"
        >
          Keep My Local Changes
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  show: {
    type: Boolean,
    default: false,
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

defineEmits(['close', 'use-head', 'keep-local']);
</script>

<style scoped>
.conflict-modal-header {
  background-color: var(--admin-color-danger-bg);
  border-bottom: 1px solid var(--admin-color-danger-border);
}

.conflict-modal-header h3 {
  color: var(--admin-color-danger-text);
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
