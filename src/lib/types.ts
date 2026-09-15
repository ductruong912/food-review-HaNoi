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

export type CategorySlug = 'com_bui' | 'do_uong' | 'di_date' | 'lau_nuong' | 'do_ngot' | string;

export interface CategoryInfo {
  slug: CategorySlug;
  label: string;
  icon?: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { slug: 'com_bui', label: 'Cơm bụi' },
  { slug: 'do_uong', label: 'Đồ uống' },
  { slug: 'di_date', label: 'Đi date' },
  { slug: 'lau_nuong', label: 'Lẩu nướng' },
  { slug: 'do_ngot', label: 'Đồ ngọt' },
];

export const CATEGORY_MAP: Record<string, CategoryInfo> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c])
);

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
