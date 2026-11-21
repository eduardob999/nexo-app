import type { ModuleManifest } from '../types';

/** What the host needs to list this module. The module itself is `./index.tsx`. */
export const kajiManifest: ModuleManifest = {
  id: 'kaji',
  name: 'Kaji',
  hint: 'Housework shared fairly: chores, time, balance',
  route: 'kaji',
  collections: ['households'],
  services: ['nexo-kaji'],
};
