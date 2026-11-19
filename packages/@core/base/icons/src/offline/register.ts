import { addCollection } from '@iconify/vue/offline';

import { offlineCollections } from './collections';

const registered = new Set<string>();

export function rememberIcon(name: string) {
  registered.add(name);
}

export function hasOfflineIcon(name: string) {
  return registered.has(name);
}

for (const collection of offlineCollections) {
  addCollection(collection);
  const { aliases, icons, prefix } = collection;
  for (const name of Object.keys(icons)) {
    rememberIcon(`${prefix}:${name}`);
  }
  for (const name of Object.keys(aliases ?? {})) {
    rememberIcon(`${prefix}:${name}`);
  }
}
