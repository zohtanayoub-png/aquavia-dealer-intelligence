/**
 * Central environment access + integration status.
 *
 * Nothing in this file ever throws at import time: the application must boot
 * and be fully navigable with zero API keys configured. Missing credentials
 * are surfaced to the user as explicit "NOT CONFIGURED" status, never faked.
 */

export type IntegrationId = 'database' | 'googlePlaces' | 'tavily' | 'anthropic';

export interface IntegrationStatus {
  id: IntegrationId;
  label: string;
  configured: boolean;
  required: boolean;
  envVar: string;
  /** What stops working when this is missing. */
  impact: string;
  docsUrl?: string;
}

function read(name: string): string | undefined {
  const v = process.env[name];
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const env = {
  get databaseUrl() {
    return read('DATABASE_URL');
  },
  get googlePlacesApiKey() {
    return read('GOOGLE_PLACES_API_KEY');
  },
  get tavilyApiKey() {
    return read('TAVILY_API_KEY');
  },
  get anthropicApiKey() {
    return read('ANTHROPIC_API_KEY');
  },
  get anthropicModel() {
    return read('ANTHROPIC_MODEL') ?? 'claude-sonnet-5';
  },
  get homeCountry() {
    return (read('AQUAVIA_HOME_COUNTRY') ?? 'ES').toUpperCase();
  },
};

export function integrationStatuses(): IntegrationStatus[] {
  return [
    {
      id: 'database',
      label: 'PostgreSQL database',
      configured: Boolean(env.databaseUrl),
      required: true,
      envVar: 'DATABASE_URL',
      impact: 'Nothing can be stored or retrieved. The application cannot run.',
    },
    {
      id: 'googlePlaces',
      label: 'Google Places API (New)',
      configured: Boolean(env.googlePlacesApiKey),
      required: true,
      envVar: 'GOOGLE_PLACES_API_KEY',
      impact:
        'Company discovery is disabled. No prospects can be found or verified — ' +
        'name, address, coordinates, Place ID, rating, review count, website and phone all come from here.',
      docsUrl: 'https://developers.google.com/maps/documentation/places/web-service/op-overview',
    },
    {
      id: 'tavily',
      label: 'Tavily web research',
      configured: Boolean(env.tavilyApiKey),
      required: false,
      envVar: 'TAVILY_API_KEY',
      impact:
        'Companies are still discovered and scored from Google Places data, but every ' +
        'research-only field (brands carried, showroom evidence, year founded, decision makers, ' +
        'social profiles) stays UNKNOWN.',
      docsUrl: 'https://docs.tavily.com/',
    },
    {
      id: 'anthropic',
      label: 'Anthropic (optional)',
      configured: Boolean(env.anthropicApiKey),
      required: false,
      envVar: 'ANTHROPIC_API_KEY',
      impact:
        'Optional. Without it the deterministic extractor reads the same research text. ' +
        'The application is fully functional without this key.',
      docsUrl: 'https://docs.claude.com/en/api/overview',
    },
  ];
}

/** True when the minimum needed to actually discover prospects is present. */
export function canRunDiscovery(): boolean {
  return Boolean(env.googlePlacesApiKey);
}
