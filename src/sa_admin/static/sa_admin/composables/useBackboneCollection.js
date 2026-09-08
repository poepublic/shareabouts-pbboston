import { shallowRef, onUnmounted, unref } from 'vue';

export function useBackboneCollection(collectionInput) {
  const collection = unref(collectionInput);
  const modelsRef = shallowRef(collection ? [...collection.models] : []);

  if (collection && typeof collection.on === 'function') {
    const onUpdate = () => {
      modelsRef.value = [...collection.models];
    };

    onUpdate();

    const events = 'add remove reset change sync';
    collection.on(events, onUpdate);

    onUnmounted(() => {
      collection.off(events, onUpdate);
    });
  }

  return modelsRef;
}
