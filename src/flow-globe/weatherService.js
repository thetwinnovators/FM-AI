/**
 * weatherService.js — thin wrappers over two free, no-key-required APIs.
 *
 *   Weather:     Open-Meteo  (api.open-meteo.com)
 *   Reverse geo: Nominatim   (nominatim.openstreetmap.org)
 */

// WMO Weather interpretation codes → [human label, emoji]
const WMO = {
  0:  ['Clear sky',                '☀️'],
  1:  ['Mainly clear',             '🌤️'],
  2:  ['Partly cloudy',            '⛅'],
  3:  ['Overcast',                 '☁️'],
  45: ['Fog',                      '🌫️'],
  48: ['Depositing rime fog',      '🌫️'],
  51: ['Light drizzle',            '🌦️'],
  53: ['Drizzle',                  '🌦️'],
  55: ['Heavy drizzle',            '🌧️'],
  56: ['Light freezing drizzle',   '🌧️'],
  57: ['Freezing drizzle',         '🌧️'],
  61: ['Slight rain',              '🌧️'],
  63: ['Rain',                     '🌧️'],
  65: ['Heavy rain',               '🌧️'],
  66: ['Light freezing rain',      '🌧️'],
  67: ['Freezing rain',            '🌧️'],
  71: ['Slight snow',              '🌨️'],
  73: ['Snow',                     '❄️'],
  75: ['Heavy snow',               '❄️'],
  77: ['Snow grains',              '🌨️'],
  80: ['Slight showers',           '🌦️'],
  81: ['Showers',                  '🌧️'],
  82: ['Violent showers',          '⛈️'],
  85: ['Slight snow showers',      '🌨️'],
  86: ['Heavy snow showers',       '❄️'],
  95: ['Thunderstorm',             '⛈️'],
  96: ['Thunderstorm + hail',      '⛈️'],
  99: ['Thunderstorm + heavy hail','⛈️'],
}

/**
 * Fetch current weather for a coordinate pair.
 *
 * Returns:
 *   { temp, feelsLike, humidity, windKmh, condition, icon, timezone, tzAbbr }
 */
export async function fetchWeather(lat, lng) {
  const p = new URLSearchParams({
    latitude:        lat.toFixed(4),
    longitude:       lng.toFixed(4),
    current:         'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m',
    wind_speed_unit: 'kmh',
    timezone:        'auto',
  })
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`)
  if (!r.ok) throw new Error(`Weather HTTP ${r.status}`)
  const d = await r.json()
  const c = d.current
  const [condition, icon] = WMO[c.weather_code] ?? ['Unknown', '🌡️']
  return {
    temp:      Math.round(c.temperature_2m),
    feelsLike: Math.round(c.apparent_temperature),
    humidity:  c.relative_humidity_2m,
    windKmh:   Math.round(c.wind_speed_10m),
    condition,
    icon,
    timezone:  d.timezone               ?? null,
    tzAbbr:    d.timezone_abbreviation  ?? null,
  }
}

/**
 * Reverse-geocode a coordinate to a short city/town name.
 * Falls back through: city → town → village → county → state → country → display_name[0]
 */
export async function reverseGeocode(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse` +
    `?lat=${lat}&lon=${lng}&format=json`
  const r = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'FlowMap/1.0' },
  })
  if (!r.ok) throw new Error(`Reverse-geocode HTTP ${r.status}`)
  const d = await r.json()
  const a = d.address ?? {}
  return (
    a.city || a.town || a.village ||
    a.county || a.state || a.country ||
    d.display_name.split(',')[0]
  )
}
