import type { Restaurant } from './types';

// Coordinates of key Hanoi culinary streets
export const STREET_COORDINATES: Record<string, [number, number]> = {
  // Hoàn Kiếm
  'hàng mành': [21.0315, 105.8492],
  'bát đàn': [21.0333, 105.8475],
  'thợ nhuộm': [21.0256, 105.8453],
  'hàng giấy': [21.0381, 105.8491],
  'hàng điếu': [21.0328, 105.8481],
  'ngõ trạm': [21.0312, 105.8465],
  'đường thành': [21.0322, 105.8468],
  'lý nam đế': [21.0360, 105.8436],
  'ngõ gạch': [21.0354, 105.8505],
  'hàng mã': [21.0365, 105.8482],
  'cửa nam': [21.0270, 105.8430],

  // Ba Đình
  'quán thánh': [21.0422, 105.8410],
  'hòe nhai': [21.0416, 105.8439],
  'dốc hòe nhai': [21.0416, 105.8439],
  'đội cấn': [21.0350, 105.8235],
  'trấn vũ': [21.0463, 105.8368],
  'phan đình phùng': [21.0401, 105.8415],
  'phan kế bính': [21.0337, 105.8115],
  'nam tràng': [21.0487, 105.8384],
  'phạm hồng thái': [21.0428, 105.8435],
  'nguyễn trường tộ': [21.0410, 105.8445],
  'trần tế xương': [21.0480, 105.8380],

  // Cầu Giấy
  'trần quốc hoàn': [21.0440, 105.7875],
  'tô hiệu': [21.0425, 105.7930],
  'nghĩa tân': [21.0435, 105.7925],
  'xuân thuỷ': [21.0370, 105.7870],
  'xuân thủy': [21.0370, 105.7870],
  'dương khuê': [21.0320, 105.7760],
  'doãn kế thiện': [21.0420, 105.7790],
  'nguyễn khánh toàn': [21.0375, 105.7985],
  'nguyễn bá khoản': [21.0180, 105.7990],
  'mỹ đình': [21.0260, 105.7720],
  'hoàng công chất': [21.0485, 105.7660],
  'cốm vòng': [21.0340, 105.7880],

  // Đống Đa
  'ô chợ dừa': [21.0190, 105.8270],
  'hồ đắc di': [21.0135, 105.8305],

  // Bắc Từ Liêm
  'phú diễn': [21.0500, 105.7590],
  'cầu diễn': [21.0450, 105.7600],
  'nguyên xá': [21.0560, 105.7420],

  // Thanh Xuân
  'khương hạ': [20.9920, 105.8170],

  // Hoàng Mai
  'nguyễn hữu thọ': [20.9680, 105.8340],
};

// Center of each district in Hanoi
export const DISTRICT_CENTERS: Record<string, [number, number]> = {
  'Hoàn Kiếm': [21.0310, 105.8520],
  'Ba Đình': [21.0360, 105.8300],
  'Đống Đa': [21.0180, 105.8260],
  'Hai Bà Trưng': [21.0080, 105.8520],
  'Cầu Giấy': [21.0350, 105.7920],
  'Tây Hồ': [21.0620, 105.8250],
  'Thanh Xuân': [20.9980, 105.8080],
  'Hoàng Mai': [20.9780, 105.8500],
  'Bắc Từ Liêm': [21.0520, 105.7580],
  'Nam Từ Liêm': [21.0160, 105.7680],
  'Long Biên': [21.0420, 105.8850],
  'Hà Đông': [20.9700, 105.7750],
  'Gia Lâm': [21.0200, 105.9200],
  'Đông Anh': [21.1350, 105.8450],
  'Thanh Trì': [20.9450, 105.8450],
  'Sóc Sơn': [21.2650, 105.8450],
};

// Default center of Hanoi (Hoàn Kiếm)
export const HANOI_CENTER: [number, number] = [21.0285, 105.8385];

/**
 * Generate a deterministic slight jitter for restaurants that share the same district center
 * so their pins don't overlap completely on the map.
 */
