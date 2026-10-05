<template>
  <dialog
    ref="dialogRef"
    class="modal-dialog"
    closedby="any"
    aria-labelledby="voter-support-dialog-title"
    @click="handleBackdropClick"
    @close="onDialogClose"
  >
    <div class="modal-header">
      <h3 id="voter-support-dialog-title">Voter Support</h3>
      <button
        type="button"
        class="modal-close-btn"
        aria-label="Close"
        @click="closeModal"
      >×</button>
    </div>

    <div class="modal-body">
      <div v-if="errorMessage" class="banner" data-state="error" role="alert">
        {{ errorMessage }}
      </div>

      <p class="voter-support-intro">
        Use the following to provide a code for voters that are not able to receive SMS messages.
      </p>

      <div class="voter-support-action-row">
        <button
          type="button"
          class="button"
          data-variant="primary"
          :disabled="loading"
          @click="generateCode"
        >
          {{ loading ? 'Generating...' : (codeData ? 'Generate New Code' : 'Generate Code') }}
        </button>
      </div>

      <div v-if="codeData" class="voter-code-section">
        <p style="margin: 0.5rem 0 0.35rem; font-weight: 600;">
          Share the following with the voter:
        </p>
        <div class="voter-code-card">
          <div>
            Your code to vote in Boston's Ideas in Action is:
            <strong class="code-highlight">{{ codeData.code.toUpperCase() }}</strong>
          </div>

          <div>
            Enter the code at<br>
            <a :href="voterVerificationUrl" target="_blank" rel="noopener noreferrer" class="voter-link">
              {{ voterVerificationUrl }}
            </a>
          </div>

          <div class="voter-expiry">
            This code will expire: {{ formattedExpiration }}
          </div>

          <div class="voter-code-card-actions">
            <button
              type="button"
              class="button"
              data-variant="secondary"
              data-size="sm"
              @click="copyInstructions"
            >
              {{ copied ? 'Copied!' : 'Copy Instructions' }}
            </button>
            <span v-if="copied" class="copy-feedback">
              ✓ Copied to clipboard
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button
        type="button"
        class="button"
        data-variant="secondary"
        @click="closeModal"
      >
        Close
      </button>
    </div>
  </dialog>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const dialogRef = ref(null);
const loading = ref(false);
const errorMessage = ref(null);
const codeData = ref(null);
const copied = ref(false);
let copyTimeout = null;

const voterVerificationUrl = computed(() => {
  return `${window.location.origin}/vote/auth/verify-code`;
});

const formattedExpiration = computed(() => {
  if (!codeData.value || !codeData.value.expires_at) return '';
  try {
    const date = new Date(codeData.value.expires_at);
    return new Intl.DateTimeFormat(undefined, {
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch (err) {
    return codeData.value.expires_at;
  }
});

function openModal() {
  errorMessage.value = null;
  copied.value = false;
  dialogRef.value?.showModal();
}

function closeModal() {
  dialogRef.value?.close();
}

function onDialogClose() {
  errorMessage.value = null;
}

function handleBackdropClick(event) {
  if (event.target !== dialogRef.value) return;
  const rect = dialogRef.value.getBoundingClientRect();
  const isInside = (
    rect.top <= event.clientY &&
    event.clientY <= rect.top + rect.height &&
    rect.left <= event.clientX &&
    event.clientX <= rect.left + rect.width
  );
  if (!isInside) {
    closeModal();
  }
}

async function generateCode() {
  loading.value = true;
  errorMessage.value = null;
  copied.value = false;

  try {
    const res = await fetch('/admin/generate-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'same-origin',
    });

    if (res.status === 403) {
      errorMessage.value = 'You do not have permission to generate voter codes. Please contact an administrator.';
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      errorMessage.value = data.error || 'Failed to generate voter code.';
      return;
    }

    codeData.value = data;
  } catch (err) {
    errorMessage.value = 'A network error occurred while generating the code.';
  } finally {
    loading.value = false;
  }
}

async function copyInstructions() {
  if (!codeData.value) return;

  const textToCopy = `Your code to vote in Boston's Ideas in Action is: ${codeData.value.code.toUpperCase()}.\n\nEnter the code at\n${voterVerificationUrl.value}\n\nThis code will expire: ${formattedExpiration.value}`;

  let success = false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(textToCopy);
      success = true;
    } catch {
      success = fallbackCopyText(textToCopy);
    }
  } else {
    success = fallbackCopyText(textToCopy);
  }

  if (success) {
    copied.value = true;
    if (copyTimeout) clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => {
      copied.value = false;
    }, 3000);
  }
}

function fallbackCopyText(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '-9999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const res = document.execCommand('copy');
    document.body.removeChild(textArea);
    return res;
  } catch {
    document.body.removeChild(textArea);
    return false;
  }
}

onMounted(() => {
  window.addEventListener('open-voter-support', openModal);
});

onUnmounted(() => {
  window.removeEventListener('open-voter-support', openModal);
  if (copyTimeout) clearTimeout(copyTimeout);
});
</script>
