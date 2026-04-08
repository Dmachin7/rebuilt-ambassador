/**
 * ─── STUB: Google Maps Places Autocomplete ────────────────────────────────────
 *
 * autocompleteLocation
 *   Replace with: Google Maps Places Autocomplete API
 *   Load the Maps JS SDK: <script src="https://maps.googleapis.com/maps/api/js?key=KEY&libraries=places">
 *   Then: new google.maps.places.AutocompleteService().getPlacePredictions({ input: query })
 *   Env: VITE_GOOGLE_MAPS_API_KEY (add to client/.env)
 */

export const autocompleteLocation = async (query) => {
  // STUB — returns mock suggestions, replace with Google Maps Places API
  console.log(`[STUB maps.js] autocompleteLocation("${query}")`);
  if (!query || query.length < 2) return [];
  return [
    { description: `${query} - Austin, TX`, placeId: 'mock-1' },
    { description: `${query} Market - Round Rock, TX`, placeId: 'mock-2' },
    { description: `${query} Store - Cedar Park, TX`, placeId: 'mock-3' },
  ];
};
