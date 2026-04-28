export const autocompleteLocation = async (query) => {
  if (!query || query.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ReBuilt-Ambassador-Platform/1.0' },
  });
  const data = await res.json();
  return data.map((item) => ({ description: item.display_name, placeId: item.place_id }));
};
