'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';
import { MapPin, Loader2 } from 'lucide-react';

// Dynamic import for Leaflet (client-side only, no SSR)
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-card/60 backdrop-blur-sm">
      <Loader2 className="animate-spin text-accent mb-3" size={32} />
      <p className="text-sm font-medium text-text-secondary">Đang tải bản đồ quán ăn...</p>
    </div>
  ),
});

export default function MapPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    async function loadRestaurants() {
      setLoading(true); setError(false);
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (data) {
          setRestaurants(data as Restaurant[]);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    loadRestaurants();
  }, [attempt]);

  return (
    <div className="w-full h-[calc(100dvh-80px)] md:h-[calc(100dvh-72px)] flex flex-col relative isolate overflow-hidden bg-bg-primary">
      {/* Top micro bar for map context */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-card/80 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-accent" />
          <h1 className="text-sm font-bold text-foreground tracking-tight">
            Bản đồ ẩm thực Hà Nội
          </h1>
          <span className="text-xs text-text-muted bg-secondary px-2 py-0.5 rounded-full">
            {restaurants.length} quán
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            Ngon
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span>
            Ổn
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
            Né
          </span>
        </div>
      </div>

      {/* Full screen Map Canvas */}
      <div className="flex-1 w-full relative">
        {error ? <div className="p-6 text-center space-y-3"><p role="alert">Chưa tải được dữ liệu bản đồ. Kiểm tra kết nối rồi thử lại.</p><button onClick={() => setAttempt(n => n + 1)} className="rounded-xl border border-border p-3">Thử lại</button></div> : loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-bg-primary">
            <Loader2 className="animate-spin text-accent mb-2" size={28} />
            <p className="text-xs text-text-secondary">Đang kết nối dữ liệu...</p>
          </div>
        ) : (
          <MapComponent restaurants={restaurants} />
        )}
      </div>
    </div>
  );
}
