// ============================================================
// Database Types — Khớp với schema Supabase hiện tại
// ============================================================

export interface Restaurant {
  id: string;
  name: string;
  district: string;
  address: string;
  rating: RatingLabel;
  review: string;
  image_url: string;
  created_at: string;
  type: string;
  category: CategorySlug;
  occasions?: OccasionSlug[];
  price: string | null;
  // Cột mới (thêm sau)
  map_url?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  updated_at?: string | null;
}

export interface RestaurantInsert {
  name: string;
  district: string;
  address: string;
  rating: RatingLabel;
  review?: string;
  image_url?: string;
  type?: string;
  category: CategorySlug;
  occasions?: OccasionSlug[];
  price?: string | null;
  map_url?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
}

// ============================================================
// Rating — Text enum (schema hiện tại)
// ============================================================

export type RatingLabel = 'ngon' | 'binh_thuong' | 'khong_ngon' | 'chua_an';

export interface RatingInfo {
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  score: number; // Dùng để sort
}

export const RATING_MAP: Record<RatingLabel, RatingInfo> = {
  ngon: {
    label: 'Ngon tuyệt',
    emoji: '✦',
    color: 'text-accent-green',
    bgColor: 'bg-accent-green/15 border-accent-green/25',
    score: 4,
  },
  binh_thuong: {
    label: 'Khá ổn',
    emoji: '✓',
    color: 'text-accent-secondary',
    bgColor: 'bg-accent-secondary/15 border-accent-secondary/25',
    score: 3,
  },
  khong_ngon: {
    label: 'Không hợp vị',
    emoji: '✕',
    color: 'text-accent-red',
    bgColor: 'bg-accent-red/15 border-accent-red/25',
    score: 2,
  },
  chua_an: {
    label: 'Muốn thử',
    emoji: '○',
    color: 'text-text-muted',
    bgColor: 'bg-card border-border',
    score: 0,
  },
};

export const RATING_OPTIONS: { value: RatingLabel; label: string; emoji: string }[] = [
  { value: 'ngon', label: 'Ngon tuyệt', emoji: '✦' },
  { value: 'binh_thuong', label: 'Khá ổn', emoji: '✓' },
  { value: 'khong_ngon', label: 'Không hợp vị', emoji: '✕' },
  { value: 'chua_an', label: 'Muốn thử', emoji: '○' },
];

// ============================================================
// Categories — Map slug → display
// ============================================================

export type CategorySlug =
  | 'mon_viet_hang_ngay'
  | 'lau_nuong'
  | 'an_vat'
  | 'ca_phe_do_uong'
  | 'banh_trang_mieng'
  | 'mon_quoc_te'
  | string;

export type OccasionSlug = 'hen_ho' | 'di_nhom' | 'gia_dinh' | 'mot_minh';

export interface CategoryInfo {
  slug: CategorySlug;
  label: string;
  icon?: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { slug: 'mon_viet_hang_ngay', label: 'Món Việt hằng ngày' },
  { slug: 'lau_nuong', label: 'Lẩu nướng' },
  { slug: 'an_vat', label: 'Ăn vặt' },
  { slug: 'ca_phe_do_uong', label: 'Cà phê & Đồ uống' },
  { slug: 'banh_trang_mieng', label: 'Bánh & Tráng miệng' },
  { slug: 'mon_quoc_te', label: 'Món quốc tế' },
];

export const CATEGORY_MAP: Record<string, CategoryInfo> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c])
);

export const OCCASIONS: { slug: OccasionSlug; label: string }[] = [
  { slug: 'hen_ho', label: 'Hẹn hò' },
  { slug: 'di_nhom', label: 'Đi nhóm' },
  { slug: 'gia_dinh', label: 'Gia đình' },
  { slug: 'mot_minh', label: 'Một mình' },
];

export const OCCASION_MAP: Record<OccasionSlug, string> = Object.fromEntries(
  OCCASIONS.map((occasion) => [occasion.slug, occasion.label])
) as Record<OccasionSlug, string>;

// ============================================================
// Districts
// ============================================================

export const DISTRICTS = [
  'Ba Đình', 'Hoàn Kiếm', 'Hai Bà Trưng', 'Đống Đa',
  'Tây Hồ', 'Cầu Giấy', 'Thanh Xuân', 'Hoàng Mai',
  'Long Biên', 'Nam Từ Liêm', 'Bắc Từ Liêm', 'Hà Đông',
  'Thanh Trì', 'Gia Lâm', 'Đông Anh', 'Sóc Sơn',
] as const;

// ============================================================
// Profile (cho auth)
// ============================================================

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: 'admin' | 'contributor' | 'viewer';
  created_at: string;
}
