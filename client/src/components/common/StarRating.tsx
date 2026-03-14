import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
}

export function StarRating({
  rating,
  maxStars = 5,
  size = 16,
  interactive = false,
  onChange,
  className,
}: StarRatingProps) {
  const handleClick = (starIndex: number) => {
    if (interactive && onChange) {
      onChange(starIndex + 1);
    }
  };

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {Array.from({ length: maxStars }).map((_, i) => {
        const fillLevel = Math.min(1, Math.max(0, rating - i));
        const isFull = fillLevel >= 1;
        const isPartial = fillLevel > 0 && fillLevel < 1;

        return (
          <button
            key={i}
            type="button"
            onClick={() => handleClick(i)}
            disabled={!interactive}
            className={cn(
              'relative shrink-0',
              interactive && 'cursor-pointer transition-transform hover:scale-110',
              !interactive && 'cursor-default',
            )}
            aria-label={`${i + 1} star${i === 0 ? '' : 's'}`}
          >
            {/* Empty star (background) */}
            <Star
              size={size}
              className="text-neutral-200"
              strokeWidth={1.5}
            />

            {/* Filled star (overlay) */}
            {(isFull || isPartial) && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={isPartial ? { width: `${fillLevel * 100}%` } : undefined}
              >
                <Star
                  size={size}
                  className="fill-[#c8a97e] text-[#c8a97e]"
                  strokeWidth={1.5}
                />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
