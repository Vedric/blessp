import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Subtle top loading bar that animates during page transitions.
 * Shows a gold (#c8a97e) progress bar at the top of the viewport.
 */
export function NavigationProgress() {
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Start progress animation
    setIsNavigating(true);
    setProgress(0);

    // Rapidly go to ~70% then slow down
    const fast = setTimeout(() => setProgress(70), 50);
    const slow = setTimeout(() => setProgress(90), 200);

    // Complete and hide
    const complete = setTimeout(() => {
      setProgress(100);
    }, 350);

    const hide = setTimeout(() => {
      setIsNavigating(false);
      setProgress(0);
    }, 600);

    return () => {
      clearTimeout(fast);
      clearTimeout(slow);
      clearTimeout(complete);
      clearTimeout(hide);
    };
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {isNavigating && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-[60] h-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="h-full bg-[#c8a97e]"
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{
              duration: progress === 100 ? 0.15 : 0.3,
              ease: 'easeOut',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
