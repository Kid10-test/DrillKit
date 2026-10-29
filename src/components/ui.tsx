import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { cx } from '../lib/utils'

/* --------------------------------- Toast -------------------------------- */

type ToastKind = 'ok' | 'err' | 'info'
interface ToastItem {
  id: number
  msg: string
  kind: ToastKind
}
const ToastCtx = createContext<{ push: (msg: string, kind?: ToastKind) => void }>({ push: () => {} })

export function useToast() {
  return useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((msg: string, kind: ToastKind = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((s) => [...s, { id, msg, kind }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3200)
  }, [])
  const value = useMemo(() => ({ push }), [push])
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ring-1 backdrop-blur',
              t.kind === 'ok' && 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30',
              t.kind === 'err' && 'bg-rose-500/15 text-rose-200 ring-rose-500/30',
              t.kind === 'info' && 'bg-slate-800/90 text-slate-200 ring-slate-600/40',
            )}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ------------------------------ Error boundary ---------------------------- */

/**
 * Menangkap error render supaya satu modul yang bermasalah tidak membuat
 * seluruh aplikasi menjadi layar putih.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('DrillKit error:', error)
  }

  render() {
    const e = this.state.error
    if (!e) return this.props.children
    return (
      <div className="m-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
        <p className="font-semibold">Terjadi kesalahan pada tampilan ini.</p>
        <p className="mt-1 text-xs text-rose-300/80">{e.message || String(e)}</p>
        <button
          onClick={() => this.setState({ error: null })}
          className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500"
        >
          Coba lagi
        </button>
      </div>
    )
  }
}

/* --------------------------------- Card ---------------------------------- */

