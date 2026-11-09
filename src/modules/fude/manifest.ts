import type { ModuleManifest } from '../types';

/** What the host needs to list this module. The module itself is `./index.tsx`. */
export const fudeManifest: ModuleManifest = {
  id: 'fude',
  name: 'Fude',
  hint: 'Write with a reviewer: homework and reports',
  route: 'homework',
  collections: ['homework'],
  services: ['nexo-homework'],
};
