/**
 * Google Places API (New) — https://places.googleapis.com/v1
 *
 * Used for discovery AND verification. Everything this module returns is a
 * literal value from Google's response: nothing is defaulted, inferred or
 * invented. Absent fields stay `null` and become UNKNOWN downstream.
 */
import { env } from '@/lib/env';
import {
  classifyHttpError,
  fetchWithTimeout,
  providerError,
  type ProviderOutcome,
} from '@/lib/providers/types';

const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places';

/** Field mask for text search — we pay per field, so request exactly what we store. */
const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.types',
  'places.primaryType',
  'places.businessStatus',
  'places.googleMapsUri',
  'nextPageToken',
].join(',');

const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'addressComponents',
  'location',
  'rating',
  'userRatingCount',
  'websiteUri',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'types',
  'primaryType',
  'businessStatus',
  'googleMapsUri',
  'editorialSummary',
].join(',');

export interface PlaceResult {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  userRatingCount: number | null;
  website: string | null;
  phone: string | null;
  types: string[];
  primaryType: string | null;
  businessStatus: string | null;
  googleMapsUri: string | null;
  editorialSummary: string | null;
}

interface RawAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: RawAddressComponent[];
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  types?: string[];
  primaryType?: string;
  businessStatus?: string;
  googleMapsUri?: string;
  editorialSummary?: { text?: string };
}

function pickComponent(components: RawAddressComponent[] | undefined, type: string): string | null {
  const hit = components?.find((c) => c.types?.includes(type));
  return hit?.longText ?? hit?.shortText ?? null;
}

export function mapPlace(raw: RawPlace): PlaceResult | null {
  if (!raw.id || !raw.displayName?.text) return null;
  const components = raw.addressComponents;
  const country = components?.find((c) => c.types?.includes('country'));

  return {
    placeId: raw.id,
    name: raw.displayName.text,
    formattedAddress: raw.formattedAddress ?? null,
    city:
      pickComponent(components, 'locality') ??
      pickComponent(components, 'postal_town') ??
      pickComponent(components, 'administrative_area_level_2'),
    region: pickComponent(components, 'administrative_area_level_1'),
    postalCode: pickComponent(components, 'postal_code'),
    countryCode: country?.shortText?.toUpperCase() ?? null,
    latitude: typeof raw.location?.latitude === 'number' ? raw.location.latitude : null,
    longitude: typeof raw.location?.longitude === 'number' ? raw.location.longitude : null,
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    userRatingCount: typeof raw.userRatingCount === 'number' ? raw.userRatingCount : null,
    website: raw.websiteUri ?? null,
    phone: raw.internationalPhoneNumber ?? raw.nationalPhoneNumber ?? null,
    types: raw.types ?? [],
    primaryType: raw.primaryType ?? null,
    businessStatus: raw.businessStatus ?? null,
    googleMapsUri: raw.googleMapsUri ?? null,
    editorialSummary: raw.editorialSummary?.text ?? null,
  };
}

export interface TextSearchOptions {
  query: string;
  /** BCP-47 language code — makes Google return local-language names. */
  languageCode?: string;
  /** ISO 3166-1 alpha-2, biases (not restricts) results to the market. */
  regionCode?: string;
  maxResults?: number;
  pageToken?: string;
}

export interface TextSearchResponse {
  places: PlaceResult[];
  nextPageToken: string | null;
}

export function isGooglePlacesConfigured(): boolean {
  return Boolean(env.googlePlacesApiKey);
}

export async function searchText(
  options: TextSearchOptions,
): Promise<ProviderOutcome<TextSearchResponse>> {
  const apiKey = env.googlePlacesApiKey;
  if (!apiKey) {
    return providerError(
      'NOT_CONFIGURED',
      'GOOGLE_PLACES_API_KEY is not set. Company discovery is disabled until it is configured.',
      { retryable: false },
    );
  }

  const body: Record<string, unknown> = {
    textQuery: options.query,
    maxResultCount: Math.min(options.maxResults ?? 20, 20),
  };
  if (options.languageCode) body.languageCode = options.languageCode;
  if (options.regionCode) body.regionCode = options.regionCode;
  if (options.pageToken) body.pageToken = options.pageToken;

  try {
    const res = await fetchWithTimeout(SEARCH_TEXT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': SEARCH_FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return classifyHttpError(res.status, await res.text());
    }

    const json = (await res.json()) as { places?: RawPlace[]; nextPageToken?: string };
    const places = (json.places ?? [])
      .map(mapPlace)
      .filter((p): p is PlaceResult => p !== null);

    return { ok: true, data: { places, nextPageToken: json.nextPageToken ?? null } };
  } catch (err) {
    return networkFailure(err);
  }
}

/** Re-verify a single place. Used to refresh rating/reviews/phone over time. */
export async function getPlaceDetails(placeId: string): Promise<ProviderOutcome<PlaceResult>> {
  const apiKey = env.googlePlacesApiKey;
  if (!apiKey) {
    return providerError('NOT_CONFIGURED', 'GOOGLE_PLACES_API_KEY is not set.', { retryable: false });
  }

  try {
    const res = await fetchWithTimeout(`${PLACE_DETAILS_URL}/${encodeURIComponent(placeId)}`, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': DETAILS_FIELD_MASK,
      },
    });

    if (!res.ok) return classifyHttpError(res.status, await res.text());

    const mapped = mapPlace((await res.json()) as RawPlace);
    if (!mapped) {
      return providerError('UPSTREAM_ERROR', `Place ${placeId} returned an unusable payload.`);
    }
    return { ok: true, data: mapped };
  } catch (err) {
    return networkFailure(err);
  }
}

function networkFailure(err: unknown): ReturnType<typeof providerError> {
  if (err instanceof Error && err.name === 'AbortError') {
    return providerError('TIMEOUT', 'Google Places request timed out.');
  }
  return providerError(
    'NETWORK_ERROR',
    `Could not reach Google Places: ${err instanceof Error ? err.message : String(err)}`,
  );
}