export function Card({
  children,
  className,
  padded = true,
  ...rest
}: {
  children: React.ReactNode
  className?: string
  padded?: boolean
  [key: string]: unknown
}) {
  return (
    <div
      {...rest}
      className={cx(
        'rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm',
        padded && 'p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/* -------------------------------- Button --------------------------------- */

type BtnVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'soft'

export function Button({
  children,
  onClick,
  variant = 'soft',
  size = 'md',
  disabled,
  type = 'button',
  className,
  title,
  ...rest
}: {
  children: React.ReactNode
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  variant?: BtnVariant
  size?: 'sm' | 'md'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
  title?: string
  /** Atribut tambahan (mis. `data-kiosk-allow`) diteruskan ke elemen <button>. */
  [key: string]: unknown
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none'
  const sizes =
    size === 'sm'
      ? 'max-sm:min-h-[34px] px-2.5 py-1.5 text-xs'
      : 'max-sm:min-h-[38px] px-3.5 py-2 text-sm'
  const variants: Record<BtnVariant, string> = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm',
    soft: 'bg-slate-800 text-slate-200 hover:bg-slate-700 ring-1 ring-slate-700',
    outline: 'border border-slate-700 text-slate-300 hover:bg-slate-800',
    ghost: 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70',
    danger: 'bg-rose-600/90 text-white hover:bg-rose-600',
  }
  return (
    <button
      {...rest}
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(base, sizes, variants[variant], className)}
    >
      {children}
    </button>
  )
}

/* --------------------------------- Input --------------------------------- */

const FieldIdCtx = createContext<string | undefined>(undefined)

const fieldBase =
  'w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const ctxId = useContext(FieldIdCtx)
  const { className, id, ...rest } = props
  return <input id={id ?? ctxId} {...rest} className={cx(fieldBase, className)} />
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ctxId = useContext(FieldIdCtx)
  const { className, id, ...rest } = props
  return <textarea id={id ?? ctxId} {...rest} className={cx(fieldBase, 'min-h-[80px] resize-y', className)} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const ctxId = useContext(FieldIdCtx)
  const { className, children, id, ...rest } = props
  return (
    <select id={id ?? ctxId} {...rest} className={cx(fieldBase, 'appearance-none pr-8', className)}>
      {children}
    </select>
  )
}

export function Label({
  children,
  hint,
  htmlFor,
}: {
  children: React.ReactNode
  hint?: string
  htmlFor?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 flex items-baseline justify-between text-xs font-medium text-slate-400"
    >
      <span>{children}</span>
      {hint && <span className="text-[11px] font-normal text-slate-500">{hint}</span>}
    </label>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const autoId = useId()
  return (
    <FieldIdCtx.Provider value={autoId}>
      <div>
        <Label htmlFor={autoId} hint={hint}>
          {label}
        </Label>
        {children}
      </div>
    </FieldIdCtx.Provider>
  )
}

/* --------------------------------- Modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  testId,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
  /** M1 — penanda untuk pengujian; diletakkan di panel dalam modal. */
  testId?: string
}) {
  /**
   * `onClose` disimpan di ref supaya efek ini **tidak perlu dipasang ulang**
   * setiap kali induknya render ulang. Dulu efeknya bergantung pada
   * `onClose` (fungsi baru tiap render) — setiap render ulang, listener
   * Escape dilepas lalu dipasang lagi, dan kalau kebetulan ada tombol Escape
   * yang masuk di sela itu, tekanannya hilang (modal baru menutup pada
   * tekanan kedua). Dengan ref, listener terpasang sekali selama modal
   * terbuka, jadi Escape selalu diterima.
   */
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        data-testid={testId}
        className={cx(
          'relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-slate-800 bg-slate-900 shadow-2xl sm:rounded-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-5 py-3.5 backdrop-blur">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          <button
            data-kiosk-allow
            onClick={onClose}
            aria-label="Tutup"
            title="Tutup"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/*
          Ruang bawah ekstra kalau ada footer: footer-nya menempel
          (`sticky bottom-0`) dan menutupi apa pun yang berada di
          bawah sekali. Tanpa ruang ini, tombol di akhir isi — misalnya
          "Tambah segmen" di editor lagu — tidak bisa diklik.
        */}
        <div className={cx('space-y-4 px-5 pt-4', footer ? 'pb-20' : 'pb-4')}>
          {children}
        </div>
        {footer && (
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-800 bg-slate-900/95 px-5 py-3.5 backdrop-blur">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function ConfirmButton({
  onConfirm,
  label = 'Hapus',
  message = 'Yakin ingin menghapus?',
  size = 'sm',
  disabled = false,
  testId,
}: {
  onConfirm: () => void
  label?: string
  message?: string
  size?: 'sm' | 'md'
  /** #5 sisa — tombol gabung set mati saat tidak ada set berikutnya. */
  disabled?: boolean
  testId?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  if (!armed)
    return (
      <Button variant="ghost" size={size} disabled={disabled} data-testid={testId} onClick={() => setArmed(true)}>
        {label}
      </Button>
    )
  return (
    <Button
      variant="danger"
      size={size}
      disabled={disabled}
      data-testid={testId ? `${testId}-konfirmasi` : undefined}
      onClick={() => {
        onConfirm()
        setArmed(false)
      }}
    >
      {message}
    </Button>
  )
}

/* --------------------------------- Badge --------------------------------- */

/**
 * Lencana kecil. Prop lain (`data-testid`, `title`, …) diteruskan apa adanya.
 *
 * N19 — dulu hanya `children` & `className` yang diterima, sehingga
 * `data-testid` yang dipasang pemanggil **hilang tanpa suara**: lencana
 * kehadiran di halaman Berbagi sudah lama memintanya, tetapi tidak pernah
 * muncul di DOM, dan uji yang mencarinya gagal pada hal yang tidak ada
 * hubungannya dengan yang diuji. Prop yang diabaikan diam-diam seperti itu
 * lebih buruk daripada prop yang ditolak.
 */
export function Badge({
  children,
  className,
  ...rest
}: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium',
        className ?? 'border-slate-700 bg-slate-800/60 text-slate-300',
      )}
      {...rest}
    >
      {children}
    </span>
  )
}

export function EmptyState({
  title,
  desc,
  action,
  icon,
}: {
  title: string
  desc?: string
  action?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-slate-600">{icon}</div>}
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {desc && <p className="mt-1 max-w-sm text-xs text-slate-500">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  testId,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  /** M1 — penanda untuk pengujian; tidak mengubah tampilan. */
  testId?: string
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50"
    >
      <span>{label}</span>
      <span
        className={cx(
          'relative h-5 w-9 shrink-0 rounded-full transition',
          checked ? 'bg-emerald-500' : 'bg-slate-700',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  )
}

export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cx('mt-1 text-2xl font-semibold tabular-nums', accent ?? 'text-slate-50')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </Card>
  )
}
