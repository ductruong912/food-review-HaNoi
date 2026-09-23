'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, DISTRICTS, OCCASIONS, RATING_OPTIONS, type OccasionSlug, type Restaurant, type RatingLabel } from '@/lib/types';
import type { AppUser } from './AuthProvider';
import ImageUpload from './ImageUpload';

export default function RestaurantForm({ user, restaurant }: { user: AppUser; restaurant?: Restaurant }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: restaurant?.name ?? '', address: restaurant?.address ?? '', district: restaurant?.district ?? '',
    category: restaurant?.category ?? '', rating: restaurant?.rating ?? 'ngon' as RatingLabel,
    occasions: restaurant?.occasions ?? [] as OccasionSlug[],
    review: restaurant?.review ?? '', price: restaurant?.price ?? '', map_url: restaurant?.map_url ?? '',
    images: restaurant?.image_url ? [restaurant.image_url] : [] as string[],
  });
  const [baseline] = useState(() => JSON.stringify(form));
  const completed = useRef(false);
  const busy = useRef(false);
  const key = `food_hn_draft:${user.id}:${restaurant?.id ?? 'new'}`;
  const [ready, setReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(form) !== baseline;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object' && typeof saved.name === 'string' &&
            ['address', 'district', 'category', 'rating', 'review', 'price', 'map_url'].every(k => typeof saved[k] === 'string') &&
            Array.isArray(saved.images) && saved.images.every((image: unknown) => typeof image === 'string')) {
          setForm((current) => ({ ...current, ...saved, occasions: Array.isArray(saved.occasions) ? saved.occasions.filter((occasion: unknown): occasion is OccasionSlug => OCCASIONS.some((item) => item.slug === occasion)) : [] }));
          setDraftStatus('Đã khôi phục bản nháp trên thiết bị này.');
        }
      }
    } catch { setDraftStatus('Không thể đọc bản nháp trên thiết bị này.'); }
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready || completed.current) return;
    try {
      if (!dirty) { localStorage.removeItem(key); setDraftStatus(''); return; }
      localStorage.setItem(key, JSON.stringify(form));
      setDraftStatus('Bản nháp được lưu trên thiết bị này.');
    } catch { setDraftStatus('Không lưu được bản nháp. Hãy giữ trang mở đến khi đăng xong.'); }
  }, [form, dirty, key, ready]);

  useEffect(() => {
    if (!dirty && !uploading) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (completed.current) return;
      event.preventDefault(); event.returnValue = '';
    };
    const leave = (event: MouseEvent) => {
      const link = (event.target as Element).closest('a[href]');
      if (!link || completed.current || link.getAttribute('target') === '_blank') return;
      if (!window.confirm(uploading ? 'Ảnh đang tải. Bạn vẫn muốn rời trang?' : 'Bài viết chưa đăng. Bạn muốn rời trang? Bản nháp đã lưu sẽ được giữ lại.')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', leave, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', leave, true); };
  }, [dirty, uploading]);

  const finish = (href: string) => {
    completed.current = true;
    try { localStorage.removeItem(key); } catch { /* The saved post is still safe. */ }
    router.push(href); router.refresh();
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current || uploading) return;
    if (!form.name.trim() || !CATEGORIES.some(c => c.slug === form.category)) {
      setError('Nhập tên quán và chọn loại quán trước khi lưu.'); return;
    }
    if (form.map_url.trim() && !/^https?:\/\//i.test(form.map_url.trim())) {
      setError('Link bản đồ cần bắt đầu bằng https:// hoặc http://.'); return;
    }
    busy.current = true; setSubmitting(true); setError('');
    try {
      const payload = {
        name: form.name.trim(), address: form.address.trim(), district: form.district, category: form.category, occasions: form.occasions,
        rating: form.rating, review: form.review.trim(), price: form.price.trim() || null,
        map_url: form.map_url.trim() || null, image_url: form.images[0] || '',
      };
      const result = restaurant
        ? await supabase.from('restaurants').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', restaurant.id).select('id').single()
        : await supabase.from('restaurants').insert({ ...payload, type: 'food', created_by: user.id, created_by_name: user.display_name }).select('id').single();
      if (result.error) throw result.error;
      toast.success(restaurant ? 'Đã cập nhật quán.' : 'Đã thêm quán mới.');
      finish(`/restaurant/${result.data.id}`);
    } catch {
      setError('Chưa lưu được quán. Kiểm tra kết nối và quyền đóng góp rồi thử lại; nội dung vẫn được giữ nguyên.');
    } finally { busy.current = false; setSubmitting(false); }
  };
  const remove = async () => {
    if (!restaurant || busy.current || uploading || !confirm(`Xóa vĩnh viễn quán “${restaurant.name}”?`)) return;
    busy.current = true; setSubmitting(true); setError('');
    try {
      const { error } = await supabase.from('restaurants').delete().eq('id', restaurant.id).select('id').single();
      if (error) throw error;
      toast.success('Đã xóa quán.'); finish('/');
    } catch { setError('Chưa xóa được quán. Kiểm tra kết nối và thử lại.'); }
    finally { busy.current = false; setSubmitting(false); }
  };
  const fieldClass = 'w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground';
  return <div className="mx-auto max-w-2xl px-4 py-6">
    <div className="mb-6 flex items-center gap-3">
      <Link aria-label="Quay lại" href={restaurant ? `/restaurant/${restaurant.id}` : '/'} className="p-3 rounded-xl border border-border"><ArrowLeft size={20} /></Link>
      <div><h1 className="font-editorial text-2xl font-semibold">{restaurant ? 'Chỉnh sửa quán' : 'Thêm quán mới'}</h1><p className="mt-1 text-sm text-text-secondary">Một địa chỉ ngon, một lời nhận xét thật.</p></div>
    </div>
    <form onSubmit={submit} className="space-y-5" aria-busy={submitting || uploading}>
      <fieldset disabled={submitting || !ready} className="space-y-5 disabled:opacity-70">
        <section className="glass-card p-5"><h2 className="mb-3 font-semibold">Ảnh quán</h2>
          <ImageUpload images={form.images} onChange={images => setForm(p => ({ ...p, images }))} maxImages={1} onUploadingChange={setUploading} disabled={submitting} />
        </section>
        <section className="glass-card p-5 space-y-4"><h2 className="font-semibold">Thông tin quán</h2>
          {([
            ['name', 'Tên quán', 'VD: Bún chả Hương Liên'], ['address', 'Địa chỉ', 'Số nhà, tên đường'],
            ['price', 'Giá tham khảo', 'VD: 40–60k / người'], ['map_url', 'Link Google Maps', 'https://maps.app.goo.gl/...'],
          ] as const).map(([key, label, placeholder]) => <div key={key}>
            <label className="block mb-2 text-sm font-medium" htmlFor={`restaurant-${key}`}>{label}{key === 'name' ? ' *' : ' (tùy chọn)'}</label>
            <input id={`restaurant-${key}`} type={key === 'map_url' ? 'url' : 'text'} required={key === 'name'} maxLength={key === 'map_url' ? 2048 : 250} placeholder={placeholder} className={fieldClass} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
          </div>)}
          <div><label htmlFor="restaurant-district" className="block text-sm mb-2 font-medium">Quận / huyện</label>
            <select id="restaurant-district" className={fieldClass} value={form.district} onChange={e => setForm(p => ({ ...p, district: e.target.value }))}><option value="">Chọn quận / huyện</option>{DISTRICTS.map(d => <option key={d}>{d}</option>)}</select>
          </div>
          <div><label htmlFor="restaurant-category" className="block text-sm mb-2 font-medium">Loại quán *</label>
            <select id="restaurant-category" required className={fieldClass} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}><option value="">Chọn loại quán</option>{CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}</select>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Phù hợp cho <span className="font-normal text-text-muted">(tùy chọn)</span></legend>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((occasion) => {
                const selected = form.occasions.includes(occasion.slug);
                return <label key={occasion.slug} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${selected ? 'border-accent bg-accent/10 text-foreground' : 'border-border text-text-secondary'}`}>
                  <input className="sr-only" type="checkbox" checked={selected} onChange={() => setForm((current) => ({ ...current, occasions: selected ? current.occasions.filter((item) => item !== occasion.slug) : [...current.occasions, occasion.slug] }))} />
                  {occasion.label}
                </label>;
              })}
            </div>
          </fieldset>
        </section>
        <section className="glass-card p-5 space-y-4">
          <fieldset><legend className="font-semibold mb-3">Cảm nhận của bạn</legend><div className="grid grid-cols-2 gap-2">{RATING_OPTIONS.map(r => <label key={r.value} className={`flex items-center gap-2 rounded-xl border p-3 text-sm cursor-pointer ${form.rating === r.value ? 'border-accent bg-accent/10' : 'border-border'}`}><input type="radio" name="rating" value={r.value} checked={form.rating === r.value} onChange={() => setForm(p => ({ ...p, rating: r.value }))} />{r.label}</label>)}</div></fieldset>
          <label htmlFor="restaurant-review" className="block text-sm font-medium">Nhận xét</label>
          <textarea id="restaurant-review" maxLength={10000} rows={5} className={fieldClass} placeholder="Món nào đáng thử? Có điều gì bạn muốn nhắn bạn bè?" value={form.review} onChange={e => setForm(p => ({ ...p, review: e.target.value }))} />
        </section>
      </fieldset>
      <p role="status" className="text-sm text-text-secondary">{uploading ? 'Đang tải ảnh, vui lòng giữ trang mở…' : draftStatus}</p>
      {error && <p role="alert" className="rounded-xl border border-accent-red/30 bg-accent-red/10 p-4 text-sm text-accent-red">{error}</p>}
      <button type="submit" disabled={submitting || uploading || !ready} className="gradient-warm flex min-h-12 w-full items-center justify-center gap-2 rounded-xl p-3 font-semibold disabled:opacity-50">{submitting || uploading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}{uploading ? 'Đang tải ảnh…' : submitting ? 'Đang lưu…' : restaurant ? 'Lưu thay đổi' : 'Thêm quán'}</button>
      {restaurant && <button type="button" disabled={submitting || uploading} onClick={remove} className="flex min-h-12 items-center gap-2 text-sm text-accent-red"><Trash2 size={16} />Xóa quán này</button>}
    </form>
  </div>;
}
