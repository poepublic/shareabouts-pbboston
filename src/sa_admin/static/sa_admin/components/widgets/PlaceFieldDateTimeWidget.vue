<template>
  <div class="field-widget field-datetime-widget">
    <label :for="widgetId">{{ column.label }}</label>
    <input
      type="datetime-local"
      :id="widgetId"
      :name="column.attr"
      :value="localValue"
      @change="onChange"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  column: { type: Object, required: true },
  placeId: { type: [String, Number], default: 'new' },
  modelValue: { type: String, default: '' }
});

const emit = defineEmits(['change', 'update:modelValue']);

const widgetId = computed(() => `place-${props.placeId}-${props.column.attr}-widget`);

function datetimeUtcToLocal(datetime) {
  if (!datetime) return '';
  const date = new Date(datetime);
  if (isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  date.setMinutes(date.getMinutes() - offset);
  return date.toISOString().slice(0, 19);
}

function datetimeLocalToUTC(datetime) {
  if (!datetime) return '';
  const date = new Date(datetime);
  if (isNaN(date.getTime())) return '';
  return date.toISOString();
}

const localValue = computed(() => datetimeUtcToLocal(props.modelValue));

function onChange(e) {
  const localVal = e.target.value;
  const utcVal = datetimeLocalToUTC(localVal);
  emit('update:modelValue', utcVal);
  emit('change', { column: props.column, value: utcVal });
}
</script>
