export type AuthHeroSlide = {
  image: string;
  headline: string;
  subtext: string;
};

/** Mirrors mobile `lib/auth/datingAuthHeroSlides.ts` — images in /public/auth-hero */
export const AUTH_HERO_SLIDES: AuthHeroSlide[] = [
  {
    image: '/auth-hero/slide-1.jpg',
    headline: 'Trusted plans nearby',
    subtext: 'Discover real hangouts from verified people around you.',
  },
  {
    image: '/auth-hero/slide-2.jpg',
    headline: 'Negotiate with ease',
    subtext: 'Align on time, place, and vibe before you meet.',
  },
  {
    image: '/auth-hero/slide-3.jpg',
    headline: 'Safe escrow system',
    subtext: 'Commitment-backed plans that reduce flakes and build trust.',
  },
  {
    image: '/auth-hero/slide-4.jpg',
    headline: 'Meet with confidence',
    subtext: 'Verified users, secure plans, and real connections.',
  },
];
