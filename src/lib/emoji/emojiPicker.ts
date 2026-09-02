/** Common emoji set for chat and multiline inputs. */

export const EMOJI_PICKER_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: ['😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤗', '🙂', '😉', '😅', '😭', '😤', '😴'],
  },
  {
    label: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '✌️', '🤞', '👋', '🫶', '❤️', '🔥', '✨', '💯', '🎉'],
  },
  {
    label: 'Food',
    emojis: ['🍕', '🍔', '🍟', '🌮', '🍣', '🍜', '🍰', '☕', '🍷', '🍺', '🥂', '🍦', '🍩', '🍉', '🍎', '🥗'],
  },
  {
    label: 'Activities',
    emojis: ['⚽', '🏀', '🎾', '🎬', '🎵', '🎮', '📚', '✈️', '🏖️', '🎁', '📸', '💼', '🏠', '🚗', '🛍️', '🎊'],
  },
];

export function insertTextAtCursor(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  insert: string
): { nextValue: string; nextCursor: number } {
  const start = Math.max(0, Math.min(selectionStart, value.length));
  const end = Math.max(start, Math.min(selectionEnd, value.length));
  const nextValue = value.slice(0, start) + insert + value.slice(end);
  const nextCursor = start + insert.length;
  return { nextValue, nextCursor };
}
