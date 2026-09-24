// Share one lazy load; a failed load must be retryable rather than permanently cached.
export function createDeferredLoader(load) {
  let pending;
  return () => {
    if (!pending) pending = Promise.resolve().then(load).catch(error => { pending = undefined; throw error; });
    return pending;
  };
}
export const loadBookCorpus = createDeferredLoader(() => import('../data/booksOffline.mjs').then(module => module.default));
