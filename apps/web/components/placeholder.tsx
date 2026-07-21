export default function PlaceholderPage({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <div className="rounded-card border border-[var(--border)] bg-surface p-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">{blurb}</p>
    </div>
  );
}
