'use client';

import { AUTH_HERO_SLIDES } from '@/lib/auth/heroSlides';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Ctx = {
  index: number;
  setIndex: (i: number) => void;
  slide: (typeof AUTH_HERO_SLIDES)[number];
};

const AuthMobileHeroContext = createContext<Ctx | null>(null);

export function AuthMobileHeroProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % AUTH_HERO_SLIDES.length), 7800);
    return () => clearInterval(t);
  }, []);

  return (
    <AuthMobileHeroContext.Provider value={{ index, setIndex, slide: AUTH_HERO_SLIDES[index]! }}>
      {children}
    </AuthMobileHeroContext.Provider>
  );
}

export function useAuthMobileHero() {
  const ctx = useContext(AuthMobileHeroContext);
  if (!ctx) throw new Error('useAuthMobileHero must be used within AuthMobileHeroProvider');
  return ctx;
}
