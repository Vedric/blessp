import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Columns3 } from 'lucide-react';
import { useCompare } from '@/context/CompareContext';

interface CompareButtonProps {
  productId: string;
  className?: string;
}

export function CompareButton({ productId, className }: CompareButtonProps) {
  const { t } = useTranslation();
  const { isInCompare, addToCompare, removeFromCompare } = useCompare();

  const active = isInCompare(productId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (active) {
      removeFromCompare(productId);
    } else {
      addToCompare(productId);
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      className={
        className ||
        'absolute right-3 top-14 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-colors hover:bg-white'
      }
      aria-label={t(active ? 'compare.remove' : 'compare.add')}
      aria-pressed={active}
      whileTap={{ scale: 0.85 }}
    >
      <motion.div
        animate={active ? { scale: [1, 1.3, 1] } : { scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      >
        <Columns3
          size={16}
          className={
            active
              ? 'text-[#80603c]'
              : 'text-neutral-500'
          }
        />
      </motion.div>
    </motion.button>
  );
}
