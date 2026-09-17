import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded bg-neutral-100',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:animate-shimmer motion-reduce:before:animate-none',
        'before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent',
        className,
      )}
    />
  );
}
