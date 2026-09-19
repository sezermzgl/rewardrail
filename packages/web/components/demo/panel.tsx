import type { ReactNode } from 'react';

/**
 * The shell every panel shares, so four of them read as one console.
 *
 * The vocabulary — window chrome, bordered stat tiles, a dark strip carrying
 * the proof — is the landing's own `.actor-panel` mock, made real. A visitor
 * arriving from the landing should recognise the product, not meet a second
 * one with different manners.
 */
export function Panel({
  title,
  role,
  icon,
  children,
  proof,
}: {
  title: string;
  role: string;
  icon?: ReactNode;
  children: ReactNode;
  proof?: ReactNode;
}) {
  return (
    <section className="dpanel">
      <header className="dpanel__head">
        {icon}
        <h2>{title}</h2>
        <small>{role}</small>
      </header>
      <div className="dpanel__body">{children}</div>
      {proof}
    </section>
  );
}

type Tone = 'positive' | 'warning' | 'quiet';

/** One figure, given room to be read. */
export function Stat({
  label,
  value,
  unit,
  tone,
  title,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: Tone;
  title?: string;
}) {
  return (
    <div className="dstat" data-tone={tone} title={title}>
      <span>
        {label}
        {title ? ' ⓘ' : ''}
      </span>
      <strong className="numeric">
        {value}
        {unit ? <u> {unit}</u> : null}
      </strong>
    </div>
  );
}

/**
 * The proof strip.
 *
 * Every panel ends with the transaction behind the numbers above it. Without a
 * visible hash the auditability claim is a sentence in a pitch deck; with one
 * it is a link a stranger can follow.
 */
export function Proof({
  label,
  hash,
  url,
  fallback,
}: {
  label: string;
  hash?: string;
  url?: string;
  fallback?: string;
}) {
  return (
    <footer className="dtx mono">
      <span>{label}</span>
      {url && hash ? (
        <a href={url} target="_blank" rel="noreferrer">
          {hash}
        </a>
      ) : (
        <code>{fallback ?? 'awaiting first action'}</code>
      )}
    </footer>
  );
}

export function Action({
  label,
  onClick,
  pending,
  disabled,
  title,
  variant,
  icon,
}: {
  label: string;
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
  title?: string;
  variant?: 'quiet' | 'danger';
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      title={title}
      className={`dbutton${variant ? ` dbutton--${variant}` : ''}`}
    >
      {pending ? null : icon}
      {pending ? 'Working…' : label}
    </button>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="dnote">{children}</p>;
}

export function Problem({ children }: { children: ReactNode }) {
  return <p className="dproblem">{children}</p>;
}
