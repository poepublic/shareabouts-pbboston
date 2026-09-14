<template>
  <div class="field-widget">
    <label :for="widgetId">{{ column.label }}</label>
    <input
      type="text"
      :id="widgetId"
      :name="column.attr"
      :value="modelValue ?? ''"
      @change="onChange"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  column: { type: Object, required: true },
  placeId: { type: [String, Number], default: 'new' },
  modelValue: { type: [String, Number, Boolean, Object, Array], default: '' }
});

const emit = defineEmits(['change', 'update:modelValue']);

const widgetId = computed(() => `place-${props.placeId}-${props.column.attr}-widget`);

function onChange(e) {
  const val = e.target.value;
  emit('update:modelValue', val);
  emit('change', { column: props.column, value: val });
}
</script>
