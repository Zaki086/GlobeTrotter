import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HeroCarouselProps {
  images: string[];
  interval?: number;
  className?: string;
  overlay?: boolean;
}

export function HeroCarousel({ images, interval = 5000, className, overlay = true }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % images.length), interval);
    return () => clearInterval(timer);
  }, [images.length, interval]);

  return (
    <div className={cn('relative overflow-hidden rounded-3xl', className)}>
      <AnimatePresence mode="wait">
        <motion.img
          key={images[index]}
          src={images[index]}
          alt=""
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </AnimatePresence>
      {overlay && <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
