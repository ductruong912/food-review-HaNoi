'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, Camera, FileText, Tag, Sparkles, MessageSquareQuote, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, DISTRICTS, RATING_OPTIONS, type RatingLabel, type CategorySlug } from '@/lib/types';
import { useAuth } from '@/components/AuthProvider';
import { CategoryIcon, RatingIcon } from '@/components/Icons';
import ImageUpload from '@/components/ImageUpload';
import LoginModal from '@/components/LoginModal';
import { toast } from 'sonner';

export default function NewRestaurantPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    address: '',
    district: '',
    category: '' as CategorySlug,
    rating: 'ngon' as RatingLabel,
    review: '',
    image_url: '',
    images: [] as string[], // For upload component
    price: '',
    map_url: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated || !user) {
      setShowLogin(true);
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
      name: form.name,
      address: form.address,
      district: form.district,
      category: form.category,
      rating: form.rating,
      review: form.review,
      image_url: form.images[0] || form.image_url || '',
      price: form.price || null,
      map_url: form.map_url || null,
      type: 'food',
      created_by: user.id,
      created_by_name: user.display_name,
    };

    let { data, error } = await supabase
      .from('restaurants')
      .insert(payload)
      .select()
      .single();

    if (error && error.message.includes('created_by_name')) {
      delete payload.created_by_name;
      const retry = await supabase
        .from('restaurants')
        .insert(payload)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      toast.error('Lỗi khi thêm quán: ' + error.message);
    } else {
      toast.success('Đã thêm quán mới!');
      router.push(`/restaurant/${data.id}`);
    }

    setSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/"
          className="p-2 rounded-xl bg-card border border-border hover:border-accent/30 transition-colors"
        >
          <ArrowLeft size={20} className="text-text-secondary" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Thêm quán mới</h1>
          <p className="text-xs text-text-muted">Chia sẻ quán ngon bạn đã từng đi</p>
        </div>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* Image */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Camera size={16} className="text-accent" />
            <span>Hình ảnh</span>
          </h3>
          <ImageUpload
            images={form.images}
            onChange={(images) => setForm((prev) => ({ ...prev, images }))}
            maxImages={1}
          />
        </div>

        {/* Basic Info */}
        <div className="glass-card p-4 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText size={16} className="text-accent" />
            <span>Thông tin cơ bản</span>
          </h3>

          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">
              Tên quán <span className="text-accent-red">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="VD: Bún chả Hương Liên"
              className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-white placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">Địa chỉ</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="VD: 24 Lê Văn Hưu, Hai Bà Trưng"
              className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-white placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">Quận/Huyện</label>
            <select
              value={form.district}
              onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-white focus:outline-none focus:border-accent transition-colors text-sm appearance-none"
            >
              <option value="">Chọn quận/huyện</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">Giá (tùy chọn)</label>
            <input
              type="text"
              value={form.price}
              onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              placeholder="VD: 45k, 40-60k"
              className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-white placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted block mb-1.5">Link Google Maps (tùy chọn)</label>
            <input
              type="url"
              value={form.map_url}
              onChange={(e) => setForm((p) => ({ ...p, map_url: e.target.value }))}
              placeholder="https://maps.app.goo.gl/..."
              className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-white placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
            />
          </div>
        </div>

        {/* Category */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Tag size={16} className="text-accent" />
            <span>Loại quán</span>
            <span className="text-accent-red text-xs">*</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => setForm((p) => ({ ...p, category: cat.slug }))}
                className={`chip flex items-center gap-1.5 ${form.category === cat.slug ? 'active' : ''}`}
              >
                <CategoryIcon slug={cat.slug} size={14} className="shrink-0" />
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Rating */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <span>Đánh giá</span>
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {RATING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, rating: opt.value }))}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                  form.rating === opt.value
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-card text-text-secondary hover:border-accent/30'
                }`}
              >
                <RatingIcon rating={opt.value} size={15} className="shrink-0" />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Review & Options */}
        <div className="glass-card p-4 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <MessageSquareQuote size={16} className="text-accent" />
            <span>Nhận xét</span>
          </h3>
          <textarea
            value={form.review}
            onChange={(e) => setForm((p) => ({ ...p, review: e.target.value }))}
            placeholder="Quán có gì đặc biệt? Món gì ngon? Không gian thế nào?"
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-white placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm resize-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 rounded-2xl gradient-warm text-white font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-50 glow-accent flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <PlusCircle size={18} />
              <span>Thêm quán</span>
            </>
          )}
        </button>
      </motion.form>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
