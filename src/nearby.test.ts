import { describe, expect, it, vi } from 'vitest';
import { buildQuery, directionsUrl, distanceText, findNearby, geoErrorText, haversine, kindOf, nameOf, pickNearest, walkMinutes, type FetchLike } from './nearby';

const UJI = { lat: 34.8844, lon: 135.8 };

describe('haversine', () => {
  it('is zero at the same point and about 111 km per degree of latitude', () => {
    expect(haversine(UJI, UJI)).toBe(0);
    expect(haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111195, -2);
  });
  it('gives a plausible short distance', () => {
    const m = haversine(UJI, { lat: 34.8854, lon: 135.8 });
    expect(m).toBeGreaterThan(105);
    expect(m).toBeLessThan(118);
  });
});

describe('buildQuery', () => {
  it('asks for all four kinds within 1500 m in one query', () => {
    const q = buildQuery(UJI);
    expect(q).toContain('around:1500,34.884400,135.800000');
    for (const t of ['"shop"="convenience"', '"railway"="station"', '"public_transport"="station"', '"amenity"="toilets"', '"amenity"="pharmacy"']) expect(q).toContain(t);
    expect(q).toContain('out center tags;');
  });
});

describe('kindOf and nameOf', () => {
  it('drops a bus-only station but keeps a train one', () => {
    expect(kindOf({ public_transport: 'station', bus: 'yes' })).toBeNull();
    expect(kindOf({ public_transport: 'station', train: 'yes' })).toBe('station');
    expect(kindOf({ railway: 'station' })).toBe('station');
    expect(kindOf({ shop: 'bakery' })).toBeNull();
  });
  it('falls back from name to brand to operator to the kind', () => {
    expect(nameOf({ name: '宇治駅', 'name:en': 'Uji' }, 'station')).toBe('宇治駅 (Uji)');
    expect(nameOf({ brand: 'Lawson' }, 'combini')).toBe('Lawson');
    expect(nameOf({ operator: '宇治市' }, 'toilet')).toBe('宇治市');
    expect(nameOf({}, 'toilet')).toBe('Toilet');
  });
});

describe('pickNearest', () => {
  it('keeps the closest of each kind and uses the centre of ways', () => {
    const got = pickNearest([
      { lat: 34.8900, lon: 135.8, tags: { shop: 'convenience', name: 'Far' } },
      { lat: 34.8850, lon: 135.8, tags: { shop: 'convenience', name: 'Near' } },
      { type: 'way', center: { lat: 34.8860, lon: 135.801 }, tags: { railway: 'station', name: '宇治' } },
      { lat: 34.8845, lon: 135.8, tags: { shop: 'bakery' } },
      { tags: { amenity: 'toilets' } },
    ], UJI);
    expect(got.combini?.name).toBe('Near');
    expect(got.station?.lat).toBe(34.886);
    expect(got.toilet).toBeUndefined();
    expect(got.pharmacy).toBeUndefined();
  });
  it('prefers a named station over a nearer unnamed platform area', () => {
    const got = pickNearest([
      { type: 'way', center: { lat: 34.8846, lon: 135.8 }, tags: { public_transport: 'station' } },
      { lat: 34.8900, lon: 135.8, tags: { railway: 'station', name: '宇治' } },
    ], UJI);
    expect(got.station?.name).toBe('宇治');
    const only = pickNearest([{ type: 'way', center: { lat: 34.8846, lon: 135.8 }, tags: { public_transport: 'station' } }], UJI);
    expect(only.station?.name).toBe('Station');
  });
});

describe('formatting', () => {
  it('rounds metres and switches to km', () => {
    expect(distanceText(3)).toBe('10 m');
    expect(distanceText(347)).toBe('350 m');
    expect(distanceText(1234)).toBe('1.2 km');
  });
  it('walks at about 80 m a minute, never 0', () => {
    expect(walkMinutes(10)).toBe(1);
    expect(walkMinutes(400)).toBe(5);
  });
  it('links walking directions in Google Maps', () => {
    expect(directionsUrl({ lat: 34.8844, lon: 135.8 })).toBe('https://www.google.com/maps/dir/?api=1&destination=34.884400,135.800000&travelmode=walking');
  });
  it('says what to do for each geolocation error', () => {
    expect(geoErrorText(1)).toMatch(/blocked/);
    expect(geoErrorText(3)).toMatch(/10 seconds/);
    expect(geoErrorText(undefined)).toMatch(/Could not/);
  });
});

describe('findNearby', () => {
  it('POSTs one form-encoded query and picks from the answer', async () => {
    const fetchFn = vi.fn<FetchLike>(async () => ({ ok: true, status: 200, json: async () => ({ elements: [{ lat: 34.885, lon: 135.8, tags: { amenity: 'pharmacy', name: 'Kusuri' } }] }) }));
    const got = await findNearby(UJI, fetchFn);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://overpass-api.de/api/interpreter');
    expect(init.method).toBe('POST');
    expect(init.body.startsWith('data=')).toBe(true);
    expect(decodeURIComponent(init.body.slice(5))).toContain('around:1500');
    expect(got.pharmacy?.name).toBe('Kusuri');
  });
  it('turns a busy server into a plain message', async () => {
    const fetchFn: FetchLike = async () => ({ ok: false, status: 429, json: async () => ({}) });
    await expect(findNearby(UJI, fetchFn)).rejects.toThrow(/busy/);
  });
});
