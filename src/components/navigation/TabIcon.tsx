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
};

/** Same Ionicons (io5) as mobile `app/(tabs)/_layout.tsx`. */
export function TabIcon({ name, className, size = 24 }: Props) {
  const Icon = ICONS[name];
  return <Icon size={size} className={cn('shrink-0', className)} aria-hidden />;
}
