/** The shell every panel shares, so four of them read as one console. */
export function Panel({
  title,
  role,
  children,
}: {
  title: string;
  role: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="flex min-w-0 flex-col rounded-lg border p-4"
      style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}
    >
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
          {role}
        </span>
      </header>
      <div className="flex min-w-0 flex-col gap-3 text-sm">{children}</div>
    </section>
  );
}

/** A labelled number. The label never wraps away from its value. */
export function Figure({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span style={{ color: 'var(--muted)' }}>
        {label}
        {hint ? (
          <span className="ml-1 text-[11px]" title={hint}>
            ⓘ
          </span>
        ) : null}
      </span>
      <span className="numeric font-medium">
        {value}
        {unit ? <span className="ml-1 text-[11px] font-normal" style={{ color: 'var(--muted)' }}>{unit}</span> : null}
      </span>
    </div>
  );
}

export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
      {children}
    </p>
  );
}

export function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px]" style={{ color: 'var(--warn)' }}>
      {children}
    </p>
  );
}

/** A panel action. Disabled while it runs, so one click spends once. */
export function Action({
  label,
  onClick,
  pending,
  disabled,
  title,
}: {
  label: string;
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const off = disabled || pending;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={off}
      title={title}
      className="rounded-md px-3 py-1.5 text-[13px] font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
      style={{ background: 'var(--accent)', color: 'var(--bg)' }}
    >
      {pending ? 'Working…' : label}
    </button>
  );
}
