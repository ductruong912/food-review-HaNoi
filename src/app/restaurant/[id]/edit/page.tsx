'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import RestaurantForm from '@/components/RestaurantForm';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';

export default function EditRestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isAdmin, canContribute, loading: authLoading } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    (async () => {
      try {
        const { data, error } = await supabase.from('restaurants').select('*').eq('id', id).single();
        if (error || !data) throw error;
        if (active) setRestaurant(data);
      } catch { if (active) setError('Chưa tải được quán. Quán có thể đã bị xóa hoặc kết nối đang gián đoạn.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id, attempt]);
  if (loading || authLoading) return <p role="status" className="p-6 text-center">Đang tải thông tin quán…</p>;
  if (error) return <div className="p-6 text-center space-y-4"><p role="alert">{error}</p><button className="rounded-xl border border-border p-3" onClick={() => setAttempt(n => n + 1)}>Thử lại</button></div>;
  if (!restaurant || !user || !(isAdmin || (canContribute && user.id === restaurant.created_by))) return <div className="p-6 text-center space-y-4"><p>Bạn chưa có quyền sửa quán này. Hãy đăng nhập bằng tài khoản đã đăng quán hoặc liên hệ chủ nhóm.</p><Link href="/profile" className="text-accent">Kiểm tra tài khoản</Link></div>;
  return <RestaurantForm key={`${user.id}:${id}`} user={user} restaurant={restaurant} />;
}
