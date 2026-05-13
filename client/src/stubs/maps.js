export const autocompleteLocation = async (query) => {
  if (!query || query.length < 2) return [];

  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) {
    console.warn('VITE_MAPBOX_TOKEN is not set');
    return [];
  }

  const params = new URLSearchParams({
    access_token: token,
    country: 'us',
    proximity: '-82.4572,27.9506', // Tampa, FL — biases results toward HQ area
    types: 'address,poi',
    limit: '6',
    language: 'en',
  });

  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`
  );
  const data = await res.json();

  return (data.features || []).map((f) => ({
    description: f.place_name.replace(', United States', ''),
    placeId: f.id,
  }));
};
