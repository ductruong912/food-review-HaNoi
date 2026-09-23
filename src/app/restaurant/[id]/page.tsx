import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Restaurant } from '@/lib/types';
import { RATING_MAP } from '@/lib/types';
import RestaurantDetailClient from '@/components/RestaurantDetailClient';

type Props = {
  params: Promise<{ id: string }>;
};

// Fetch restaurant data (shared between generateMetadata and page)
const getRestaurant = cache(async (id: string): Promise<Restaurant | null> => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error('Unable to load restaurant');

  return data as Restaurant | null;
});

// Dynamic OG metadata per restaurant — improves Zalo/Facebook/iMessage link previews
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const restaurant = await getRestaurant(id);

  if (!restaurant) {
    return {
      title: 'Không tìm thấy quán — Food Review Hà Nội',
    };
  }

  const ratingInfo = RATING_MAP[restaurant.rating] || RATING_MAP.chua_an;
  const description = restaurant.review
    ? `${ratingInfo.label} — ${restaurant.review.slice(0, 150)}`
    : `${ratingInfo.label} • ${restaurant.district} • ${restaurant.category}`;

  return {
    title: `${restaurant.name} — Food Review Hà Nội`,
    description,
    openGraph: {
      title: `${restaurant.name} — ${ratingInfo.label}`,
      description,
      type: 'article',
      locale: 'vi_VN',
      images: restaurant.image_url
        ? [
            {
              url: restaurant.image_url,
              width: 1200,
              height: 630,
              alt: restaurant.name,
            },
          ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${restaurant.name} — ${ratingInfo.label}`,
      description,
      images: restaurant.image_url ? [restaurant.image_url] : [],
    },
  };
}

export default async function RestaurantDetailPage({ params }: Props) {
  const { id } = await params;
  const restaurant = await getRestaurant(id);

  if (!restaurant) {
    notFound();
  }

  return <RestaurantDetailClient restaurant={restaurant} />;
}
