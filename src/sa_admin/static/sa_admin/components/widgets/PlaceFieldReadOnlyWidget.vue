<template>
  <div class="field-widget field-readonly-widget">
    <label :for="widgetId">{{ column.label }}</label>
    <input
      type="text"
      :id="widgetId"
      :name="column.attr"
      :value="modelValue ?? ''"
      readonly
      disabled
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

const widgetId = computed(() => `place-${props.placeId}-${props.column.attr}-widget`);
</script>
