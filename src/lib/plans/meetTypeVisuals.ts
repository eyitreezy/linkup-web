import type { DbMeetType } from '@/types/database';

const SLUG_GRADIENTS: Record<string, readonly [string, string]> = {
  mood: ['#FF6584', '#FF9A76'],
  dinner: ['#6C63FF', '#A78BFA'],
  casual: ['#34D399', '#6EE7B7'],
  gym: ['#F59E0B', '#FBBF24'],
  hangout: ['#3B82F6', '#60A5FA'],
  group: ['#8B5CF6', '#C084FC'],
};

const DEFAULT_GRADIENT: readonly [string, string] = ['#6C63FF', '#FF6584'];

export function meetTypeGradient(type: Pick<DbMeetType, 'slug'>): readonly [string, string] {
  return SLUG_GRADIENTS[type.slug] ?? DEFAULT_GRADIENT;
}

export function meetTypeGradientClass(type: Pick<DbMeetType, 'slug'>): string {
  const map: Record<string, string> = {
    mood: 'from-[#FF6584] to-[#FF9A76]',
    dinner: 'from-[#6C63FF] to-[#A78BFA]',
    casual: 'from-[#34D399] to-[#6EE7B7]',
    gym: 'from-amber-500 to-amber-300',
    hangout: 'from-blue-500 to-blue-400',
    group: 'from-violet-500 to-violet-300',
  };
  return map[type.slug] ?? 'from-primary to-secondary';
}

/** CSS linear-gradient for explore cards — supports custom user slugs via default. */
export function meetTypeGradientStyle(type: Pick<DbMeetType, 'slug'>): string {
  const [from, to] = meetTypeGradient(type);
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}
