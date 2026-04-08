/**
 * ─── STUB: GPS / Geolocation ───────────────────────────────────────────────────
 *
 * getCurrentLocation
 *   Replace with: navigator.geolocation.getCurrentPosition()
 *   Then send { lat, lng } to /api/shifts/:id/checkin
 *   Server will verify distance <= 300 feet (91 meters) from event location
 *   using Google Maps Geocoding API to convert event address to coords
 */

export const getCurrentLocation = async () => {
  // STUB — always returns mock coordinates "in range"
  // TODO: Replace with navigator.geolocation.getCurrentPosition()
  console.log('[STUB gps.js] getCurrentLocation — mock always returns "in range"');
  return {
    lat: 30.2672,
    lng: -97.7431,
    mock: true,
    inRange: true,
  };
};
