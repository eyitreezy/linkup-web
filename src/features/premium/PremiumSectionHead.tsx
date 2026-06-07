type Props = {
  title: string;
  className?: string;
};

/** Section divider — matches mobile premium overview. */
export function PremiumSectionHead({ title, className = '' }: Props) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
        <h2 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-foreground">
          {title}
        </h2>
      </div>
      <div
        className="h-0.5 rounded-full opacity-90"
        style={{
          background:
            'linear-gradient(90deg, rgba(108,99,255,0.35) 0%, rgba(255,101,132,0.2) 55%, transparent 100%)',
        }}
        aria-hidden
      />
    </div>
  );
}
