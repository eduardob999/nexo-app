/**
 * The contract between a module and a host. A module is a folder under src/modules/<id>/ that
 *  - exports a manifest (id, name, where it lives in the URL, which Firestore collections and which background
 *    services it uses),
 *  - exports one component, `<Module uid openId?>`, that does its own watching and saving, so a host only mounts it,
 *  - depends on the platform files only: firebase.ts (db, auth), drive.ts (uploads), types.ts, and nothing else of Nexo.
 * Nexo mounts a module on a route; a standalone entry (for example fude.html) mounts the same component on its own.
 * Planned modules: fude (this one), kanji (kanji-app), gre (the GRE prep app).
 */
export interface ModuleManifest {
  id: string;
  name: string;
  hint: string;
  /** The first segment of the URL hash: #/<route> and #/<route>/<id>. */
  route: string;
  collections: string[];
  services?: string[];
}

export interface ModuleProps {
  uid: string;
  /** The open item from the URL, when there is one. */
  openId?: string | undefined;
  /** What the host can do for the module, when it wants to offer it. A module never imports host code. */
  host?: { sendBackDraft?: (draftId: string, text: string) => void };
}
