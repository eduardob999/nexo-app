/**
 * Nearby places, from one OpenStreetMap (Overpass) query around his position.
 *
 * His request, card nmw9woh8bpsx: "relevant places around me, like the closest
 * combini, bathroom, station", with free APIs, and "it can work with its own
 * button so no micro consumption of tokens piles up". So nothing here runs on
 * its own: Nearby.tsx calls `findNearby` only when he presses the button, it
 * costs one free Overpass request and no model call, and the position it is
 * given is never stored anywhere. The pure parts live here so they are tested
 * without a network or a phone.
 */

export type Kind = 'combini' | 'station' | 'toilet' | 'pharmacy';

export interface Pos { lat: number; lon: number }

export interface Place {
  kind: Kind;
  name: string;
  lat: number;
  lon: number;
  /** Straight-line metres, not a walking route. */
  metres: number;
}

export const RADIUS_M = 1500;
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
/** About 80 m a minute is a normal walking pace; the figure is a straight line, so it reads low. */
export const WALK_M_PER_MIN = 80;

export const KINDS: Kind[] = ['combini', 'station', 'toilet', 'pharmacy'];
export const KIND_LABEL: Record<Kind, string> = { combini: 'Combini', station: 'Station', toilet: 'Toilet', pharmacy: 'Pharmacy' };

/** One query for all four kinds, so a press costs one request. `out center` gives ways and areas a point. */
export function buildQuery(p: Pos, radius = RADIUS_M): string {
  const a = `around:${radius},${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
  return [
    '[out:json][timeout:20];',
    '(',
    `  nwr(${a})["shop"="convenience"];`,
    `  nwr(${a})["railway"="station"];`,
    `  nwr(${a})["public_transport"="station"];`,
    `  nwr(${a})["amenity"="toilets"];`,
    `  nwr(${a})["amenity"="pharmacy"];`,
    ');',
    'out center tags;',
  ].join('\n');
}

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
export function haversine(a: Pos, b: Pos): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

type Tags = Record<string, string>;
export interface OsmElement { type?: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Tags }

/**
 * Which kind an element is, or null. A bus terminal is often tagged
 * public_transport=station; "station" here means a train, so one that is only a
 * bus station is dropped rather than sent as the nearest station.
 */
export function kindOf(t: Tags): Kind | null {
  if (t['shop'] === 'convenience') return 'combini';
  if (t['amenity'] === 'toilets') return 'toilet';
  if (t['amenity'] === 'pharmacy') return 'pharmacy';
  if (t['railway'] === 'station') return 'station';
  if (t['public_transport'] === 'station') {
    const busOnly = t['bus'] === 'yes' && !t['train'] && !t['subway'] && !t['light_rail'] && !t['tram'] && !t['monorail'];
    return busOnly ? null : 'station';
  }
  return null;
}

/** Name, then brand, then operator, then the kind itself, so a row is never blank. */
export function nameOf(t: Tags, kind: Kind): string {
  const n = t['name'] || t['brand'] || t['operator'];
  if (!n) return KIND_LABEL[kind];
  const en = t['name:en'];
  return en && en !== n && t['name'] ? `${n} (${en})` : n;
}

/**
 * The single nearest place of each kind; a kind with nothing in range is absent from the map.
 * A station is drawn in OSM as a named point plus unnamed platform and building areas, and
 * on the real Uji data an unnamed area was nearer than 宇治 itself. So for stations a named
 * one wins over an unnamed one; an unnamed station is used only when no named one is in range.
 */
export function pickNearest(elements: OsmElement[], from: Pos): Partial<Record<Kind, Place>> {
  const best: Partial<Record<Kind, Place>> = {};
  const named: Partial<Record<Kind, boolean>> = {};
  for (const e of elements) {
    const t = e.tags ?? {};
    const kind = kindOf(t);
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (!kind || typeof lat !== 'number' || typeof lon !== 'number') continue;
    const metres = haversine(from, { lat, lon });
    const hasName = kind !== 'station' || !!(t['name'] || t['brand'] || t['operator']);
    const cur = best[kind];
    const better = !cur || (hasName && !named[kind]) || (hasName === !!named[kind] && metres < cur.metres);
    if (better) { best[kind] = { kind, name: nameOf(t, kind), lat, lon, metres }; named[kind] = hasName; }
  }
  return best;
}

export function distanceText(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function walkMinutes(m: number): number {
  return Math.max(1, Math.round(m / WALK_M_PER_MIN));
}

export function directionsUrl(p: { lat: number; lon: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat.toFixed(6)},${p.lon.toFixed(6)}&travelmode=walking`;
}

/** Plain words for a failed position request. Codes are the GeolocationPositionError constants. */
export function geoErrorText(code: number | undefined): string {
  if (code === 1) return 'Location is blocked for this app. Allow it in the browser or phone settings, then press again.';
  if (code === 3) return 'Could not get your location within 10 seconds. Try again, ideally outside or near a window.';
  if (code === 2) return 'Your position is not available right now (no GPS or network fix).';
  return 'Could not get your location.';
}

export type FetchLike = (url: string, init: { method: string; body: string; headers: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/** The one network call. `fetchFn` is injected so tests run with no network. */
export async function findNearby(p: Pos, fetchFn: FetchLike, signal?: AbortSignal): Promise<Partial<Record<Kind, Place>>> {
  const res = await fetchFn(OVERPASS_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(buildQuery(p))}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) {
    throw new Error(res.status === 429 || res.status === 504
      ? 'The OpenStreetMap server is busy. Try again in a minute.'
      : `The OpenStreetMap server answered ${res.status}.`);
  }
  const data = (await res.json()) as { elements?: OsmElement[] };
  return pickNearest(data.elements ?? [], p);
}
