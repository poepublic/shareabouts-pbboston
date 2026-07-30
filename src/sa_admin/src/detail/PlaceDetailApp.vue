<template>
  <div class="place-detail-app">
    <div v-if="loading" class="loading">Loading place...</div>
    <div v-else-if="error" class="error">Failed to load place.</div>
    <PlaceForm
      v-else-if="placeModel"
      :place="placeModel"
      :columns="fields"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useBackboneModel } from '../composables/useBackboneModel.js';
import { useBootstrap } from '../composables/useBootstrap.js';
import { getFields } from '../config/adminFields.js';
import PlaceForm from '../components/PlaceForm.vue';

const { placeId } = useBootstrap();
const fields = getFields();

const targetPlaceId = placeId || window.__SA_PLACE_ID__;
const places = new window.Shareabouts.PlaceCollection();
const rawPlace = new window.Shareabouts.PlaceModel({ id: targetPlaceId });
rawPlace.collection = places;

const placeModelRef = useBackboneModel(rawPlace);
const placeModel = ref(placeModelRef.value);
const loading = ref(true);
const error = ref(false);

onMounted(() => {
  rawPlace.fetch({
    success: () => {
      loading.value = false;
      placeModel.value = rawPlace;
    },
    error: (model, err) => {
      loading.value = false;
      error.value = true;
      if (err.status === 401 || err.status === 403) {
        console.error('Authentication error while fetching place:', err.responseText);
        return;
      }
      console.error('Error fetching place:', err.status, err.responseText);
    },
    data: {
      include_private: true,
      include_invisible: true,
    },
  });
});
</script>
