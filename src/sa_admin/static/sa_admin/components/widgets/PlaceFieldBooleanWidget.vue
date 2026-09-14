<template>
  <div class="field-widget field-boolean-widget">
    <label class="checkbox-label" :for="widgetId">{{ column.label }}</label>
    <input
      type="checkbox"
      :id="widgetId"
      :name="column.attr"
      :checked="!!modelValue"
      @change="onChange"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  column: { type: Object, required: true },
  placeId: { type: [String, Number], default: 'new' },
  modelValue: { type: [Boolean, String, Number], default: false }
});

const emit = defineEmits(['change', 'update:modelValue']);

const widgetId = computed(() => `place-${props.placeId}-${props.column.attr}-widget`);

function onChange(e) {
  const val = e.target.checked;
  emit('update:modelValue', val);
  emit('change', { column: props.column, value: val });
}
</script>
