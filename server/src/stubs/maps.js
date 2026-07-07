const { geocodeAddress, getDrivingRoute } = require('../lib/geo');
const { HQ_ADDRESS } = require('../config/constants');

// One-way driving distance/miles from HQ to an event location, via free
// geocoding (Nominatim) + routing (OSRM) — no API key required.
const calculateDistanceFromHQ = async (location) => {
  const [hqCoords, eventCoords] = await Promise.all([
    geocodeAddress(HQ_ADDRESS),
    geocodeAddress(location),
  ]);
  return getDrivingRoute(hqCoords, eventCoords);
};

const autocompleteLocation = async (query) => {
  // STUB — replace with Google Maps Places Autocomplete API call
  console.log(`[STUB maps.js] autocompleteLocation("${query}")`);
  return [
    { description: `${query} - Austin, TX`, placeId: 'mock-place-1' },
    { description: `${query} - Round Rock, TX`, placeId: 'mock-place-2' },
    { description: `${query} - Cedar Park, TX`, placeId: 'mock-place-3' },
    { description: `${query} - Pflugerville, TX`, placeId: 'mock-place-4' },
  ];
};

module.exports = { calculateDistanceFromHQ, autocompleteLocation };
