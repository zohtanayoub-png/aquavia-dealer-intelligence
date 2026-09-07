/**
 * Commercially important cities per market.
 *
 * Used by the "geographic importance" scoring signal. When a country has no
 * entry here the signal is reported as UNVERIFIED rather than scored as
 * "not important" — an absent list is our gap, not the company's weakness.
 */
import { normalizeName } from '@/lib/utils';

const MAJOR_CITIES: Record<string, string[]> = {
  ES: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Malaga', 'Bilbao', 'Alicante', 'Marbella', 'Palma'],
  PT: ['Lisboa', 'Lisbon', 'Porto', 'Braga', 'Faro', 'Cascais', 'Coimbra'],
  FR: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Bordeaux', 'Lille', 'Montpellier', 'Cannes', 'Aix-en-Provence'],
  IT: ['Roma', 'Rome', 'Milano', 'Milan', 'Napoli', 'Torino', 'Turin', 'Firenze', 'Florence', 'Bologna', 'Verona', 'Venezia'],
  DE: ['Berlin', 'Hamburg', 'Munchen', 'Munich', 'Koln', 'Cologne', 'Frankfurt', 'Stuttgart', 'Dusseldorf', 'Hannover', 'Leipzig'],
  AT: ['Wien', 'Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck'],
  CH: ['Zurich', 'Geneve', 'Geneva', 'Basel', 'Bern', 'Lausanne', 'Lugano'],
  NL: ['Amsterdam', 'Rotterdam', 'Den Haag', 'The Hague', 'Utrecht', 'Eindhoven', 'Groningen'],
  BE: ['Brussel', 'Brussels', 'Bruxelles', 'Antwerpen', 'Antwerp', 'Gent', 'Ghent', 'Liege', 'Brugge'],
  GB: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Edinburgh', 'Bristol', 'Liverpool', 'Cardiff'],
  IE: ['Dublin', 'Cork', 'Galway', 'Limerick'],
  LU: ['Luxembourg'],
  SE: ['Stockholm', 'Goteborg', 'Gothenburg', 'Malmo', 'Uppsala'],
  NO: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger'],
  DK: ['Kobenhavn', 'Copenhagen', 'Aarhus', 'Odense', 'Aalborg'],
  FI: ['Helsinki', 'Espoo', 'Tampere', 'Turku', 'Vantaa'],
  PL: ['Warszawa', 'Warsaw', 'Krakow', 'Wroclaw', 'Poznan', 'Gdansk', 'Lodz', 'Katowice'],
  CZ: ['Praha', 'Prague', 'Brno', 'Ostrava', 'Plzen'],
  SK: ['Bratislava', 'Kosice', 'Zilina'],
  HU: ['Budapest', 'Debrecen', 'Szeged', 'Pecs', 'Gyor'],
  RO: ['Bucuresti', 'Bucharest', 'Cluj-Napoca', 'Timisoara', 'Iasi', 'Constanta', 'Brasov'],
  BG: ['Sofia', 'Plovdiv', 'Varna', 'Burgas'],
  HR: ['Zagreb', 'Split', 'Rijeka', 'Osijek', 'Dubrovnik'],
  SI: ['Ljubljana', 'Maribor', 'Koper'],
  RS: ['Beograd', 'Belgrade', 'Novi Sad', 'Nis'],
  GR: ['Athina', 'Athens', 'Thessaloniki', 'Patra', 'Heraklion'],
  CY: ['Nicosia', 'Limassol', 'Larnaca', 'Paphos'],
  TR: ['Istanbul', 'Ankara', 'Izmir', 'Antalya', 'Bursa', 'Bodrum', 'Adana'],
  UA: ['Kyiv', 'Kiev', 'Lviv', 'Odesa', 'Kharkiv', 'Dnipro'],
  RU: ['Moskva', 'Moscow', 'Sankt-Peterburg', 'Saint Petersburg', 'Novosibirsk', 'Ekaterinburg', 'Kazan', 'Sochi'],
  EE: ['Tallinn', 'Tartu'],
  LV: ['Riga', 'Jurmala'],
  LT: ['Vilnius', 'Kaunas', 'Klaipeda'],
  IS: ['Reykjavik'],
  MT: ['Valletta', 'Sliema', 'St Julian s'],
  // --- MENA ---
  MA: ['Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Tangier', 'Agadir', 'Fes', 'Fez', 'Mohammedia', 'Bouskoura'],
  DZ: ['Alger', 'Algiers', 'Oran', 'Constantine', 'Annaba'],
  TN: ['Tunis', 'Sousse', 'Sfax', 'Hammamet', 'Djerba'],
  EG: ['Cairo', 'Al Qahirah', 'Alexandria', 'Giza', 'Sharm El Sheikh', 'Hurghada', 'New Cairo'],
  AE: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah'],
  SA: ['Riyadh', 'Jeddah', 'Dammam', 'Khobar', 'Mecca', 'Medina'],
  QA: ['Doha', 'Al Rayyan'],
  KW: ['Kuwait City', 'Hawalli'],
  BH: ['Manama', 'Riffa'],
  OM: ['Muscat', 'Salalah'],
  JO: ['Amman', 'Aqaba'],
  LB: ['Beirut', 'Beyrouth', 'Jounieh'],
  IL: ['Tel Aviv', 'Jerusalem', 'Haifa', 'Herzliya', 'Netanya'],
  // --- Africa ---
  ZA: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Sandton', 'Port Elizabeth'],
  NG: ['Lagos', 'Abuja', 'Port Harcourt'],
  KE: ['Nairobi', 'Mombasa'],
  GH: ['Accra', 'Kumasi'],
  SN: ['Dakar'],
  CI: ['Abidjan'],
  MU: ['Port Louis', 'Grand Baie'],
  // --- Americas ---
  US: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Miami', 'Dallas', 'San Diego', 'Atlanta', 'Denver', 'Seattle', 'Las Vegas'],
  CA: ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa', 'Edmonton'],
  MX: ['Ciudad de Mexico', 'Mexico City', 'Guadalajara', 'Monterrey', 'Cancun', 'Puebla', 'Queretaro'],
  BR: ['Sao Paulo', 'Rio de Janeiro', 'Brasilia', 'Belo Horizonte', 'Curitiba', 'Porto Alegre', 'Florianopolis'],
  AR: ['Buenos Aires', 'Cordoba', 'Rosario', 'Mendoza'],
  CL: ['Santiago', 'Valparaiso', 'Concepcion', 'Vina del Mar'],
  CO: ['Bogota', 'Medellin', 'Cali', 'Barranquilla', 'Cartagena'],
  PE: ['Lima', 'Arequipa', 'Trujillo'],
  UY: ['Montevideo', 'Punta del Este'],
  CR: ['San Jose', 'Guanacaste'],
  PA: ['Panama City', 'Ciudad de Panama'],
  DO: ['Santo Domingo', 'Punta Cana', 'Santiago'],
  // --- Asia-Pacific ---
  AU: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Canberra'],
  NZ: ['Auckland', 'Wellington', 'Christchurch', 'Queenstown'],
  SG: ['Singapore'],
  MY: ['Kuala Lumpur', 'Penang', 'Johor Bahru'],
  TH: ['Bangkok', 'Phuket', 'Chiang Mai', 'Pattaya', 'Koh Samui'],
  ID: ['Jakarta', 'Bali', 'Denpasar', 'Surabaya'],
  PH: ['Manila', 'Cebu', 'Makati'],
  VN: ['Ho Chi Minh City', 'Hanoi', 'Da Nang'],
  IN: ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Goa'],
  JP: ['Tokyo', 'Osaka', 'Nagoya', 'Yokohama', 'Fukuoka', 'Sapporo'],
  KR: ['Seoul', 'Busan', 'Incheon', 'Jeju'],
  CN: ['Shanghai', 'Beijing', 'Shenzhen', 'Guangzhou', 'Hangzhou', 'Chengdu'],
  TW: ['Taipei', 'Kaohsiung', 'Taichung'],
  HK: ['Hong Kong', 'Kowloon'],
};

const INDEX: Record<string, Set<string>> = Object.fromEntries(
  Object.entries(MAJOR_CITIES).map(([code, cities]) => [
    code,
    new Set(cities.map(normalizeName)),
  ]),
);

export interface GeoImportance {
  isMajorCity: boolean;
  /** False when we hold no city list for this market — the signal is a gap. */
  known: boolean;
}

export function geographicImportance(countryCode: string, city: string | null): GeoImportance {
  const set = INDEX[countryCode.toUpperCase()];
  if (!set) return { isMajorCity: false, known: false };
  if (!city) return { isMajorCity: false, known: false };
  return { isMajorCity: set.has(normalizeName(city)), known: true };
}

export function majorCitiesFor(countryCode: string): string[] {
  return MAJOR_CITIES[countryCode.toUpperCase()] ?? [];
}

export { MAJOR_CITIES };
