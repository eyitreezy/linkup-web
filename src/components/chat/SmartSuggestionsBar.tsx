'use client';

interface SmartSuggestionsBarProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export function SmartSuggestionsBar({ suggestions, onSelect }: SmartSuggestionsBarProps) {
  if (suggestions.length === 0) return null;

  return (
    <div
      className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border/60 px-2.5 py-2 scrollbar-none min-[360px]:gap-2 min-[360px]:px-3"
      role="listbox"
      aria-label="Suggested messages"
    >
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          role="option"
          onClick={() => onSelect(suggestion)}
          className="shrink-0 rounded-full border border-border bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-muted whitespace-nowrap transition hover:border-primary/30 min-[360px]:px-3 min-[360px]:text-[12px]"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
