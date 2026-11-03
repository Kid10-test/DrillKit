/**
 * #23.4 — Palet Perintah & Pintasan Terpadu (`Ctrl+K` / `⌘K` / `?`).
 *
 * Menggantikan jendela statis `ShortcutHelp.tsx`: menampilkan seluruh pintasan
 * keyboard (`data-testid="daftar-shortcut"`) sekaligus mengeksekusi aksi editor
 * secara langsung saat diketik lalu ditekan Enter atau diklik.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { saringPerintahPalet, type ItemPaletPerintah } from '../lib/paletPerintah'
import { cx } from '../lib/utils'
import { Button, Modal } from './ui'

export function PaletPerintah({
  open,
  onClose,
  perintah,
}: {
  open: boolean
  onClose: () => void
  perintah: readonly ItemPaletPerintah[]
}) {
  const [kueri, setKueri] = useState('')
  const [indeksAktif, setIndeksAktif] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setKueri('')
    setIndeksAktif(0)
    const id = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(id)
  }, [open])

  const tersaring = useMemo(() => saringPerintahPalet(perintah, kueri), [perintah, kueri])

  useEffect(() => {
    setIndeksAktif(0)
  }, [kueri])

  const grupTampil = useMemo(() => {
    const peta = new Map<string, { item: ItemPaletPerintah; idxDatar: number }[]>()
    tersaring.forEach((item, idxDatar) => {
      const daftar = peta.get(item.kategori) ?? []
      daftar.push({ item, idxDatar })
      peta.set(item.kategori, daftar)
    })
    return [...peta.entries()]
  }, [tersaring])

  function eksekusi(item: ItemPaletPerintah | undefined) {
    if (!item || item.nonaktif || item.hanyaInfo || !item.jalankan) return
    onClose()
    item.jalankan()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!tersaring.length) return
      setIndeksAktif((s) => (s + 1) % tersaring.length)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!tersaring.length) return
      setIndeksAktif((s) => (s - 1 + tersaring.length) % tersaring.length)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const kandidat =
        tersaring[indeksAktif] && !tersaring[indeksAktif].hanyaInfo && !tersaring[indeksAktif].nonaktif
          ? tersaring[indeksAktif]
          : tersaring.find((x) => !x.hanyaInfo && !x.nonaktif)
      eksekusi(kandidat)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Palet Perintah & Pintasan (Ctrl+K / ?)"
      footer={
        <div className="flex w-full items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>↑↓ pilih · Enter jalankan · Esc tutup</span>
          <Button variant="primary" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      <div className="space-y-3" data-testid="palet-perintah" onKeyDown={onKeyDown}>
        <input
          ref={inputRef}
          type="text"
          data-testid="input-cari-perintah"
          value={kueri}
          onChange={(e) => setKueri(e.target.value)}
          placeholder="Ketik aksi, nama set, tag, atau pintasan (mis. duplikat, kurva, sumbu x, sentuh)…"
          aria-label="Cari perintah atau pintasan"
          className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500"
        />

        <div
          data-testid="daftar-shortcut"
          className="scroll-thin max-h-[380px] space-y-3 overflow-y-auto pr-1 text-xs"
        >
          {grupTampil.length === 0 ? (
            <p className="py-6 text-center text-slate-500" data-testid="palet-kosong">
              Tidak ada perintah atau pintasan yang cocok dengan “{kueri}”.
            </p>
          ) : (
            grupTampil.map(([kategori, butir]) => (
              <div key={kategori}>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  {kategori}
                </p>
                <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-950/50">
                  {butir.map(({ item, idxDatar }) => {
                    const aktif = idxDatar === indeksAktif
                    const bisaKlik = !item.hanyaInfo && !item.nonaktif && Boolean(item.jalankan)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={`aksi-perintah-${item.id}`}
                        disabled={!bisaKlik}
                        onMouseEnter={() => setIndeksAktif(idxDatar)}
                        onClick={() => eksekusi(item)}
                        className={cx(
                          'flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition',
                          aktif && bisaKlik
                            ? 'bg-emerald-600/20 text-emerald-100'
                            : bisaKlik
                              ? 'text-slate-200 hover:bg-slate-800/70'
                              : 'cursor-default text-slate-400',
                          item.nonaktif && 'opacity-45',
                        )}
                      >
                        <span className="min-w-0 truncate">
                          {item.label}
                          {item.hanyaInfo && (
                            <span className="ml-2 rounded border border-slate-700 px-1 py-0.5 text-[9px] text-slate-500">
                              Info pintasan
                            </span>
                          )}
                        </span>
                        {item.pintasan && (
                          <kbd className="shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
                            {item.pintasan}
                          </kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}
