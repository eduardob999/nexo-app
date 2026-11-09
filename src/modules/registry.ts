import { writeManifest } from './write/manifest';
import type { ModuleManifest } from './types';

/** Every module the host knows. Browse lists these; adding an app to the ecosystem is one line here. */
export const MODULES: ModuleManifest[] = [writeManifest];
