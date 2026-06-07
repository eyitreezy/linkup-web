'use client';

import { AUTH_HERO_SLIDES } from '@/lib/auth/heroSlides';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useState } from 'react';

export function AuthHeroSlider() {
  const [index, setIndex] = useState(0);
  const slide = AUTH_HERO_SLIDES[index];

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % AUTH_HERO_SLIDES.length), 5500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative hidden min-h-full flex-1 overflow-hidden lg:block">
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.image}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
          className="absolute inset-0"
        >
          <Image
            src={slide.image}
            alt=""
            fill
            className="object-cover"
            priority
            sizes="50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#2D1B4E]/90 via-[#6C63FF]/40 to-transparent" />
        </motion.div>
      </AnimatePresence>
      <div className="relative z-10 flex h-full flex-col justify-end p-12 xl:p-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.headline}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
          >
            <p className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white xl:text-5xl">
              {slide.headline}
            </p>
            <p className="mt-4 max-w-md text-lg font-semibold leading-relaxed text-white/85">
              {slide.subtext}
            </p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-8 flex gap-2">
          {AUTH_HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-8 bg-white' : 'w-2 bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
