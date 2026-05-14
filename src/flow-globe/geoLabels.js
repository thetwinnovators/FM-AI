/**
 * Static geographic label data for the globe.
 * Each entry: { lat, lng, text, size, color, continent? }
 * size drives react-globe.gl labelSize — continents are larger, countries smaller.
 */

export const GEO_LABELS = [
  // ─── Continents ───────────────────────────────────────────────────
  { lat: 54,    lng: 25,    text: 'EUROPE',       size: 1.6, color: 'rgba(180,220,255,0.45)' },
  { lat: 4,     lng: 22,    text: 'AFRICA',        size: 1.7, color: 'rgba(180,220,255,0.45)' },
  { lat: 45,    lng: 88,    text: 'ASIA',          size: 2.0, color: 'rgba(180,220,255,0.45)' },
  { lat: 50,    lng: -100,  text: 'N. AMERICA',    size: 1.7, color: 'rgba(180,220,255,0.45)' },
  { lat: -16,   lng: -56,   text: 'S. AMERICA',    size: 1.6, color: 'rgba(180,220,255,0.45)' },
  { lat: -26,   lng: 134,   text: 'AUSTRALIA',     size: 1.5, color: 'rgba(180,220,255,0.45)' },
  { lat: -76,   lng: 0,     text: 'ANTARCTICA',    size: 1.3, color: 'rgba(180,220,255,0.30)' },

  // ─── North America ─────────────────────────────────────────────────
  { lat: 38.9,  lng: -77.0, text: 'USA',           size: 1.1, color: 'rgba(255,255,255,0.55)' },
  { lat: 56.1,  lng: -106.4,text: 'Canada',        size: 1.0, color: 'rgba(255,255,255,0.50)' },
  { lat: 19.4,  lng: -99.1, text: 'Mexico',        size: 0.85,color: 'rgba(255,255,255,0.45)' },
  { lat: 23.1,  lng: -82.4, text: 'Cuba',          size: 0.65,color: 'rgba(255,255,255,0.40)' },

  // ─── South America ─────────────────────────────────────────────────
  { lat: -10.0, lng: -53.0, text: 'Brazil',        size: 1.1, color: 'rgba(255,255,255,0.55)' },
  { lat: -34.6, lng: -58.4, text: 'Argentina',     size: 0.90,color: 'rgba(255,255,255,0.45)' },
  { lat: -33.5, lng: -70.7, text: 'Chile',         size: 0.70,color: 'rgba(255,255,255,0.40)' },
  { lat: -12.0, lng: -77.0, text: 'Peru',          size: 0.75,color: 'rgba(255,255,255,0.40)' },
  { lat: 4.7,   lng: -74.1, text: 'Colombia',      size: 0.75,color: 'rgba(255,255,255,0.40)' },
  { lat: -0.2,  lng: -78.5, text: 'Ecuador',       size: 0.65,color: 'rgba(255,255,255,0.38)' },

  // ─── Europe ────────────────────────────────────────────────────────
  { lat: 51.5,  lng: -0.1,  text: 'UK',            size: 0.80,color: 'rgba(255,255,255,0.50)' },
  { lat: 48.9,  lng: 2.3,   text: 'France',        size: 0.80,color: 'rgba(255,255,255,0.50)' },
  { lat: 52.5,  lng: 13.4,  text: 'Germany',       size: 0.80,color: 'rgba(255,255,255,0.50)' },
  { lat: 40.4,  lng: -3.7,  text: 'Spain',         size: 0.75,color: 'rgba(255,255,255,0.45)' },
  { lat: 41.9,  lng: 12.5,  text: 'Italy',         size: 0.75,color: 'rgba(255,255,255,0.45)' },
  { lat: 38.7,  lng: -9.1,  text: 'Portugal',      size: 0.65,color: 'rgba(255,255,255,0.40)' },
  { lat: 52.4,  lng: 4.9,   text: 'Netherlands',   size: 0.65,color: 'rgba(255,255,255,0.40)' },
  { lat: 50.9,  lng: 4.4,   text: 'Belgium',       size: 0.65,color: 'rgba(255,255,255,0.38)' },
  { lat: 47.4,  lng: 8.5,   text: 'Switzerland',   size: 0.65,color: 'rgba(255,255,255,0.38)' },
  { lat: 48.2,  lng: 16.4,  text: 'Austria',       size: 0.65,color: 'rgba(255,255,255,0.38)' },
  { lat: 52.2,  lng: 21.0,  text: 'Poland',        size: 0.75,color: 'rgba(255,255,255,0.42)' },
  { lat: 50.1,  lng: 14.4,  text: 'Czech Rep.',    size: 0.65,color: 'rgba(255,255,255,0.38)' },
  { lat: 47.5,  lng: 19.0,  text: 'Hungary',       size: 0.65,color: 'rgba(255,255,255,0.38)' },
  { lat: 55.7,  lng: 37.6,  text: 'Moscow',        size: 0.70,color: 'rgba(255,255,255,0.42)' },
  { lat: 61.5,  lng: 105.3, text: 'Russia',        size: 1.10,color: 'rgba(255,255,255,0.50)' },
  { lat: 50.5,  lng: 30.5,  text: 'Ukraine',       size: 0.75,color: 'rgba(255,255,255,0.42)' },
  { lat: 41.0,  lng: 28.9,  text: 'Turkey',        size: 0.80,color: 'rgba(255,255,255,0.45)' },
  { lat: 38.0,  lng: 23.7,  text: 'Greece',        size: 0.70,color: 'rgba(255,255,255,0.40)' },
  { lat: 59.9,  lng: 10.7,  text: 'Norway',        size: 0.65,color: 'rgba(255,255,255,0.38)' },
  { lat: 59.3,  lng: 18.1,  text: 'Sweden',        size: 0.65,color: 'rgba(255,255,255,0.38)' },
  { lat: 60.2,  lng: 25.0,  text: 'Finland',       size: 0.65,color: 'rgba(255,255,255,0.38)' },
  { lat: 55.7,  lng: 12.6,  text: 'Denmark',       size: 0.60,color: 'rgba(255,255,255,0.36)' },
  { lat: 45.8,  lng: 16.0,  text: 'Croatia',       size: 0.60,color: 'rgba(255,255,255,0.36)' },
  { lat: 45.9,  lng: 25.0,  text: 'Romania',       size: 0.70,color: 'rgba(255,255,255,0.40)' },

  // ─── Middle East ───────────────────────────────────────────────────
  { lat: 24.7,  lng: 46.7,  text: 'Saudi Arabia',  size: 0.90,color: 'rgba(255,255,255,0.45)' },
  { lat: 24.5,  lng: 54.4,  text: 'UAE',           size: 0.75,color: 'rgba(255,255,255,0.45)' },
  { lat: 25.3,  lng: 51.5,  text: 'Qatar',         size: 0.60,color: 'rgba(255,255,255,0.40)' },
  { lat: 31.8,  lng: 35.2,  text: 'Israel',        size: 0.65,color: 'rgba(255,255,255,0.40)' },
  { lat: 33.3,  lng: 44.4,  text: 'Iraq',          size: 0.75,color: 'rgba(255,255,255,0.40)' },
  { lat: 35.7,  lng: 51.4,  text: 'Iran',          size: 0.85,color: 'rgba(255,255,255,0.42)' },
  { lat: 33.9,  lng: 35.5,  text: 'Lebanon',       size: 0.60,color: 'rgba(255,255,255,0.36)' },

  // ─── Asia ──────────────────────────────────────────────────────────
  { lat: 35.9,  lng: 104.2, text: 'China',         size: 1.20,color: 'rgba(255,255,255,0.58)' },
  { lat: 35.7,  lng: 139.7, text: 'Japan',         size: 0.90,color: 'rgba(255,255,255,0.50)' },
  { lat: 37.6,  lng: 127.0, text: 'S. Korea',      size: 0.75,color: 'rgba(255,255,255,0.45)' },
  { lat: 28.6,  lng: 77.2,  text: 'India',         size: 1.15,color: 'rgba(255,255,255,0.55)' },
  { lat: 33.7,  lng: 73.1,  text: 'Pakistan',      size: 0.80,color: 'rgba(255,255,255,0.42)' },
  { lat: 23.7,  lng: 90.4,  text: 'Bangladesh',    size: 0.70,color: 'rgba(255,255,255,0.40)' },
  { lat: 13.8,  lng: 100.5, text: 'Thailand',      size: 0.75,color: 'rgba(255,255,255,0.42)' },
  { lat: 21.0,  lng: 105.9, text: 'Vietnam',       size: 0.75,color: 'rgba(255,255,255,0.42)' },
  { lat: 3.1,   lng: 101.7, text: 'Malaysia',      size: 0.70,color: 'rgba(255,255,255,0.40)' },
  { lat: 1.4,   lng: 103.8, text: 'Singapore',     size: 0.60,color: 'rgba(255,255,255,0.40)' },
  { lat: -6.2,  lng: 106.8, text: 'Indonesia',     size: 0.90,color: 'rgba(255,255,255,0.45)' },
  { lat: 14.6,  lng: 121.0, text: 'Philippines',   size: 0.75,color: 'rgba(255,255,255,0.40)' },
  { lat: 48.0,  lng: 66.9,  text: 'Kazakhstan',    size: 0.80,color: 'rgba(255,255,255,0.40)' },
  { lat: 27.7,  lng: 85.3,  text: 'Nepal',         size: 0.60,color: 'rgba(255,255,255,0.36)' },
  { lat: 33.9,  lng: 67.7,  text: 'Afghanistan',   size: 0.70,color: 'rgba(255,255,255,0.38)' },

  // ─── Africa ────────────────────────────────────────────────────────
  { lat: 30.1,  lng: 31.2,  text: 'Egypt',         size: 0.80,color: 'rgba(255,255,255,0.45)' },
  { lat: 9.0,   lng: 8.7,   text: 'Nigeria',       size: 0.85,color: 'rgba(255,255,255,0.45)' },
  { lat: -26.2, lng: 28.0,  text: 'S. Africa',     size: 0.85,color: 'rgba(255,255,255,0.45)' },
  { lat: -1.3,  lng: 36.8,  text: 'Kenya',         size: 0.70,color: 'rgba(255,255,255,0.40)' },
  { lat: 0.4,   lng: 9.5,   text: 'Gabon',         size: 0.55,color: 'rgba(255,255,255,0.36)' },
  { lat: 15.6,  lng: 32.5,  text: 'Sudan',         size: 0.75,color: 'rgba(255,255,255,0.40)' },
  { lat: 3.9,   lng: 11.5,  text: 'Cameroon',      size: 0.65,color: 'rgba(255,255,255,0.38)' },
  { lat: 31.8,  lng: -7.1,  text: 'Morocco',       size: 0.75,color: 'rgba(255,255,255,0.42)' },
  { lat: 28.0,  lng: 1.7,   text: 'Algeria',       size: 0.80,color: 'rgba(255,255,255,0.40)' },
  { lat: 15.5,  lng: -14.5, text: 'Senegal',       size: 0.60,color: 'rgba(255,255,255,0.36)' },
  { lat: -18.7, lng: 35.5,  text: 'Mozambique',    size: 0.65,color: 'rgba(255,255,255,0.36)' },
  { lat: -13.3, lng: 34.3,  text: 'Malawi',        size: 0.55,color: 'rgba(255,255,255,0.34)' },
  { lat: -11.2, lng: 17.9,  text: 'Angola',        size: 0.70,color: 'rgba(255,255,255,0.38)' },
  { lat: 12.4,  lng: -1.5,  text: 'Burkina Faso',  size: 0.55,color: 'rgba(255,255,255,0.34)' },
  { lat: 14.7,  lng: 17.4,  text: 'Chad',          size: 0.65,color: 'rgba(255,255,255,0.36)' },
  { lat: 6.5,   lng: -5.2,  text: 'Ivory Coast',   size: 0.65,color: 'rgba(255,255,255,0.38)' },
  { lat: 36.8,  lng: 10.2,  text: 'Tunisia',       size: 0.65,color: 'rgba(255,255,255,0.38)' },
  { lat: -1.9,  lng: 29.9,  text: 'Rwanda',        size: 0.55,color: 'rgba(255,255,255,0.34)' },
  { lat: -4.3,  lng: 15.3,  text: 'D.R. Congo',    size: 0.75,color: 'rgba(255,255,255,0.40)' },

  // ─── Oceania ───────────────────────────────────────────────────────
  { lat: -25.3, lng: 133.8, text: 'Australia',     size: 1.10,color: 'rgba(255,255,255,0.52)' },
  { lat: -36.9, lng: 174.8, text: 'New Zealand',   size: 0.70,color: 'rgba(255,255,255,0.40)' },

  // ─── Oceans ────────────────────────────────────────────────────────
  // dotRadius: 0 hides the pin dot so the label floats cleanly over open water
  { lat:  5,  lng: -150, text: 'PACIFIC OCEAN',   size: 1.8, color: 'rgba(120,195,255,0.38)', dotRadius: 0 },
  { lat: 15,  lng:  -30, text: 'ATLANTIC OCEAN',  size: 1.4, color: 'rgba(120,195,255,0.36)', dotRadius: 0 },
  { lat: -22, lng:   75, text: 'INDIAN OCEAN',    size: 1.3, color: 'rgba(120,195,255,0.36)', dotRadius: 0 },
  { lat:  82, lng:    0, text: 'ARCTIC OCEAN',    size: 0.9, color: 'rgba(120,195,255,0.32)', dotRadius: 0 },
  { lat: -60, lng:   45, text: 'SOUTHERN OCEAN',  size: 0.9, color: 'rgba(120,195,255,0.32)', dotRadius: 0 },
]
