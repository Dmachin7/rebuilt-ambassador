/**
 * ─── STUB: Google Maps Integration ────────────────────────────────────────────
 *
 * calculateDistanceFromHQ
 *   Replace with: Google Maps Distance Matrix API
 *   Endpoint: https://maps.googleapis.com/maps/api/distancematrix/json
 *   Params: origins=REBUILT_HQ_ADDRESS, destinations=location, key=GOOGLE_MAPS_API_KEY
 *   Returns: { miles, driveTimeMins }
 *
 * autocompleteLocation
 *   Replace with: Google Maps Places Autocomplete API
 *   Endpoint: https://maps.googleapis.com/maps/api/place/autocomplete/json
 *   Params: input=query, key=GOOGLE_MAPS_API_KEY, components=country:us
 *   Returns: Array of { description, placeId }
 *
 * Env vars needed: GOOGLE_MAPS_API_KEY, REBUILT_HQ_ADDRESS
 */

const MOCK_DISTANCES = [
  { miles: 5.2, driveTimeMins: 14 },
  { miles: 9.8, driveTimeMins: 22 },
  { miles: 3.1, driveTimeMins: 9 },
  { miles: 15.4, driveTimeMins: 28 },
  { miles: 23.4, driveTimeMins: 35 },
];

const calculateDistanceFromHQ = async (location) => {
  // STUB — replace with Google Maps Distance Matrix API call
  console.log(`[STUB maps.js] calculateDistanceFromHQ("${location}")`);
  const mock = MOCK_DISTANCES[Math.floor(Math.random() * MOCK_DISTANCES.length)];
  return { miles: mock.miles, driveTimeMins: mock.driveTimeMins };
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
