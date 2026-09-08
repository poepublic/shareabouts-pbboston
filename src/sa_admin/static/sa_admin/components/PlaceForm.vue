<template>
  <form id="place-detail-form" @submit.prevent="saveValues">
    <div class="actions-wrapper">
      <button
        type="button"
        class="undo-button"
        :disabled="undoBuffer.length === 0"
        @click="undo"
      >
        Undo
      </button>
      <button
        type="button"
        class="redo-button"
        :disabled="redoBuffer.length === 0"
        @click="redo"
      >
        Redo
      </button>
      <button
        type="submit"
        class="save-button"
        :disabled="!canSave"
      >
        Save
      </button>
    </div>

    <PlaceMap
      :coordinates="placeCoordinates"
      @marker:move="onMarkerMove"
    />

    <div class="fields-wrapper">
      <div
        v-for="column in columns"
        :key="column.attr"
        :id="`place-${placeModel?.id}-${column.attr}-field`"
        class="field"
      >
        <component
          :is="getWidgetComponent(column.widget)"
          :column="column"
          :place-id="placeModel?.id"
          :model-value="getAttrValue(column.attr)"
          @change="onWidgetChange"
        />
      </div>
    </div>
  </form>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import PlaceMap from './PlaceMap.vue';
import PlaceFieldWidget from './widgets/PlaceFieldWidget.vue';
import PlaceFieldReadOnlyWidget from './widgets/PlaceFieldReadOnlyWidget.vue';
import PlaceFieldBooleanWidget from './widgets/PlaceFieldBooleanWidget.vue';
import PlaceFieldChoiceWidget from './widgets/PlaceFieldChoiceWidget.vue';
import PlaceFieldDateTimeWidget from './widgets/PlaceFieldDateTimeWidget.vue';
import PlaceFieldLongTextWidget from './widgets/PlaceFieldLongTextWidget.vue';

const widgetMap = {
  PlaceFieldWidget,
  PlaceFieldReadOnlyWidget,
  PlaceFieldBooleanWidget,
  PlaceFieldChoiceWidget,
  PlaceFieldDateTimeWidget,
  PlaceFieldLongTextWidget,
};

function getWidgetComponent(widgetName) {
  if (typeof widgetName === 'string') {
    return widgetMap[widgetName] || PlaceFieldWidget;
  }
  return widgetName || PlaceFieldWidget;
}

const props = defineProps({
  place: { type: Object, required: true },
  columns: { type: Array, required: true }
});

const canSave = ref(false);
const undoBuffer = ref([]);
const redoBuffer = ref([]);

const updateKey = ref(0);

const placeModel = computed(() => {
  updateKey.value;
  return props.place;
});

const placeCoordinates = computed(() => {
  updateKey.value;
  const geom = props.place?.get ? props.place.get('geometry') : null;
  return geom ? geom.coordinates : [0, 0];
});

function getAttrValue(attr) {
  updateKey.value;
  return props.place?.get ? props.place.get(attr) : '';
}

function setValues(data, options = { remember: true }) {
  let undoData = {};
  for (const [attr, value] of Object.entries(data)) {
    undoData[attr] = props.place.get(attr);
    props.place.set(attr, value);
  }

  canSave.value = true;

  if (options.remember) {
    undoBuffer.value.push(undoData);
  }

  redoBuffer.value = [];
}

function onMarkerMove({ latlng }) {
  setValues({
    geometry: {
      type: 'Point',
      coordinates: [latlng.lng, latlng.lat],
    },
  });
}

function onWidgetChange({ column, value }) {
  setValues({
    [column.attr]: value,
  });
}

function undo() {
  const undoData = undoBuffer.value.pop();
  if (undoData) {
    const redoData = {};
    for (const attr in undoData) {
      redoData[attr] = props.place.get(attr);
      props.place.set(attr, undoData[attr]);
    }
    redoBuffer.value.push(redoData);
  }
  canSave.value = true;
}

function redo() {
  const nextRedo = redoBuffer.value.pop();
  if (nextRedo) {
    const lastUndo = {};
    for (const attr in nextRedo) {
      lastUndo[attr] = props.place.get(attr);
      props.place.set(attr, nextRedo[attr]);
    }
    undoBuffer.value.push(lastUndo);
  }
  canSave.value = true;
}

function saveValues() {
  if (!props.place || !props.place.save) return;

  canSave.value = false;
  props.place.save(null, {
    beforeSend: ($xhr) => {
      $xhr.setRequestHeader('X-Shareabouts-Silent', 'true');
    },
    error: () => {
      canSave.value = true;
      alert('Failed to save place. Please see the developer console for more information.');
    },
    wait: true,
  });
}

function handleKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undo();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault();
    redo();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);

  if (props.place && typeof props.place.on === 'function') {
    const onUpdate = () => {
      updateKey.value++;
    };
    props.place.on('change sync', onUpdate);
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);

  if (props.place && typeof props.place.off === 'function') {
    props.place.off('change sync');
  }
});
</script>
