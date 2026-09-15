'use client';

import { Star } from 'lucide-react';

interface RatingStarsProps {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export default function RatingStars({
  rating,
  size = 18,
  interactive = false,
  onChange,
}: RatingStarsProps) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(star)}
          className={`transition-transform ${
            interactive ? 'cursor-pointer hover:scale-125 active:scale-90' : 'cursor-default'
          }`}
        >
          <Star
            size={size}
            className={`transition-colors ${
              star <= rating
                ? 'star-filled fill-current'
                : 'star-empty'
            }`}
          />
        </button>
      ))}
    </div>
  );
}
