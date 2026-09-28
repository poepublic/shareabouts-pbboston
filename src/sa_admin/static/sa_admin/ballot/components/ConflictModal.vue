<template>
  <div v-if="show" class="conflict-modal-overlay">
    <div class="conflict-modal-dialog">
      <div class="conflict-modal-header">
        <h3>⚠️ Concurrent Edit Conflict</h3>
        <button class="modal-close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="conflict-modal-body">
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

      <div class="conflict-modal-footer">
        <button class="btn-conflict-revert" @click="$emit('use-head')">
          Discard My Changes & Use Latest HEAD
        </button>
        <button class="btn-conflict-keep" @click="$emit('keep-local')">
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
