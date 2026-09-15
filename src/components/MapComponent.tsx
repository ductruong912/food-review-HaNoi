'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Restaurant } from '@/lib/types';
import {
  getRestaurantCoordinates,
  calculateDistance,
  getDirectionsUrl,
  HANOI_CENTER,
  DISTRICT_CENTERS,
} from '@/lib/geo';
import {
  Navigation,
  Locate,
  MapPin,
  Star,
  ExternalLink,
  ChevronRight,
  Filter,
  Layers,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface MapComponentProps {
  restaurants: Restaurant[];
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
      const coords = getRestaurantCoordinates(restaurant);

      // Icon colors based on rating
      let pinBg = 'bg-emerald-500';
      let pinBorder = 'border-emerald-300';
      let pinEmoji = '⭐';

      if (restaurant.rating === 'ngon') {
        pinBg = 'bg-emerald-500';
        pinBorder = 'border-emerald-200 ring-4 ring-emerald-500/20';
        pinEmoji = '🔥';
      } else if (restaurant.rating === 'khong_ngon') {
        pinBg = 'bg-rose-500';
        pinBorder = 'border-rose-200 ring-4 ring-rose-500/20';
        pinEmoji = '⚠️';
      } else {
        pinBg = 'bg-teal-500';
        pinBorder = 'border-teal-200 ring-4 ring-teal-500/20';
        pinEmoji = '👌';
      }

      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div class="relative group cursor-pointer">
            <div class="w-8 h-8 rounded-full ${pinBg} ${pinBorder} border-2 shadow-lg flex items-center justify-center text-xs font-bold transform transition-transform hover:scale-125">
              <span>${pinEmoji}</span>
            </div>
            <div class="w-2 h-2 bg-white rotate-45 mx-auto -mt-1 shadow-sm"></div>
          </div>
        `,
        iconSize: [32, 36],
        iconAnchor: [16, 36],
        popupAnchor: [0, -36],
      });

      // Calculate distance if user location is available
      let distanceText = '';
      if (userLocation) {
        const dist = calculateDistance(
          userLocation[0],
          userLocation[1],
          coords[0],
          coords[1]
        );
        distanceText = `📍 Cách bạn ${dist} km`;
      }

      const directionsUrl = getDirectionsUrl(restaurant);
      const ratingLabel =
        restaurant.rating === 'ngon'
          ? 'Ngon tuyệt'
          : restaurant.rating === 'khong_ngon'
          ? 'Không hợp vị'
          : 'Khá ổn';

      const popupHtml = `
        <div class="p-1 max-w-[240px] text-[#E4EDE8] font-sans">
          ${
            restaurant.image_url
              ? `<img src="${restaurant.image_url}" alt="${restaurant.name}" class="w-full h-24 object-cover rounded-lg mb-2 border border-[#264038]" />`
              : ''
          }
          <div class="flex items-center gap-1.5 mb-1">
            <span class="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
              restaurant.rating === 'ngon'
                ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-600/40'
                : restaurant.rating === 'khong_ngon'
                ? 'bg-rose-900/60 text-rose-300 border border-rose-600/40'
                : 'bg-teal-900/60 text-teal-300 border border-teal-600/40'
            }">${ratingLabel}</span>
            <span class="text-[10px] text-[#96ADA2]">• ${restaurant.district}</span>
          </div>
          <h4 class="font-bold text-sm text-white leading-tight mb-1">${restaurant.name}</h4>
          <p class="text-[11px] text-[#96ADA2] line-clamp-2 mb-1.5">${restaurant.address || 'Hà Nội'}</p>

          ${
            distanceText
              ? `<p class="text-[11px] font-semibold text-accent mb-2">${distanceText}</p>`
              : ''
          }
          <div class="flex items-center gap-2 pt-1 border-t border-[#264038]">
            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" class="flex-1 text-center py-1.5 px-2 rounded-lg bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition-colors">
              Chỉ đường
            </a>
            <a data-navigate="/restaurant/${restaurant.id}" href="#" class="flex-1 text-center py-1.5 px-2 rounded-lg bg-[#16302A] text-white border border-[#264038] font-medium text-xs hover:bg-[#1D3D34] transition-colors cursor-pointer">
              Chi tiết
            </a>
          </div>
        </div>
      `;

      const marker = L.marker(coords, { icon: customIcon }).addTo(markersLayer);
      marker.bindPopup(popupHtml, {
        className: 'custom-leaflet-popup',
        maxWidth: 260,
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

        // Add or move user marker
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([lat, lng]);
        } else {
          const userIcon = L.divIcon({
            className: 'user-location-pin',
            html: `
              <div class="relative flex items-center justify-center">
                <div class="w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
                  <div class="w-2 h-2 rounded-full bg-white"></div>
                </div>
                <div class="absolute -inset-2 rounded-full bg-blue-500/30 animate-ping"></div>
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
                  : 'bg-[#16302A]/90 text-text-secondary border border-border/80 hover:text-white'
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
          className="w-12 h-12 rounded-full bg-card/95 backdrop-blur-md border border-border/80 shadow-xl flex items-center justify-center text-white hover:text-accent hover:border-accent active:scale-95 transition-all cursor-pointer"
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
                      : 'text-text-secondary hover:bg-secondary/60 hover:text-white'
                  }`}
                >
                  <div>
                    <div className="font-medium text-white">{item.name}</div>
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
        className="absolute bottom-20 right-4 z-[1000] w-12 h-12 rounded-full bg-card/95 backdrop-blur-md border border-border/80 shadow-xl flex items-center justify-center text-white hover:text-accent hover:border-accent active:scale-95 transition-all cursor-pointer disabled:opacity-50"
      >
        <Locate size={22} className={locating ? 'animate-spin text-accent' : ''} />
      </button>

      {/* Selected Restaurant Quick Card at Bottom (Mobile view) */}
      {selectedRestaurant && (
        <div className="absolute bottom-4 left-4 right-18 md:right-auto md:w-80 z-[1000] bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl p-3 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div>
              <span className="text-[10px] uppercase font-bold text-accent">
                {selectedRestaurant.district} • {selectedRestaurant.category}
              </span>
              <h3 className="font-bold text-sm text-white line-clamp-1">
                {selectedRestaurant.name}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRestaurant(null)}
              className="text-xs text-text-muted hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>

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
              className="inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-xl bg-secondary border border-border text-white text-xs font-semibold hover:bg-card-hover transition-colors"
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
