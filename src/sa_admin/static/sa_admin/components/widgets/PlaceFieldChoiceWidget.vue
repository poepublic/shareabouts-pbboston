<template>
  <div class="field-widget field-choice-widget">
    <label :for="widgetId">{{ column.label }}</label>
    <select
      :id="widgetId"
      :name="column.attr"
      :value="modelValue ?? ''"
      @change="onChange"
    >
      <option
        v-for="opt in options"
        :key="opt.value"
        :value="opt.value"
      >
        {{ opt.label || opt.value }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  column: { type: Object, required: true },
  placeId: { type: [String, Number], default: 'new' },
  modelValue: { type: [String, Number, Boolean], default: '' }
});

const emit = defineEmits(['change', 'update:modelValue']);

const widgetId = computed(() => `place-${props.placeId}-${props.column.attr}-widget`);
const options = computed(() => props.column.options || []);

function onChange(e) {
  const val = e.target.value;
  emit('update:modelValue', val);
  emit('change', { column: props.column, value: val });
}
</script>
