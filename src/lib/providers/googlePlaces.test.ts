import { describe, expect, it } from 'vitest';
import { mapPlace, type PlaceResult } from '@/lib/providers/googlePlaces';

/**
 * Fixture shaped exactly like a Places API (New) `places:searchText` element.
 * This validates OUR field mapping against the documented response schema —
 * it is not a stand-in for a real API call, and no run ever uses it.
 */
const RAW_PLACE = {
  id: 'ChIJExampleTestPlaceId',
  displayName: { text: 'Piscines & Spas Atlas', languageCode: 'fr' },
  formattedAddress: '12 Boulevard Zerktouni, Casablanca 20250, Morocco',
  addressComponents: [
    { longText: '12', shortText: '12', types: ['street_number'] },
    { longText: 'Boulevard Zerktouni', shortText: 'Bd Zerktouni', types: ['route'] },
    { longText: 'Casablanca', shortText: 'Casablanca', types: ['locality', 'political'] },
    { longText: 'Casablanca-Settat', shortText: 'Casablanca-Settat', types: ['administrative_area_level_1'] },
    { longText: 'Morocco', shortText: 'MA', types: ['country', 'political'] },
    { longText: '20250', shortText: '20250', types: ['postal_code'] },
  ],
  location: { latitude: 33.5883, longitude: -7.6321 },
  rating: 4.4,
  userRatingCount: 137,
  websiteUri: 'https://www.example-atlas.ma/',
  nationalPhoneNumber: '0522 00 00 00',
  internationalPhoneNumber: '+212 522 00 00 00',
  types: ['store', 'point_of_interest', 'establishment'],
  primaryType: 'store',
  businessStatus: 'OPERATIONAL',
  googleMapsUri: 'https://maps.google.com/?cid=123',
};

describe('mapPlace', () => {
  it('maps every field the schema stores', () => {
    const place = mapPlace(RAW_PLACE) as PlaceResult;
    expect(place.placeId).toBe('ChIJExampleTestPlaceId');
    expect(place.name).toBe('Piscines & Spas Atlas');
    expect(place.city).toBe('Casablanca');
    expect(place.region).toBe('Casablanca-Settat');
    expect(place.postalCode).toBe('20250');
    expect(place.countryCode).toBe('MA');
    expect(place.latitude).toBeCloseTo(33.5883);
    expect(place.longitude).toBeCloseTo(-7.6321);
    expect(place.rating).toBe(4.4);
    expect(place.userRatingCount).toBe(137);
    expect(place.website).toBe('https://www.example-atlas.ma/');
    expect(place.businessStatus).toBe('OPERATIONAL');
  });

  it('prefers the international phone number', () => {
    expect(mapPlace(RAW_PLACE)?.phone).toBe('+212 522 00 00 00');
  });

  it('returns null (not a partial record) when the payload lacks an id or name', () => {
    expect(mapPlace({ displayName: { text: 'No id' } })).toBeNull();
    expect(mapPlace({ id: 'x' })).toBeNull();
  });

  it('leaves absent optional fields null rather than defaulting them', () => {
    const sparse = mapPlace({ id: 'x', displayName: { text: 'Minimal Co' } }) as PlaceResult;
    expect(sparse.rating).toBeNull();
    expect(sparse.userRatingCount).toBeNull();
    expect(sparse.website).toBeNull();
    expect(sparse.phone).toBeNull();
    expect(sparse.city).toBeNull();
    expect(sparse.latitude).toBeNull();
    // A rating of 0 reviews must never be invented as 0 or as an average.
    expect(sparse.rating).not.toBe(0);
  });

  it('falls back through locality alternatives used in different countries', () => {
    const ukStyle = mapPlace({
      id: 'x', displayName: { text: 'UK Co' },
      addressComponents: [{ longText: 'Reading', types: ['postal_town'] }],
    });
    expect(ukStyle?.city).toBe('Reading');
  });
});
