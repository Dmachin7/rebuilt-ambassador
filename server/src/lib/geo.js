// Free, no-API-key geocoding (Nominatim/OpenStreetMap) helpers.
const geocodeCache = new Map();

async function lookupCoords(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ReBuilt-Ambassador-Platform/1.0' },
  });
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

// US Census Bureau geocoder (government TIGER/Line data) — a second, independent, free source.
// Covers some US addresses OpenStreetMap's crowd-sourced data misses, and vice versa.
async function censusLookupCoords(query) {
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(query)}&benchmark=Public_AR_Current&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  const match = data?.result?.addressMatches?.[0];
  if (!match) return null;
  return { lat: match.coordinates.y, lng: match.coordinates.x };
}

// Venue-name-prefixed addresses (e.g. "Whole Foods Market, 4001 S Lamar Blvd, Austin, TX 78704")
// often fail on the free geocoder, which expects a street address — retry without the leading
// non-address segment (i.e. the part before the first comma that doesn't start with a number).
function withoutVenuePrefix(address) {
  const parts = address.split(',');
  if (parts.length < 2 || /^\s*\d/.test(parts[0])) return null;
  return parts.slice(1).join(',').trim();
}

// USPS mailing addresses often use a city name (e.g. "Tampa") that doesn't match the actual
// unincorporated place OpenStreetMap files the street under (e.g. "Town 'n' Country") — very
// common in Florida. The zip code is unambiguous, so retry with just "street, zip", dropping
// the city/state entirely.
function streetPlusZip(address) {
  const zipMatch = address.match(/\b\d{5}\b/);
  const street = address.split(',').map((p) => p.trim()).find((p) => /^\d/.test(p));
  if (!zipMatch || !street) return null;
  return `${street}, ${zipMatch[0]}`;
}

async function geocodeAddress(address) {
  if (geocodeCache.has(address)) return geocodeCache.get(address);

  let coords = await lookupCoords(address);

  if (!coords) {
    const fallback = withoutVenuePrefix(address);
    if (fallback) coords = await lookupCoords(fallback);
  }

  if (!coords) {
    const fallback = streetPlusZip(address);
    if (fallback) coords = await lookupCoords(fallback);
  }

  if (!coords) coords = await censusLookupCoords(address);

  if (!coords) throw new Error(`Could not geocode address: ${address}`);

  geocodeCache.set(address, coords);
  return coords;
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { geocodeAddress, haversineDistance };
