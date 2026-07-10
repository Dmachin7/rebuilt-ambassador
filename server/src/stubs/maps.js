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

module.exports = { autocompleteLocation };
