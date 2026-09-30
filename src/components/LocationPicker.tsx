'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, MapPin } from 'lucide-react';
import { HANOI_CENTER, extractCoordsFromMapUrl } from '@/lib/geo';

export interface RestaurantLocationValue {
  latitude: number | null;
  longitude: number | null;
  location_accuracy: 'exact' | 'approximate';
}

interface LocationPickerProps {
  value: RestaurantLocationValue;
  mapUrl: string;
  onChange: (value: RestaurantLocationValue) => void;
}

const pinIcon = L.divIcon({
  className: 'restaurant-pin-picker',
  html: '<span class="block h-5 w-5 rounded-full border-[3px] border-white bg-accent shadow-lg"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export default function LocationPicker({ value, mapUrl, onChange }: LocationPickerProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const initialLocationRef = useRef({
    latitude: value.latitude,
    longitude: value.longitude,
    mapUrl,
  });
  const [pending, setPending] = useState<[number, number]>([value.latitude ?? HANOI_CENTER[0], value.longitude ?? HANOI_CENTER[1]]);
  const [pinChanged, setPinChanged] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [tileRetry, setTileRetry] = useState(0);

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    const { latitude, longitude, mapUrl: initialMapUrl } = initialLocationRef.current;
    const stored = latitude !== null && longitude !== null
      ? [latitude, longitude] as [number, number]
      : null;
    const linked = extractCoordsFromMapUrl(initialMapUrl);
    const initial = stored ?? linked ?? HANOI_CENTER;
    setPending(initial);
    const map = L.map(mapElement.current, { scrollWheelZoom: false }).setView(initial, stored || linked ? 16 : 12);
    const marker = L.marker(initial, { draggable: true, icon: pinIcon }).addTo(map);
    marker.on('dragend', () => {
      const point = marker.getLatLng();
      setPending([point.lat, point.lng]);
      setPinChanged(true);
    });
    map.on('click', (event: L.LeafletMouseEvent) => {
      marker.setLatLng(event.latlng);
      setPending([event.latlng.lat, event.latlng.lng]);
      setPinChanged(true);
    });
    mapRef.current = map;
    markerRef.current = marker;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap', maxZoom: 19,
    });
    const onTileError = () => setTileError(true);
    const onTileLoad = () => setTileError(false);
    setTileError(false);
    layer.on('tileerror', onTileError);
    layer.on('tileload', onTileLoad);
    layer.addTo(map);
    tileLayerRef.current = layer;
    return () => {
      layer.off('tileerror', onTileError);
      layer.off('tileload', onTileLoad);
      if (map.hasLayer(layer)) map.removeLayer(layer);
      if (tileLayerRef.current === layer) tileLayerRef.current = null;
    };
  }, [tileRetry]);

  useEffect(() => {
    if (value.latitude === null || value.longitude === null) return;
    const next: [number, number] = [value.latitude, value.longitude];
    setPending(next);
    markerRef.current?.setLatLng(next);
    mapRef.current?.setView(next, Math.max(mapRef.current.getZoom(), 16));
    setPinChanged(false);
  }, [value.latitude, value.longitude]);

  useEffect(() => {
    if (value.latitude !== null && value.longitude !== null) return;
    const linked = extractCoordsFromMapUrl(mapUrl);
    if (!linked) return;
    setPending(linked);
    markerRef.current?.setLatLng(linked);
    mapRef.current?.setView(linked, 16);
    setPinChanged(true);
  }, [mapUrl, value.latitude, value.longitude]);

  const updateCoordinate = (index: 0 | 1, rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    const next: [number, number] = [...pending];
    next[index] = parsed;
    setPending(next);
    markerRef.current?.setLatLng(next);
    mapRef.current?.panTo(next);
    setPinChanged(true);
  };

  const confirmPin = () => {
    onChange({ latitude: pending[0], longitude: pending[1], location_accuracy: value.location_accuracy });
    setPinChanged(false);
  };

  return <section className="space-y-3 rounded-xl border border-border bg-background p-3" aria-labelledby="location-picker-title">
    <div className="flex items-start gap-2">
      <MapPin size={17} className="mt-0.5 shrink-0 text-accent" />
      <div><h3 id="location-picker-title" className="text-sm font-semibold">Ghim vị trí quán</h3><p className="mt-1 text-xs text-text-secondary">Kéo ghim hoặc chạm bản đồ, rồi xác nhận để lưu tọa độ. Ghim cũ và liên kết bản đồ vẫn được xem là ước lượng.</p></div>
    </div>
    <div ref={mapElement} className="h-56 overflow-hidden rounded-lg border border-border" aria-label="Bản đồ chọn vị trí quán" />
    {tileError && <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2 text-xs text-foreground">
      <span>Không tải được nền bản đồ. Bạn vẫn có thể nhập tọa độ.</span>
      <button type="button" onClick={() => setTileRetry((retry) => retry + 1)} className="min-h-11 shrink-0 rounded-lg px-2 font-semibold text-accent hover:bg-secondary">Tải lại</button>
    </div>}
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs font-medium text-text-secondary">Vĩ độ
        <input type="number" min="-90" max="90" step="0.000001" value={pending[0].toFixed(6)} onChange={(event) => updateCoordinate(0, event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground" />
      </label>
      <label className="text-xs font-medium text-text-secondary">Kinh độ
        <input type="number" min="-180" max="180" step="0.000001" value={pending[1].toFixed(6)} onChange={(event) => updateCoordinate(1, event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground" />
      </label>
    </div>
    <label className="block text-xs font-medium text-text-secondary">Độ chính xác
      <select value={value.location_accuracy} onChange={(event) => onChange({ ...value, location_accuracy: event.target.value as RestaurantLocationValue['location_accuracy'] })} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground">
        <option value="approximate">Ước lượng</option>
        <option value="exact">Chính xác</option>
      </select>
    </label>
    <button type="button" onClick={confirmPin} className="btn-secondary min-h-11 w-full"><Check size={16} />{value.latitude === null ? 'Xác nhận ghim và lưu tọa độ' : 'Xác nhận ghim đã chọn'}</button>
    <p role="status" className="text-xs text-text-secondary">{pinChanged ? 'Ghim trên bản đồ chưa được lưu. Hãy xác nhận để cập nhật.' : value.latitude === null ? 'Chưa lưu tọa độ quán.' : value.location_accuracy === 'exact' ? 'Đã xác nhận vị trí chính xác.' : 'Đã lưu vị trí ước lượng.'}</p>
  </section>;
}
