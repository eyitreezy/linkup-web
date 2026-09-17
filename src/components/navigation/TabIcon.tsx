import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import type { TabIconName } from '@/components/navigation/tabNavConfig';
import { cn } from '@/utils/cn';
import {
  IoAlbums,
  IoBookmark,
  IoChatbubbles,
  IoCompass,
  IoHeart,
  IoPerson,
  IoPricetag,
  IoShieldCheckmark,
  IoSettings,
} from 'react-icons/io5';

export type { TabIconName };

const ICONS = {
  heart: IoHeart,
  compass: IoCompass,
  chatbubbles: IoChatbubbles,
  bookmark: IoBookmark,
  albums: IoAlbums,
  pricetag: IoPricetag,
  person: IoPerson,
  shield: IoShieldCheckmark,
  settings: IoSettings,
} as const;

type Props = {
  name: TabIconName;
  className?: string;
  size?: number;
  active?: boolean;
};

/** Same Ionicons (io5) as mobile `app/(tabs)/_layout.tsx`. */
export function TabIcon({ name, className, size = 24, active = false }: Props) {
  if (name === 'matchmaker') {
    const color = active ? '#9B1B4B' : '#6B7280';
    return <MatchMakerTabIcon size={size} color={color} active={active} className={className} />;
  }
  const Icon = ICONS[name];
  return <Icon size={size} className={cn('shrink-0', className)} aria-hidden />;
}
