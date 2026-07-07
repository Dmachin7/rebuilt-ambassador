// Free, no-API-key geocoding (Nominatim/OpenStreetMap) and driving-route (OSRM) helpers.
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

// Venue-name-prefixed addresses (e.g. "Whole Foods Market, 4001 S Lamar Blvd, Austin, TX 78704")
// often fail on the free geocoder, which expects a street address — retry without the leading
// non-address segment (i.e. the part before the first comma that doesn't start with a number).
function withoutVenuePrefix(address) {
  const parts = address.split(',');
  if (parts.length < 2 || /^\s*\d/.test(parts[0])) return null;
  return parts.slice(1).join(',').trim();
}

async function geocodeAddress(address) {
  if (geocodeCache.has(address)) return geocodeCache.get(address);

  let coords = await lookupCoords(address);
  if (!coords) {
    const fallback = withoutVenuePrefix(address);
    if (fallback) coords = await lookupCoords(fallback);
  }
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

// One-way driving distance/time along real roads between two coordinates (OSRM public routing API)
async function getDrivingRoute(origin, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error('Could not calculate driving route');
  }
  const route = data.routes[0];
  return {
    miles: Math.round((route.distance / 1609.34) * 10) / 10,
    driveTimeMins: Math.round(route.duration / 60),
  };
}

module.exports = { geocodeAddress, haversineDistance, getDrivingRoute };
