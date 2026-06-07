'use client';

import { AUTH_HERO_SLIDES } from '@/lib/auth/heroSlides';
import { useAuthMobileHero } from '@/components/auth/AuthMobileHeroContext';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';

/** Full-bleed hero imagery (mobile / tablet ≤1023px). */
export function AuthMobileHeroBackdrop() {
  const { index } = useAuthMobileHero();

  return (
    <div className="pointer-events-none absolute inset-0 z-0 lg:hidden" aria-hidden>
      <AnimatePresence mode="sync">
        {AUTH_HERO_SLIDES.map((s, i) =>
          i === index ? (
            <motion.div
              key={s.image}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.72, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0"
            >
              <Image src={s.image} alt="" fill className="object-cover" priority sizes="100vw" />
            </motion.div>
          ) : null
        )}
      </AnimatePresence>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, rgba(26,20,45,0.45) 0%, rgba(108,99,255,0.18) 50%, rgba(255,101,132,0.22) 100%)',
        }}
      />
    </div>
  );
}

/** Slide copy + dots — centered above the glass card, same width as the card. */
export function AuthMobileHeroCopy() {
  const { index, setIndex, slide } = useAuthMobileHero();

  return (
    <div className="auth-mobile-copy" aria-live="polite">
      <div className="auth-mobile-copy-inner">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.headline}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
          >
            <p className="auth-mobile-headline">{slide.headline}</p>
            <p className="auth-mobile-subtext">{slide.subtext}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="auth-mobile-dots">
        {AUTH_HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={i === index ? 'auth-mobile-dot auth-mobile-dot--active' : 'auth-mobile-dot'}
          />
        ))}
      </div>
    </div>
  );
}