function getDeterministicOffset(id: string): [number, number] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((hash % 1000) / 1000 - 0.5) * 0.007;
  const lonOffset = (((hash >> 3) % 1000) / 1000 - 0.5) * 0.007;
  return [latOffset, lonOffset];
}

/**
 * Extract lat/lng coordinates from a Google Maps URL.
 * Supports formats:
 *   - https://maps.google.com/.../@21.0285,105.8385,...
 *   - https://maps.app.goo.gl/... (after redirect contains @lat,lng)
 *   - https://www.google.com/maps/place/.../@lat,lng,...
 *   - https://www.google.com/maps?q=lat,lng
 *   - https://www.google.com/maps/...!3d21.0285!4d105.8385
 */
export function extractCoordsFromMapUrl(url: string): [number, number] | null {
  if (!url) return null;

  // Pattern 1: @lat,lng in URL path
  const atMatch = url.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidHanoiCoords(lat, lng)) return [lat, lng];
  }

  // Pattern 2: !3dlat!4dlng (Google Maps embed/internal format)
  const embedMatch = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (embedMatch) {
    const lat = parseFloat(embedMatch[1]);
    const lng = parseFloat(embedMatch[2]);
    if (isValidHanoiCoords(lat, lng)) return [lat, lng];
  }

  // Pattern 3: ?q=lat,lng or &q=lat,lng
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (isValidHanoiCoords(lat, lng)) return [lat, lng];
  }

  // Pattern 4: /place/lat,lng
  const placeMatch = url.match(/\/place\/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (placeMatch) {
    const lat = parseFloat(placeMatch[1]);
    const lng = parseFloat(placeMatch[2]);
    if (isValidHanoiCoords(lat, lng)) return [lat, lng];
  }

  return null;
}

/**
 * Basic validation that coordinates are within the greater Hanoi area
 */
function isValidHanoiCoords(lat: number, lng: number): boolean {
  return lat > 20.5 && lat < 21.5 && lng > 105.2 && lng < 106.2;
}

/**
 * Resolve [lat, lng] coordinates for any restaurant in Hanoi.
 * Priority: map_url coords > known street > district center > Hanoi center
 */
export function getRestaurantCoordinates(restaurant: Restaurant): [number, number] {
  // 1. Try extracting exact coordinates from Google Maps URL
  if (restaurant.map_url) {
    const exactCoords = extractCoordsFromMapUrl(restaurant.map_url);
    if (exactCoords) return exactCoords;
  }

  // 2. Try matching known streets from address text
  const text = `${restaurant.address || ''} ${restaurant.name || ''}`.toLowerCase();
  for (const [street, coords] of Object.entries(STREET_COORDINATES)) {
    if (text.includes(street)) {
      const [jitterLat, jitterLon] = getDeterministicOffset(restaurant.id);
      return [coords[0] + jitterLat * 0.2, coords[1] + jitterLon * 0.2];
    }
  }

  // 3. Fallback to district center with offset
  const districtCenter = DISTRICT_CENTERS[restaurant.district];
  if (districtCenter) {
    const [jitterLat, jitterLon] = getDeterministicOffset(restaurant.id);
    return [districtCenter[0] + jitterLat, districtCenter[1] + jitterLon];
  }

  // 4. Fallback to Hanoi center
  const [jitterLat, jitterLon] = getDeterministicOffset(restaurant.id);
  return [HANOI_CENTER[0] + jitterLat * 2, HANOI_CENTER[1] + jitterLon * 2];
}

/**
 * Calculate distance in kilometers between two GPS coordinates (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Generate Google Maps navigation URL for a restaurant
 */
export function getDirectionsUrl(restaurant: Restaurant): string {
  if (restaurant.map_url && restaurant.map_url.trim().startsWith('http')) {
    return restaurant.map_url;
  }
  const query = `${restaurant.name}, ${restaurant.address || restaurant.district}, Hà Nội`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
