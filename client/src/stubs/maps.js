function formatAddress(item) {
  const a = item.address || {};
  const parts = [];
  if (a.house_number && a.road) parts.push(`${a.house_number} ${a.road}`);
  else if (a.road) parts.push(a.road);
  if (a.city || a.town || a.suburb) parts.push(a.city || a.town || a.suburb);
  if (a.state) parts.push(a.state);
  if (a.postcode) parts.push(a.postcode);
  return parts.length
    ? parts.join(', ')
    : item.display_name.split(',').slice(0, 3).join(',').trim();
}

export const autocompleteLocation = async (query) => {
  if (!query || query.length < 2) return [];

  // Append Tampa context for short/bare queries so Nominatim resolves
  // partial addresses much earlier (e.g. "4618 N Hale" → "4618 N Hale, Tampa FL")
  const hasContext = /(tampa|florida|\bfl\b|hillsborough)/i.test(query);
  const searchQuery = hasContext ? query : `${query}, Tampa FL`;

  const params = new URLSearchParams({
    q: searchQuery,
    format: 'json',
    limit: '6',
    countrycodes: 'us',
    // Bias results toward Tampa metro area (not hard-bounded so other FL cities still work)
    viewbox: '-82.85,28.17,-82.28,27.82',
    bounded: '0',
    addressdetails: '1',
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { 'User-Agent': 'ReBuilt-Ambassador-Platform/1.0' } }
  );
  const data = await res.json();

  return data.slice(0, 5).map((item) => ({
    description: formatAddress(item),
    placeId: item.place_id,
  }));
};
