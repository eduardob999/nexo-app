import type { ModuleManifest } from '../types';

/** What the host needs to list this module. The module itself is `./index.tsx`. */
export const writeManifest: ModuleManifest = {
  id: 'write',
  name: 'Homework',
  hint: 'Book pages and your answers',
  route: 'homework',
  collections: ['homework'],
  services: ['nexo-homework'],
};
