'use client';

import {
  IoAirplane,
  IoBarbell,
  IoBeer,
  IoBook,
  IoBriefcase,
  IoCafe,
  IoCamera,
  IoColorPalette,
  IoFilm,
  IoGameController,
  IoLeaf,
  IoMusicalNotes,
  IoPeople,
  IoRestaurant,
  IoSparkles,
} from 'react-icons/io5';
import type { IconType } from 'react-icons';
import { cn } from '@/utils/cn';

const ICON_MAP: Record<string, IconType> = {
  'sparkles-outline': IoSparkles,
  'barbell-outline': IoBarbell,
  'cafe-outline': IoCafe,
  'restaurant-outline': IoRestaurant,
  'film-outline': IoFilm,
  'leaf-outline': IoLeaf,
  'musical-notes-outline': IoMusicalNotes,
  'game-controller-outline': IoGameController,
  'book-outline': IoBook,
  'airplane-outline': IoAirplane,
  'briefcase-outline': IoBriefcase,
  'color-palette-outline': IoColorPalette,
  'camera-outline': IoCamera,
  'people-outline': IoPeople,
  'beer-outline': IoBeer,
  'ellipse-outline': IoSparkles,
};

type Props = {
  icon: string | null | undefined;
  selected?: boolean;
  size?: number;
  className?: string;
};

export function MeetTypeIcon({ icon, selected, size = 16, className }: Props) {
  const Icon = ICON_MAP[icon ?? ''] ?? IoSparkles;
  return (
    <Icon
      size={size}
      className={cn(selected ? 'text-white' : 'text-primary', className)}
      aria-hidden
    />
  );
}
