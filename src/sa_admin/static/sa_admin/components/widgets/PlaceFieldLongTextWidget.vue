<template>
  <div class="field-widget field-longtext-widget">
    <label :for="widgetId">{{ column.label }}</label>
    <textarea
      :id="widgetId"
      :name="column.attr"
      :value="modelValue ?? ''"
      @change="onChange"
    ></textarea>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  column: { type: Object, required: true },
  placeId: { type: [String, Number], default: 'new' },
  modelValue: { type: [String, Number], default: '' }
});

const emit = defineEmits(['change', 'update:modelValue']);

const widgetId = computed(() => `place-${props.placeId}-${props.column.attr}-widget`);

function onChange(e) {
  const val = e.target.value;
  emit('update:modelValue', val);
  emit('change', { column: props.column, value: val });
}
</script>
