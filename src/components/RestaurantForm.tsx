'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, DISTRICTS, OCCASIONS, RATING_OPTIONS, type OccasionSlug, type Restaurant, type RatingLabel } from '@/lib/types';
import { getPriceFields, parsePriceText, type PriceUnit } from '@/lib/prices';
import type { AppUser } from './AuthProvider';
import ImageUpload from './ImageUpload';

const LocationPicker = dynamic(() => import('./LocationPicker'), { ssr: false });

type FieldName = 'name' | 'category' | 'map_url' | 'price_unit' | 'location';

export default function RestaurantForm({ user, restaurant }: { user: AppUser; restaurant?: Restaurant }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: restaurant?.name ?? '', address: restaurant?.address ?? '', district: restaurant?.district ?? '',
    category: restaurant?.category ?? '', rating: restaurant?.rating ?? 'chua_an' as RatingLabel,
    occasions: restaurant?.occasions ?? [] as OccasionSlug[],
    price_unit: restaurant?.price_unit ?? '' as PriceUnit | '',
    review: restaurant?.review ?? '', price: restaurant?.price ?? '', map_url: restaurant?.map_url ?? '',
    images: [...new Set([restaurant?.image_url, ...(restaurant?.image_urls ?? [])].filter((url): url is string => Boolean(url)))],
    coverImage: restaurant?.image_url || restaurant?.image_urls?.[0] || '',
    latitude: restaurant?.latitude ?? null,
    longitude: restaurant?.longitude ?? null,
    location_accuracy: restaurant?.location_accuracy ?? 'approximate' as 'exact' | 'approximate',
  });
  const initialForm = useRef(form);
  const [baseline] = useState(() => JSON.stringify(form));
  const completed = useRef(false);
  const busy = useRef(false);
  const key = `food_hn_draft:${user.id}:${restaurant?.id ?? 'new'}`;
  const [ready, setReady] = useState(false);
  const [draftCandidate, setDraftCandidate] = useState<typeof form | null>(null);
  const [draftStatus, setDraftStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const fieldRefs = useRef<Partial<Record<FieldName, HTMLElement | null>>>({});
  const dirty = JSON.stringify(form) !== baseline;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object' && typeof saved.name === 'string' &&
            ['address', 'district', 'category', 'rating', 'review', 'price', 'map_url'].every(k => typeof saved[k] === 'string') &&
            Array.isArray(saved.images) && saved.images.every((image: unknown) => typeof image === 'string')) {
          setDraftCandidate({ ...initialForm.current, ...saved,
            price_unit: saved.price_unit === 'vnd_per_person' || saved.price_unit === 'vnd_per_group' ? saved.price_unit : '',
            occasions: Array.isArray(saved.occasions) ? saved.occasions.filter((occasion: unknown): occasion is OccasionSlug => OCCASIONS.some((item) => item.slug === occasion)) : [],
            images: saved.images,
            coverImage: typeof saved.coverImage === 'string' && saved.images.includes(saved.coverImage) ? saved.coverImage : saved.images[0] || '',
            latitude: typeof saved.latitude === 'number' ? saved.latitude : initialForm.current.latitude,
            longitude: typeof saved.longitude === 'number' ? saved.longitude : initialForm.current.longitude,
            location_accuracy: saved.location_accuracy === 'exact' ? 'exact' : 'approximate',
          });
          setDraftStatus('Có bản nháp đã lưu trên thiết bị này.');
        } else {
          setReady(true);
        }
      } else {
        setReady(true);
      }
    } catch { setDraftStatus('Không thể đọc bản nháp trên thiết bị này.'); setReady(true); }
  }, [key]);

  const continueDraft = () => {
    if (draftCandidate) setForm(draftCandidate);
    setDraftCandidate(null);
    setDraftStatus('Đã tiếp tục bản nháp trên thiết bị này.');
    setReady(true);
  };

  const startFresh = () => {
    try { localStorage.removeItem(key); } catch { setDraftStatus('Không xóa được bản nháp cũ trên thiết bị này.'); }
    setDraftCandidate(null);
    setDraftStatus('Đã bắt đầu nội dung mới.');
    setReady(true);
  };

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
    const nextErrors: Partial<Record<FieldName, string>> = {};
    if (!form.name.trim()) nextErrors.name = 'Nhập tên quán.';
    if (!CATEGORIES.some((category) => category.slug === form.category)) nextErrors.category = 'Chọn loại quán.';
    if (form.map_url.trim() && !/^https?:\/\//i.test(form.map_url.trim())) nextErrors.map_url = 'Link cần bắt đầu bằng https:// hoặc http://.';
    const parsedPrice = parsePriceText(form.price);
    if ((form.latitude === null) !== (form.longitude === null)) nextErrors.location = 'Cần có đủ cả vĩ độ và kinh độ.';
    if ((form.latitude !== null && (form.latitude < -90 || form.latitude > 90)) || (form.longitude !== null && (form.longitude < -180 || form.longitude > 180))) {
      nextErrors.location = 'Tọa độ nằm ngoài giới hạn hợp lệ.';
    }
    if (form.location_accuracy === 'exact' && (form.latitude === null || form.longitude === null)) {
      nextErrors.location = 'Hãy xác nhận ghim có đủ tọa độ trước khi chọn vị trí chính xác.';
    }
    if (parsedPrice?.unit && form.price_unit && parsedPrice.unit !== form.price_unit) {
      nextErrors.price_unit = 'Đơn vị không khớp với ghi chú giá.';
    }
    setFieldErrors(nextErrors);
    const firstInvalid = (['name', 'category', 'map_url', 'price_unit', 'location'] as FieldName[]).find((field) => nextErrors[field]);
    if (firstInvalid) {
      setError('Kiểm tra các trường được đánh dấu rồi thử lại.');
      requestAnimationFrame(() => fieldRefs.current[firstInvalid]?.focus());
      return;
    }
    busy.current = true; setSubmitting(true); setError('');
    try {
      const payload = {
        name: form.name.trim(), address: form.address.trim(), district: form.district, category: form.category, occasions: form.occasions,
        rating: form.rating, review: form.review.trim(), price: form.price.trim() || null,
        ...getPriceFields(form.price, form.price_unit || null),
        map_url: form.map_url.trim() || null,
        image_url: form.coverImage && form.images.includes(form.coverImage) ? form.coverImage : form.images[0] || '',
        image_urls: form.images,
        latitude: form.latitude,
        longitude: form.longitude,
        location_accuracy: form.location_accuracy,
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
    {draftCandidate && <section className="state-panel mb-5 text-left" aria-labelledby="draft-choice-title">
      <h2 id="draft-choice-title" className="text-base font-semibold text-foreground">Tìm thấy bản nháp trên thiết bị này</h2>
      <p className="mt-1 text-sm text-text-secondary">Bạn muốn tiếp tục nội dung đã lưu hay bắt đầu bài mới?</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={continueDraft} className="btn-primary">Tiếp tục bản nháp</button>
        <button type="button" onClick={startFresh} className="btn-secondary">Bắt đầu mới</button>
      </div>
    </section>}
    <form onSubmit={submit} className="space-y-5" aria-busy={submitting || uploading}>
      <fieldset disabled={submitting || !ready} className="space-y-5 disabled:opacity-70">
        <section className="glass-card space-y-4 p-5">
          <div><h2 className="font-semibold text-foreground">Thông tin cần thiết</h2><p className="mt-1 text-xs text-text-secondary">Nhập tên quán và loại quán trước; các mục còn lại có thể bổ sung sau.</p></div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="restaurant-name">Tên quán <span aria-hidden="true">*</span></label>
            <input ref={(element) => { fieldRefs.current.name = element; }} id="restaurant-name" type="text" aria-required="true" aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? 'restaurant-name-error' : undefined} maxLength={250} placeholder="VD: Bún chả Hương Liên" className={`${fieldClass} ${fieldErrors.name ? 'border-accent-red' : ''}`} value={form.name} onChange={(event) => { setForm((current) => ({ ...current, name: event.target.value })); setFieldErrors((current) => ({ ...current, name: undefined })); }} />
            {fieldErrors.name && <p id="restaurant-name-error" className="mt-1 text-sm text-accent-red">{fieldErrors.name}</p>}
          </div>
          <div>
            <label htmlFor="restaurant-district" className="mb-2 block text-sm font-medium">Quận / huyện <span className="font-normal text-text-muted">(tùy chọn)</span></label>
            <select id="restaurant-district" className={fieldClass} value={form.district} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))}><option value="">Chọn quận / huyện</option>{DISTRICTS.map((district) => <option key={district}>{district}</option>)}</select>
          </div>
          <div>
            <label htmlFor="restaurant-address" className="mb-2 block text-sm font-medium">Địa chỉ <span className="font-normal text-text-muted">(tùy chọn)</span></label>
            <input id="restaurant-address" type="text" maxLength={250} placeholder="Số nhà, tên đường" className={fieldClass} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="restaurant-category" className="mb-2 block text-sm font-medium">Loại quán <span aria-hidden="true">*</span></label>
            <select ref={(element) => { fieldRefs.current.category = element; }} id="restaurant-category" aria-required="true" aria-invalid={!!fieldErrors.category} aria-describedby={fieldErrors.category ? 'restaurant-category-error' : undefined} className={`${fieldClass} ${fieldErrors.category ? 'border-accent-red' : ''}`} value={form.category} onChange={(event) => { setForm((current) => ({ ...current, category: event.target.value })); setFieldErrors((current) => ({ ...current, category: undefined })); }}><option value="">Chọn loại quán</option>{CATEGORIES.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select>
            {fieldErrors.category && <p id="restaurant-category-error" className="mt-1 text-sm text-accent-red">{fieldErrors.category}</p>}
          </div>
        </section>

        <section className="glass-card space-y-4 p-5">
          <h2 className="font-semibold text-foreground">Thông tin thêm <span className="font-normal text-text-muted">(tùy chọn)</span></h2>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="restaurant-price">Giá tham khảo</label>
            <input id="restaurant-price" type="text" maxLength={100} placeholder="VD: 40–60k hoặc 50.000đ/người" className={fieldClass} value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
          </div>
          <div>
            <label htmlFor="restaurant-price-unit" className="mb-2 block text-sm font-medium">Đơn vị giá</label>
            <select ref={(element) => { fieldRefs.current.price_unit = element; }} id="restaurant-price-unit" aria-invalid={!!fieldErrors.price_unit} aria-describedby={fieldErrors.price_unit ? 'restaurant-price-unit-error' : 'restaurant-price-unit-help'} value={form.price_unit} onChange={(event) => { setForm((current) => ({ ...current, price_unit: event.target.value as PriceUnit | '' })); setFieldErrors((current) => ({ ...current, price_unit: undefined })); }} className={`${fieldClass} ${fieldErrors.price_unit ? 'border-accent-red' : ''}`}>
              <option value="">Chưa rõ đơn vị</option><option value="vnd_per_person">Theo người</option><option value="vnd_per_group">Theo nhóm</option>
            </select>
            <p id="restaurant-price-unit-help" className="mt-1 text-xs text-text-muted">Chỉ giá ghi rõ theo người mới được so với ngân sách mỗi người.</p>
            {fieldErrors.price_unit && <p id="restaurant-price-unit-error" className="mt-1 text-sm text-accent-red">{fieldErrors.price_unit}</p>}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="restaurant-map_url">Liên kết bản đồ</label>
            <input ref={(element) => { fieldRefs.current.map_url = element; }} id="restaurant-map_url" type="text" aria-invalid={!!fieldErrors.map_url} aria-describedby={fieldErrors.map_url ? 'restaurant-map_url-error' : undefined} maxLength={2048} placeholder="https://maps.google.com/..." className={`${fieldClass} ${fieldErrors.map_url ? 'border-accent-red' : ''}`} value={form.map_url} onChange={(event) => { setForm((current) => ({ ...current, map_url: event.target.value })); setFieldErrors((current) => ({ ...current, map_url: undefined })); }} />
            {fieldErrors.map_url && <p id="restaurant-map_url-error" className="mt-1 text-sm text-accent-red">{fieldErrors.map_url}</p>}
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Phù hợp cho <span className="font-normal text-text-muted">(tùy chọn)</span></legend>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((occasion) => {
                const selected = form.occasions.includes(occasion.slug);
                return <label key={occasion.slug} className={`flex min-h-11 cursor-pointer items-center rounded-xl border px-3 py-2 text-sm ${selected ? 'border-accent bg-accent/10 text-foreground' : 'border-border text-text-secondary'}`}>
                  <input className="sr-only" type="checkbox" checked={selected} onChange={() => setForm((current) => ({ ...current, occasions: selected ? current.occasions.filter((item) => item !== occasion.slug) : [...current.occasions, occasion.slug] }))} />
                  {occasion.label}
                </label>;
              })}
            </div>
          </fieldset>
        </section>
        <section className="glass-card space-y-4 p-5">
          <fieldset><legend className="mb-3 font-semibold">Cảm nhận của bạn</legend><div className="grid grid-cols-2 gap-2">{RATING_OPTIONS.map((rating) => <label key={rating.value} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${form.rating === rating.value ? 'border-accent bg-accent/10' : 'border-border'}`}><input type="radio" name="rating" value={rating.value} checked={form.rating === rating.value} onChange={() => setForm((current) => ({ ...current, rating: rating.value }))} />{rating.label}</label>)}</div></fieldset>
          <label htmlFor="restaurant-review" className="block text-sm font-medium">Nhận xét</label>
          <textarea id="restaurant-review" maxLength={10000} rows={5} className={fieldClass} placeholder="Món nào đáng thử? Có điều gì bạn muốn nhắn bạn bè?" value={form.review} onChange={e => setForm(p => ({ ...p, review: e.target.value }))} />
        </section>
          <section className="glass-card p-5"><h2 className="mb-3 font-semibold">Ảnh quán <span className="font-normal text-text-muted">(tùy chọn)</span></h2>
          <ImageUpload images={form.images} coverImage={form.coverImage} onCoverChange={coverImage => setForm(p => ({ ...p, coverImage }))} onChange={images => setForm(p => ({ ...p, images, coverImage: p.coverImage && images.includes(p.coverImage) ? p.coverImage : images[0] || '' }))} maxImages={5} onUploadingChange={setUploading} disabled={submitting} />
        </section>
        <section className="glass-card p-5">
          <LocationPicker
            value={{ latitude: form.latitude, longitude: form.longitude, location_accuracy: form.location_accuracy }}
            mapUrl={form.map_url}
            onChange={(location) => setForm((current) => ({ ...current, ...location }))}
          />
          {fieldErrors.location && <p ref={(element) => { fieldRefs.current.location = element; }} id="restaurant-location-error" tabIndex={-1} className="mt-2 text-sm text-accent-red" role="alert">{fieldErrors.location}</p>}
        </section>
      </fieldset>
      <p role="status" className="text-sm text-text-secondary">{uploading ? 'Đang tải ảnh, vui lòng giữ trang mở…' : draftStatus}</p>
      {error && <p role="alert" className="rounded-xl border border-accent-red/30 bg-accent-red/10 p-4 text-sm text-accent-red">{error}</p>}
      <button type="submit" disabled={submitting || uploading || !ready} className="btn-primary min-h-12 w-full disabled:opacity-50">{submitting || uploading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}{uploading ? 'Đang tải ảnh…' : submitting ? 'Đang lưu…' : restaurant ? 'Lưu thay đổi' : 'Thêm quán'}</button>
      {restaurant && <button type="button" disabled={submitting || uploading} onClick={remove} className="flex min-h-12 items-center gap-2 text-sm text-accent-red"><Trash2 size={16} />Xóa quán này</button>}
    </form>
  </div>;
}
