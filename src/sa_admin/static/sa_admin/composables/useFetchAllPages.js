import { reactive } from 'vue';

// Fetches every page of a collection and reports progress as the
// number of records fetched out of the total (metadata.length, included in
// every page response). `total` is null until the first page arrives. 
export function useFetchAllPages(collection) {
  const progress = reactive({ loaded: 0, total: null, done: false });

  collection.fetchAllPages({
    pageSuccess: () => {
      progress.loaded = collection.length;
      progress.total = collection.metadata.length;
      if (progress.total === 0) { progress.done = true; }
    },
    success: () => { progress.done = true; },
  });

  return progress;
}
