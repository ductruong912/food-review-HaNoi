'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Restaurant } from '@/lib/types';
import { getRestaurantLocation, getDirectionsUrl, calculateDistance, HANOI_CENTER } from '@/lib/geo';
import { Navigation, Locate, Layers, Check, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getCategoryInfo, getRatingInfo } from '@/lib/utils';
import { rememberRestaurantReturn } from '@/lib/restaurantNavigation';
import { formatRestaurantPrice } from '@/lib/prices';

interface MapComponentProps {
  restaurants: Restaurant[];
}

export type MapStyleKey = 'google-streets' | 'google-hybrid';

export const MAP_STYLES: Record<MapStyleKey, { name: string; description: string; url: string; subdomains: string[]; maxZoom: number; attribution: string }> = {
  'google-streets': {
    name: 'Google Maps', description: 'Bản đồ đường sá chi tiết',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', subdomains: ['0', '1', '2', '3'], maxZoom: 20, attribution: '&copy; Google Maps',
  },
  'google-hybrid': {
    name: 'Vệ tinh Google', description: 'Ảnh vệ tinh kèm tên đường',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', subdomains: ['0', '1', '2', '3'], maxZoom: 20, attribution: '&copy; Google Maps',
  },
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
}

function enableKeyboardActivation(marker: L.Marker, onActivate: () => void) {
  marker.on('click', onActivate);
  const element = marker.getElement();
  if (!element) return;
  element.setAttribute('role', 'button');
  element.tabIndex = 0;
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    marker.fire('click');
  });
}

