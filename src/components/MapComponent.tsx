'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Restaurant } from '@/lib/types';
import {
  getRestaurantLocation,
  calculateDistance,
  getDirectionsUrl,
  HANOI_CENTER,
  DISTRICT_CENTERS,
} from '@/lib/geo';
import {
  Navigation,
  Locate,
  ChevronRight,
  Layers,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCategoryInfo } from '@/lib/utils';

interface MapComponentProps {
  restaurants: Restaurant[];
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
}

export type MapStyleKey = 'google-streets' | 'google-hybrid';

export const MAP_STYLES: Record<
  MapStyleKey,
  {
    name: string;
    description: string;
    url: string;
    subdomains: string[];
    maxZoom: number;
    attribution: string;
  }
> = {
  'google-streets': {
    name: 'Google Maps',
    description: 'Bản đồ đường sá chi tiết',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps',
  },
  'google-hybrid': {
    name: 'Vệ tinh Google',
    description: 'Ảnh vệ tinh kèm tên đường',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps',
  },
};


export default function MapComponent({ restaurants }: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const router = useRouter();

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState('Tất cả');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>('google-streets');
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  // Derive district list dynamically from actual restaurant data
  const districtList = useMemo(() => {
    const districts = [...new Set(restaurants.map((r) => r.district).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, 'vi')
    );
    return ['Tất cả', ...districts];
  }, [restaurants]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: HANOI_CENTER,
      zoom: 13,
      zoomControl: false,
    });

    // Default tile layer (Google Maps standard)
    const styleCfg = MAP_STYLES['google-streets'];
    const initialTileLayer = L.tileLayer(styleCfg.url, {
      subdomains: styleCfg.subdomains,
      maxZoom: styleCfg.maxZoom,
      attribution: styleCfg.attribution,
    }).addTo(map);

    tileLayerRef.current = initialTileLayer;

    // Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = markersLayer;

    // Fix map sizing issues in dynamic containers
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // Update Tile Layer when style changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const styleCfg = MAP_STYLES[currentStyle];
    const newTileLayer = L.tileLayer(styleCfg.url, {
      subdomains: styleCfg.subdomains,
      maxZoom: styleCfg.maxZoom,
      attribution: styleCfg.attribution,
    }).addTo(map);

    newTileLayer.bringToBack();
    tileLayerRef.current = newTileLayer;
  }, [currentStyle]);

  // Update Markers when restaurants or selectedDistrict changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    const filtered =
      selectedDistrict === 'Tất cả'
        ? restaurants
        : restaurants.filter((r) => r.district === selectedDistrict);

    filtered.forEach((restaurant) => {
      const { coordinates: coords, isApproximate } = getRestaurantLocation(restaurant);

      // Ghim Ảnh Món Ăn Tròn (Luxury Photo Avatar Pin)
      let bezelColor = '#7EC8A4';
      let pointerColor = '#7EC8A4';
      let badgeHtml = '<div class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent text-[#0D1B16] text-[9px] font-black flex items-center justify-center shadow border border-white/60 z-20">✓</div>';
      let pinShadow = 'filter: drop-shadow(0 4px 10px rgba(0,0,0,0.35));';

      if (restaurant.rating === 'ngon') {
        // Quán Đỉnh: Viền Vàng Kim + Con dấu Sao Vàng (Michelin / Signature Pick)
        bezelColor = '#D4A359';
        pointerColor = '#D4A359';
        badgeHtml = '<div class="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-gradient-to-br from-[#F4D06F] to-[#B8860B] text-[#0D1B16] text-[10px] font-black flex items-center justify-center shadow-md border border-white/80 z-20">★</div>';
        pinShadow = 'filter: drop-shadow(0 4px 14px rgba(212,163,89,0.55));';
      } else if (restaurant.rating === 'khong_ngon') {
        // Quán Né: Viền Terracotta
        bezelColor = '#C84B31';
        pointerColor = '#C84B31';
        badgeHtml = '<div class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#C84B31] text-white text-[9px] font-black flex items-center justify-center shadow border border-white/60 z-20">✕</div>';
        pinShadow = 'filter: drop-shadow(0 3px 8px rgba(0,0,0,0.4));';
      }

      const escapedName = restaurant.name.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const escapedAddress = (restaurant.address || 'Hà Nội').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const escapedDistrict = (restaurant.district || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const priceTag = restaurant.price ? `<span class="text-[10px] text-accent font-semibold">${escapeHtml(restaurant.price)}</span>` : '';
      const imageUrl = escapeHtml(restaurant.image_url || '');

      const photoHtml = restaurant.image_url
        ? `<img src="${imageUrl}" alt="${escapedName}" class="w-full h-full object-cover transform group-hover:scale-115 transition-transform duration-300" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
           <div class="w-full h-full hidden items-center justify-center bg-[#16302A] text-base">🍜</div>`
        : `<div class="w-full h-full flex items-center justify-center bg-[#16302A] text-base">🍜</div>`;

      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div class="relative group cursor-pointer flex flex-col items-center select-none" style="${pinShadow}">
            <!-- Hover Floating Monogram Label -->
            <div class="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-xl bg-card/95 text-foreground border border-border shadow-2xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap flex items-center gap-1.5 z-50 transform group-hover:-translate-y-1">
              <span class="font-editorial text-xs font-bold tracking-tight text-foreground">${escapedName}</span>
              ${priceTag}
            </div>

            <!-- Avatar Pin Frame -->
            <div class="relative transform transition-transform duration-200 group-hover:scale-115">
              ${badgeHtml}
              <!-- Photo Circle -->
              <div class="w-10 h-10 rounded-full overflow-hidden bg-[#16302A] border-[2.5px] shadow-md flex items-center justify-center" style="border-color: ${bezelColor};">
                ${photoHtml}
              </div>
              <!-- Tapered Bottom Needle Point -->
              <div class="w-0 h-0 border-x-[5px] border-x-transparent border-t-[7px] mx-auto -mt-[1px]" style="border-t-color: ${pointerColor};"></div>
            </div>
          </div>
        `,
        iconSize: [44, 52],
        iconAnchor: [22, 52],
        popupAnchor: [0, -52],
      });

      // Calculate distance if user location is available
      let distanceText = isApproximate ? 'Vị trí ước lượng — mở Chỉ đường để xem địa chỉ' : '';
      if (userLocation && !isApproximate) {
        const dist = calculateDistance(
          userLocation[0],
          userLocation[1],
          coords[0],
          coords[1]
        );
        distanceText = `Cách bạn khoảng ${dist} km (đường thẳng)`;
      }

      const directionsUrl = escapeHtml(getDirectionsUrl(restaurant));

      const popupHtml = `
        <div class="p-1.5 max-w-[250px] font-sans text-foreground">
          ${
            restaurant.image_url
              ? `<div class="relative h-28 w-full rounded-xl overflow-hidden mb-2 bg-secondary border border-border/80">
                  <img src="${imageUrl}" alt="${escapedName}" class="w-full h-full object-cover" />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                </div>`
              : ''
          }
          <div class="flex items-center gap-1.5 mb-1.5">
            ${
              restaurant.rating === 'ngon'
                ? '<span class="gold-seal text-[9px] px-2 py-0.5 font-bold">★ Ngon tuyệt</span>'
                : restaurant.rating === 'khong_ngon'
                ? '<span class="stamp-seal text-[9px] px-2 py-0.5 font-bold">✕ Không hợp</span>'
                : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold bg-secondary text-text-secondary border border-border">✓ Khá ổn</span>'
            }
            <span class="text-[10px] text-text-muted font-medium">• ${escapedDistrict}</span>
          </div>

          <h4 class="font-editorial font-bold text-sm text-foreground leading-snug mb-1">${escapedName}</h4>
          <p class="text-[11px] text-text-secondary line-clamp-2 mb-2">${escapedAddress}</p>

          ${
            distanceText
              ? `<p class="text-[11px] font-semibold text-accent mb-2.5 flex items-center gap-1">📍 ${distanceText}</p>`
              : ''
          }

          <div class="flex items-center gap-2 pt-2 border-t border-border">
            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="flex-1 text-center py-2 px-3 min-h-[36px] rounded-xl bg-accent text-white dark:text-[#0D1B16] font-bold text-xs hover:opacity-95 active:scale-95 transition-all shadow-sm flex items-center justify-center">
              Chỉ đường
            </a>
            <a data-navigate="/restaurant/${restaurant.id}" href="#" class="flex-1 text-center py-2 px-3 min-h-[36px] rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-foreground font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center">
              Chi tiết
            </a>
          </div>
        </div>
      `;

      const marker = L.marker(coords, { icon: customIcon }).addTo(markersLayer);
      marker.bindPopup(popupHtml, {
        className: 'custom-leaflet-popup',
        maxWidth: 270,
        autoPanPaddingTopLeft: L.point(12, 70),
        autoPanPaddingBottomRight: L.point(12, 170),
      });

      // Intercept 'Chi tiết' link clicks for client-side navigation
      marker.on('popupopen', () => {
        const popup = marker.getPopup();
        if (!popup) return;
        const container = popup.getElement();
        if (!container) return;
        const detailLink = container.querySelector('[data-navigate]') as HTMLElement;
        if (detailLink) {
          detailLink.addEventListener('click', (e) => {
            e.preventDefault();
            const href = detailLink.getAttribute('data-navigate');
            if (href) router.push(href);
          });
        }
      });

      marker.on('click', () => {
        setSelectedRestaurant(restaurant);
      });
    });
  }, [restaurants, selectedDistrict, userLocation, router]);

  // Locate User
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserLocation([lat, lng]);

        const map = mapInstanceRef.current;
        if (!map) return;

        // Add or move user marker (Modern Radar Pulse)
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([lat, lng]);
        } else {
          const userIcon = L.divIcon({
            className: 'user-location-pin',
            html: `
              <div class="relative flex items-center justify-center">
                <div class="w-8 h-8 rounded-full bg-accent/25 border border-accent/40 animate-ping absolute"></div>
                <div class="w-5 h-5 rounded-full bg-accent border-2 border-white shadow-lg flex items-center justify-center z-10">
                  <div class="w-2 h-2 rounded-full bg-bg-primary"></div>
                </div>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          userMarkerRef.current = L.marker([lat, lng], { icon: userIcon }).addTo(map);
        }

        map.flyTo([lat, lng], 15, { duration: 1.2 });
      },
      (err) => {
        setLocating(false);
        console.error(err);
        alert('Không thể lấy vị trí. Vui lòng cho phép quyền truy cập vị trí trên trình duyệt.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Switch district & pan map
  const handleSelectDistrict = (district: string) => {
    setSelectedDistrict(district);
    const map = mapInstanceRef.current;
    if (!map) return;

    if (district === 'Tất cả') {
      map.flyTo(HANOI_CENTER, 13, { duration: 1 });
    } else if (DISTRICT_CENTERS[district]) {
      map.flyTo(DISTRICT_CENTERS[district], 14, { duration: 1 });
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Top District Filter Chips */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pointer-events-auto">
        {districtList.map((district) => {
          const count =
            district === 'Tất cả'
              ? restaurants.length
              : restaurants.filter((r) => r.district === district).length;

          const isSelected = selectedDistrict === district;
          return (
            <button
              key={district}
              type="button"
              onClick={() => handleSelectDistrict(district)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-all cursor-pointer shadow-md flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-accent text-bg-primary font-bold shadow-accent/20 border border-accent'
                  : 'bg-card/90 text-text-secondary border border-border/80 hover:text-foreground'
              }`}
            >
              <span>{district}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-bg-primary/30 text-bg-primary' : 'bg-[#0D1B16]/60 text-text-muted'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Floating Layer Switcher */}
      <div className="absolute bottom-36 right-4 z-[1000]">
        <button
          type="button"
          onClick={() => setShowStyleMenu(!showStyleMenu)}
          title="Chuyển chế độ bản đồ"
          className="w-12 h-12 rounded-full bg-card/95 backdrop-blur-md border border-border/80 shadow-xl flex items-center justify-center text-foreground hover:text-accent hover:border-accent active:scale-95 transition-all cursor-pointer"
        >
          <Layers size={22} className={showStyleMenu ? 'text-accent' : ''} />
        </button>

        {showStyleMenu && (
          <div className="absolute bottom-0 right-14 bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl p-2 shadow-2xl w-56 flex flex-col gap-1 animate-in fade-in slide-in-from-right-2 duration-150">
            <div className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Kiểu bản đồ
            </div>
            {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => {
              const item = MAP_STYLES[key];
              const isActive = currentStyle === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setCurrentStyle(key);
                    setShowStyleMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-accent/15 text-accent font-semibold border border-accent/30'
                      : 'text-text-secondary hover:bg-secondary/60 hover:text-foreground'
                  }`}
                >
                  <div>
                    <div className="font-medium text-foreground">{item.name}</div>
                    <div className="text-[10px] text-text-muted">{item.description}</div>
                  </div>
                  {isActive && <Check size={14} className="text-accent shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating GPS Button */}
      <button
        type="button"
        onClick={handleLocateUser}
        disabled={locating}
        title="Vị trí của tôi"
        className="absolute bottom-20 right-4 z-[1000] w-12 h-12 rounded-full bg-card/95 backdrop-blur-md border border-border/80 shadow-xl flex items-center justify-center text-foreground hover:text-accent hover:border-accent active:scale-95 transition-all cursor-pointer disabled:opacity-50"
      >
        <Locate size={22} className={locating ? 'animate-spin text-accent' : ''} />
      </button>

      {/* Selected Restaurant Quick Card at Bottom (Mobile view) */}
      {selectedRestaurant && (
        <div className="absolute bottom-4 left-4 right-18 md:right-auto md:w-80 z-[1000] bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl p-3 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div>
              <span className="text-[10px] uppercase font-bold text-accent">
                {selectedRestaurant.district} • {getCategoryInfo(selectedRestaurant.category).label}
              </span>
              <h3 className="font-bold text-sm text-foreground line-clamp-1">
                {selectedRestaurant.name}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRestaurant(null)}
              className="text-xs text-text-muted hover:text-foreground px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>

          {getRestaurantLocation(selectedRestaurant).isApproximate && (
            <p className="text-xs text-text-secondary">Vị trí ước lượng — mở Chỉ đường để xem địa chỉ</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <a
              href={getDirectionsUrl(selectedRestaurant)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-accent text-bg-primary font-bold text-xs hover:bg-accent-hover transition-colors shadow-sm"
            >
              <Navigation size={13} />
              Chỉ đường
            </a>
            <Link
              href={`/restaurant/${selectedRestaurant.id}`}
              className="inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl bg-secondary border border-border text-foreground text-xs font-semibold hover:bg-card-hover transition-colors"
            >
              Chi tiết
              <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      )}

      {/* Leaflet Map Target */}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
