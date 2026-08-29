/* Base primitives. One module on purpose — they are small, they share a
   stylesheet, and splitting them into ten files buys nothing. */
import React, { useCallback, useId, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, ChevronDown, X } from 'lucide-react';
import { ToastContext } from './toast-context';
import './ui.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/* -------------------------------------------------------------------- Button */
export function Button({
  variant = 'secondary',
  size,
  block = false,
  className,
  type = 'button',
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={cx('jp-btn', `jp-btn--${variant}`, size && `jp-btn--${size}`, block && 'jp-btn--block', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Icon-only button. `label` is required — it becomes the accessible name. */
export function IconButton({ label, className, type = 'button', children, ...rest }) {
  return (
    <button type={type} aria-label={label} title={label} className={cx('jp-btn', 'jp-btn--icon', className)} {...rest}>
      {children}
    </button>
  );
}

/* --------------------------------------------------------------------- Field
   Wraps a control with its label, hint and error, wiring aria-describedby and
   aria-invalid so the error is announced rather than merely coloured. */
export function Field({ label, htmlFor, error, hint, optional, children }) {
  return (
    <div className="jp-field">
      {label && (
        <label className="jp-field__label" htmlFor={htmlFor}>
          {label}
          {optional && <span className="jp-field__optional"> (optional)</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="jp-field__hint">{hint}</span>}
      {error && (
        <span className="jp-field__error" role="alert">
          <AlertCircle size={13} aria-hidden="true" /> {error}
        </span>
      )}
    </div>
  );
}

function useFieldIds(id, error, hint) {
  const generated = useId();
  const fieldId = id || generated;
  const describedBy = [error && `${fieldId}-error`, hint && !error && `${fieldId}-hint`].filter(Boolean).join(' ');
  return { fieldId, describedBy: describedBy || undefined };
}

export function Input({ id, label, error, hint, optional, className, ...rest }) {
  const { fieldId, describedBy } = useFieldIds(id, error, hint);
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} optional={optional}>
      <input
        id={fieldId}
        className={cx('jp-input', className)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    </Field>
  );
}

export function Textarea({ id, label, error, hint, optional, className, ...rest }) {
  const { fieldId, describedBy } = useFieldIds(id, error, hint);
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} optional={optional}>
      <textarea
        id={fieldId}
        className={cx('jp-textarea', className)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    </Field>
  );
}

/** Native select — the platform already solves keyboard, mobile and a11y. */
export function Select({ id, label, error, hint, optional, className, children, ...rest }) {
  const { fieldId, describedBy } = useFieldIds(id, error, hint);
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} optional={optional}>
      <span className="jp-select-wrap">
        <select
          id={fieldId}
          className={cx('jp-select', className)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown size={15} aria-hidden="true" />
      </span>
    </Field>
  );
}

/* --------------------------------------------------------------------- Badge */
export function Badge({ tone = 'neutral', className, children, ...rest }) {
  return (
    <span className={cx('jp-badge', `jp-badge--${tone}`, className)} {...rest}>
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------------- Card */
export function Card({ flush = false, className, children, ...rest }) {
  return (
    <section className={cx('jp-card', flush && 'jp-card--flush', className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHead({ title, children }) {
  return (
    <header className="jp-card__head">
      {typeof title === 'string' ? <h2 className="jp-h2">{title}</h2> : title}
      {children}
    </header>
  );
}

export function CardBody({ className, children }) {
  return <div className={cx('jp-card__body', className)}>{children}</div>;
}

/* ------------------------------------------------------------------ Skeleton */
export function Skeleton({ width = '100%', height = 12, radius, style, ...rest }) {
  return (
    <span
      className="jp-skeleton"
      aria-hidden="true"
      style={{ width, height, borderRadius: radius, ...style }}
      {...rest}
    />
  );
}

/* ---------------------------------------------------------------- EmptyState */
export function EmptyState({ title, body, action }) {
  return (
    <div className="jp-empty">
      <p className="jp-empty__title">{title}</p>
      {body && <p className="jp-empty__body">{body}</p>}
      {action}
    </div>
  );
}

/* --------------------------------------------------------------------- Modal
   Radix Dialog supplies focus trapping, scroll lock, Escape and aria-modal.
   `variant="drawer"` anchors it to the bottom edge — same primitive, different
   presentation, which is what the mobile filter panel needs. */
export function Modal({ open, onOpenChange, title, description, footer, variant, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="jp-scrim" />
        <Dialog.Content className={cx('jp-modal', variant === 'drawer' && 'jp-drawer')}>
          <div className="jp-modal__head">
            <div>
              <Dialog.Title className="jp-h2">{title}</Dialog.Title>
              {description && <Dialog.Description className="jp-sm jp-muted">{description}</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close">
                <X size={16} aria-hidden="true" />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="jp-modal__body">{children}</div>
          {footer && <div className="jp-modal__foot">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* --------------------------------------------------------------------- Toast */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, tone = 'neutral') => {
      const id = Math.random().toString(36).slice(2);
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="jp-toasts" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={cx('jp-toast', `jp-toast--${t.tone}`)} role="status">
            <span>{t.message}</span>
            <button type="button" className="jp-toast__close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
