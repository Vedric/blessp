import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';

interface WishlistButtonProps {
  productId: string;
  className?: string;
}

export function WishlistButton({ productId, className }: WishlistButtonProps) {
  const { isAuthenticated } = useAuth();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const navigate = useNavigate();
  const [isToggling, setIsToggling] = useState(false);

  const inWishlist = isInWishlist(productId);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      navigate('/signin');
      return;
    }

    if (isToggling) return;

    setIsToggling(true);
    try {
      await toggleWishlist(productId);
    } catch {
      // Context handles error state
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      className={
        className ||
        'absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-colors hover:bg-white'
      }
      aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
      whileTap={{ scale: 0.85 }}
      disabled={isToggling}
    >
      <motion.div
        animate={inWishlist ? { scale: [1, 1.3, 1] } : { scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      >
        <Heart
          size={18}
          className={
            inWishlist
              ? 'fill-red-500 text-red-500'
              : 'text-neutral-500'
          }
        />
      </motion.div>
    </motion.button>
  );
}
