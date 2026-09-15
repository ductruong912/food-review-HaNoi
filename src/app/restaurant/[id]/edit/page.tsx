'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Camera, FileText, Sparkles, MessageSquareQuote, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, DISTRICTS, RATING_OPTIONS, type RatingLabel, type CategorySlug, type Restaurant } from '@/lib/types';
import { useAuth } from '@/components/AuthProvider';
import { CategoryIcon, RatingIcon } from '@/components/Icons';
import ImageUpload from '@/components/ImageUpload';
import { toast } from 'sonner';

export default function EditRestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  const [form, setForm] = useState({
    name: '',
    address: '',
    district: '',
    category: '' as CategorySlug,
    rating: 'ngon' as RatingLabel,
    review: '',
    image_url: '',
    images: [] as string[],
    price: '',
    map_url: '',
  });

  useEffect(() => {
    async function fetchRestaurant() {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        toast.error('Không tìm thấy quán');
        router.push('/');
        return;
      }

      const r = data as Restaurant;
      setRestaurant(r);
      setForm({
        name: r.name || '',
        address: r.address || '',
        district: r.district || '',
        category: r.category || 'com_bui',
        rating: r.rating || 'ngon',
        review: r.review || '',
        image_url: r.image_url || '',
        images: r.image_url ? [r.image_url] : [],
        price: r.price || '',
        map_url: r.map_url || '',
      });
      setLoading(false);
    }

    fetchRestaurant();
  }, [id, router]);

  const canEdit = isAdmin || (user?.id && restaurant && user.id === restaurant.created_by);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEdit) {
      toast.error('Bạn không có quyền chỉnh sửa quán này (Cần mã PIN Admin)');
      return;
    }

    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên quán');
      return;
    }
    if (!form.category) {
      toast.error('Vui lòng chọn loại quán');
      return;
    }

    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      address: form.address.trim(),
      district: form.district,
      category: form.category,
      rating: form.rating,
      review: form.review.trim(),
      image_url: form.images[0] || form.image_url || '',
      price: form.price.trim() || null,
      map_url: form.map_url.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('restaurants')
      .update(payload)
      .eq('id', id);

    if (error) {
      toast.error('Lỗi khi cập nhật: ' + error.message);
    } else {
      toast.success('Đã cập nhật thông tin quán!');
      router.push(`/restaurant/${id}`);
    }

    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn quán "${form.name}"?`)) return;

    const { error } = await supabase.from('restaurants').delete().eq('id', id);
    if (error) {
      toast.error('Lỗi khi xóa quán: ' + error.message);
    } else {
      toast.success('Đã xóa quán thành công!');
      router.push('/');
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-text-muted">Đang tải thông tin quán...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/restaurant/${id}`}
            className="p-2 rounded-xl bg-card border border-border hover:border-accent/30 transition-colors"
          >
            <ArrowLeft size={20} className="text-text-secondary" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Chỉnh sửa quán ăn</h1>
            <p className="text-xs text-text-muted">Cập nhật thông tin, địa chỉ, đánh giá</p>
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={handleDelete}
            className="p-2 rounded-xl bg-card border border-border hover:border-accent-red/50 text-text-muted hover:text-accent-red transition-colors"
            title="Xóa quán"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {!canEdit && (
        <div className="p-4 mb-6 rounded-2xl bg-accent-red/10 border border-accent-red/30 text-xs text-text-secondary">
          <p className="font-semibold text-accent-red mb-1">Quyền bị hạn chế</p>
          <p>
            Bạn cần nhập mã PIN Admin trong trang <strong>Cá nhân</strong> để có quyền chỉnh sửa hoặc xóa quán này.
          </p>
          <Link
            href="/profile"
            className="inline-block mt-2 font-bold text-accent hover:underline"
          >
            Đến trang Cá nhân nhập PIN →
          </Link>
        </div>
      )}

      <motion.form
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {/* Hình ảnh */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Camera size={16} className="text-accent" />
            <span>Hình ảnh quán</span>
          </h3>
          <ImageUpload
            images={form.images}
            onChange={(images) => setForm((prev) => ({ ...prev, images, image_url: images[0] || '' }))}
            maxImages={1}
          />
        </div>

        {/* Thông tin cơ bản */}
        <div className="glass-card p-4 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText size={16} className="text-accent" />
            <span>Thông tin quán</span>
          </h3>

          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">
              Tên quán <span className="text-accent-red">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition-colors"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5">
                Quận / Huyện
              </label>
              <select
                value={form.district}
                onChange={(e) => setForm((prev) => ({ ...prev, district: e.target.value }))}
                className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition-colors"
              >
                <option value="">Chọn quận</option>
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-text-muted block mb-1.5">
                Mức giá tham khảo
              </label>
              <input
                type="text"
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="Ví dụ: 35k - 50k"
                className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">
              Địa chỉ chi tiết
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Số nhà, ngõ, tên đường..."
              className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">
              Link Google Maps (tùy chọn)
            </label>
            <input
              type="url"
              value={form.map_url}
              onChange={(e) => setForm((prev) => ({ ...prev, map_url: e.target.value }))}
              placeholder="https://maps.app.goo.gl/..."
              className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        {/* Phân loại & Đánh giá */}
        <div className="glass-card p-4 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <span>Phân loại & Đánh giá</span>
          </h3>

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-text-muted block mb-2">
              Danh mục món <span className="text-accent-red">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map(({ slug, label }) => {
                const selected = form.category === slug;
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, category: slug }))}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      selected
                        ? 'bg-accent/15 border-accent text-accent'
                        : 'bg-card border-border/70 text-text-secondary hover:border-accent/40'
                    }`}
                  >
                    <CategoryIcon slug={slug} size={14} className={selected ? 'text-accent' : 'text-text-muted'} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="text-xs font-medium text-text-muted block mb-2">
              Cảm nhận vị giác
            </label>
            <div className="grid grid-cols-2 gap-2">
              {RATING_OPTIONS.map(({ value, label, emoji }) => {
                const selected = form.rating === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, rating: value }))}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      selected
                        ? 'bg-accent/15 border-accent text-accent'
                        : 'bg-card border-border/70 text-text-secondary hover:border-accent/40'
                    }`}
                  >
                    <RatingIcon rating={value} size={14} />
                    <span>{emoji} {label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Review */}
          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5 flex items-center gap-1.5">
              <MessageSquareQuote size={13} className="text-gold" />
              <span>Ghi chú / Đánh giá thật tâm</span>
            </label>
            <textarea
              value={form.review}
              onChange={(e) => setForm((prev) => ({ ...prev, review: e.target.value }))}
              rows={3}
              placeholder="Ngon ở điểm nào, dở ở đâu, lưu ý gì khi tới ăn..."
              className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || !canEdit}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl gradient-warm text-white font-bold text-sm hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-accent/15"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Đang lưu...</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>Lưu thay đổi</span>
            </>
          )}
        </button>
      </motion.form>
    </div>
  );
}
