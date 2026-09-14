import { shallowRef, triggerRef, onUnmounted, unref } from 'vue';

export function useBackboneModel(modelInput) {
  const model = unref(modelInput);
  const modelRef = shallowRef(model);

  if (model && typeof model.on === 'function') {
    const onUpdate = () => {
      triggerRef(modelRef);
    };

    const events = 'change sync';
    model.on(events, onUpdate);

    onUnmounted(() => {
      model.off(events, onUpdate);
    });
  }

  return modelRef;
}