export default function MapComponent({ restaurants }: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [clusterRestaurants, setClusterRestaurants] = useState<Restaurant[]>([]);
  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>('google-streets');
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [mapRevision, setMapRevision] = useState(0);
  const [tileError, setTileError] = useState(false);
  const [tileRetry, setTileRetry] = useState(0);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, { center: HANOI_CENTER, zoom: 13, zoomControl: false });
    L.control.zoom({ position: 'topleft' }).addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    const updateRevision = () => setMapRevision((revision) => revision + 1);
    map.on('zoomend moveend', updateRevision);
    const timer = window.setTimeout(() => map.invalidateSize(), 200);
    return () => {
      window.clearTimeout(timer);
      map.off('zoomend moveend', updateRevision);
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const style = MAP_STYLES[currentStyle];
    const layer = L.tileLayer(style.url, { subdomains: style.subdomains, maxZoom: style.maxZoom, attribution: style.attribution });
    const onTileError = () => setTileError(true);
    const onTileLoad = () => setTileError(false);
    setTileError(false);
    layer.on('tileerror', onTileError);
    layer.on('tileload', onTileLoad);
    layer.addTo(map);
    layer.bringToBack();
    tileLayerRef.current = layer;
    return () => {
      layer.off('tileerror', onTileError);
      layer.off('tileload', onTileLoad);
      if (map.hasLayer(layer)) map.removeLayer(layer);
      if (tileLayerRef.current === layer) tileLayerRef.current = null;
    };
  }, [currentStyle, tileRetry]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const located = restaurants.map((restaurant) => ({ restaurant, ...getRestaurantLocation(restaurant) }));
    const clusters: typeof located[] = [];
    located.forEach((place) => {
      const point = map.latLngToContainerPoint(place.coordinates);
      const match = clusters.find((cluster) => {
        const anchor = map.latLngToContainerPoint(cluster[0].coordinates);
        return point.distanceTo(anchor) < 44;
      });
      if (match) match.push(place);
      else clusters.push([place]);
    });

    clusters.forEach((cluster) => {
      if (cluster.length > 1) {
        const lat = cluster.reduce((sum, item) => sum + item.coordinates[0], 0) / cluster.length;
        const lng = cluster.reduce((sum, item) => sum + item.coordinates[1], 0) / cluster.length;
        const icon = L.divIcon({
          className: 'restaurant-cluster-icon',
          html: `<span aria-hidden="true">${cluster.length}</span>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });
        const marker = L.marker([lat, lng], { icon, keyboard: true, title: `${cluster.length} quán gần nhau` }).addTo(layer);
        marker.getElement()?.setAttribute('aria-label', `${cluster.length} quán gần nhau. Mở danh sách.`);
        enableKeyboardActivation(marker, () => {
          setClusterRestaurants(cluster.map(({ restaurant }) => restaurant));
          setSelectedRestaurant(cluster[0].restaurant);
        });
        return;
      }

      const { restaurant, coordinates, isApproximate } = cluster[0];
      const escapedName = escapeHtml(restaurant.name);
      const escapedImage = escapeHtml(restaurant.image_url || '');
      const photo = restaurant.image_url
        ? `<img src="${escapedImage}" alt="" class="h-full w-full object-cover" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"/><span class="hidden h-full w-full place-items-center bg-secondary text-accent">🍜</span>`
        : '<span class="grid h-full w-full place-items-center bg-secondary text-accent">🍜</span>';
      const ring = isApproximate ? 'border:2px dashed #657d71' : 'border:2px solid var(--accent-primary)';
      const markerIcon = L.divIcon({
        className: 'restaurant-marker-icon',
        html: `<span class="relative block h-11 w-11 rounded-full bg-card p-0.5 shadow-lg" style="${ring}"><span class="block h-full w-full overflow-hidden rounded-full">${photo}</span><span class="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-card bg-accent text-[10px] font-bold text-[var(--btn-primary-text)]">${isApproximate ? '?' : '✓'}</span></span>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });
      const marker = L.marker(coordinates, { icon: markerIcon, keyboard: true, title: restaurant.name }).addTo(layer);
      marker.getElement()?.setAttribute('aria-label', `${escapedName}, vị trí ${isApproximate ? 'ước lượng' : 'chính xác'}. Mở thông tin.`);
      enableKeyboardActivation(marker, () => {
        setClusterRestaurants([]);
        setSelectedRestaurant(restaurant);
      });
    });
  }, [restaurants, mapRevision]);

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setLocating(false);
      const location: [number, number] = [position.coords.latitude, position.coords.longitude];
      setUserLocation(location);
      const map = mapInstanceRef.current;
      if (!map) return;
      if (userMarkerRef.current) userMarkerRef.current.setLatLng(location);
      else {
        const icon = L.divIcon({ className: 'user-location-pin', html: '<span class="block h-5 w-5 rounded-full border-2 border-white bg-accent shadow-lg"></span>', iconSize: [24, 24], iconAnchor: [12, 12] });
        userMarkerRef.current = L.marker(location, { icon, keyboard: false, title: 'Vị trí của tôi' }).addTo(map);
      }
      map.flyTo(location, 15, { duration: 0.6 });
    }, (error) => {
      setLocating(false);
      console.error(error);
      alert('Không thể lấy vị trí. Vui lòng cho phép quyền truy cập vị trí trên trình duyệt.');
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  const isApproximate = selectedRestaurant ? getRestaurantLocation(selectedRestaurant).isApproximate : false;

  return (
    <div className="relative h-full min-h-[26rem] w-full">
      <div className="absolute right-3 top-3 z-[1000]">
        <button type="button" onClick={() => setShowStyleMenu((open) => !open)} aria-label="Chuyển chế độ bản đồ" title="Chuyển chế độ bản đồ" className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card/95 text-foreground shadow-lg hover:text-accent"><Layers size={20} /></button>
        {showStyleMenu && <div className="absolute right-12 top-0 w-56 rounded-2xl border border-border bg-card p-2 shadow-xl">
          <p className="px-2 py-1 text-xs font-bold text-text-muted">Kiểu bản đồ</p>
          {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => {
            const item = MAP_STYLES[key];
            const active = currentStyle === key;
            return <button key={key} type="button" aria-pressed={active} onClick={() => { setCurrentStyle(key); setShowStyleMenu(false); }} className={`flex min-h-11 w-full items-center justify-between rounded-xl px-2 text-left text-xs ${active ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-secondary'}`}><span><strong className="block text-foreground">{item.name}</strong>{item.description}</span>{active && <Check size={15} />}</button>;
          })}
        </div>}
      </div>

      <button type="button" onClick={handleLocateUser} disabled={locating} aria-label="Vị trí của tôi" title="Vị trí của tôi" className="absolute right-3 top-16 z-[1000] flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card/95 text-foreground shadow-lg hover:text-accent disabled:opacity-50"><Locate size={20} className={locating ? 'animate-spin text-accent' : ''} /></button>

      {tileError && <div role="alert" className="absolute left-16 right-16 top-3 z-[1100] mx-auto flex min-h-12 max-w-lg items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-3 py-2 text-xs text-foreground shadow-lg backdrop-blur">
        <span className="min-w-0">Không tải được nền bản đồ. Vị trí ghim vẫn hiển thị.</span>
        <button type="button" onClick={() => setTileRetry((value) => value + 1)} className="min-h-11 shrink-0 rounded-lg px-3 font-semibold text-accent hover:bg-secondary">Tải lại</button>
      </div>}

      {selectedRestaurant && <section aria-label="Thông tin quán trên bản đồ" className="absolute bottom-3 left-3 right-3 z-[1000] max-h-[48%] overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-2xl md:bottom-4 md:left-auto md:right-4 md:w-96 md:max-h-[70%]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {clusterRestaurants.length > 1 && <p className="mb-1 text-xs font-semibold text-accent">{clusterRestaurants.length} quán gần nhau</p>}
            <p className="text-xs text-text-secondary">{getCategoryInfo(selectedRestaurant.category).label} · {getRatingInfo(selectedRestaurant.rating).label}</p>
            <h2 className="mt-0.5 line-clamp-2 text-base font-bold text-foreground">{selectedRestaurant.name}</h2>
          </div>
          <button type="button" aria-label="Đóng thông tin quán" onClick={() => { setSelectedRestaurant(null); setClusterRestaurants([]); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-secondary"><X size={18} /></button>
        </div>

        {clusterRestaurants.length > 1 && <div className="mb-3 flex max-h-24 flex-col gap-1 overflow-y-auto">
          {clusterRestaurants.map((restaurant) => <button key={restaurant.id} type="button" aria-pressed={restaurant.id === selectedRestaurant.id} onClick={() => setSelectedRestaurant(restaurant)} className={`min-h-11 rounded-lg px-3 text-left text-sm ${restaurant.id === selectedRestaurant.id ? 'bg-accent/10 font-semibold text-accent' : 'text-text-secondary hover:bg-secondary'}`}>{restaurant.name} · {restaurant.district || 'Hà Nội'}</button>)}
        </div>}

        <p className="text-sm text-text-secondary">{selectedRestaurant.district || 'Hà Nội'} · {formatRestaurantPrice(selectedRestaurant)}</p>
        <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{selectedRestaurant.address || 'Chưa có địa chỉ chi tiết.'}</p>
        <p className={`mt-2 text-xs ${isApproximate ? 'text-text-muted' : 'text-accent'}`}>{isApproximate ? 'Vị trí ước lượng từ dữ liệu hiện có' : 'Vị trí chính xác đã được người đóng góp xác nhận'}</p>
        {userLocation && !isApproximate && <p className="mt-1 text-xs text-text-secondary">Cách bạn khoảng {calculateDistance(userLocation[0], userLocation[1], getRestaurantLocation(selectedRestaurant).coordinates[0], getRestaurantLocation(selectedRestaurant).coordinates[1])} km (đường thẳng)</p>}
        <div className="mt-3 flex gap-2">
          <a href={getDirectionsUrl(selectedRestaurant)} target="_blank" rel="noopener noreferrer" className="btn-primary min-w-0 flex-1"><Navigation size={15} />Chỉ đường</a>
          <Link href={`/restaurant/${selectedRestaurant.id}`} onClick={() => rememberRestaurantReturn(selectedRestaurant.id)} className="btn-secondary min-w-0 flex-1">Chi tiết<ChevronRight size={15} /></Link>
        </div>
      </section>}

      <div ref={mapContainerRef} className="absolute inset-0" />
    </div>
  );
}
