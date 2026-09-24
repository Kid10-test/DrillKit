/**
 * Diekstrak dari `src/pages/Drill.tsx` (#5 — pecah Drill.tsx).
 * Isinya tidak diubah; hanya alamat impor yang disesuaikan.
 */

/** A6 — Dialog daftar shortcut keyboard editor. */
import {
  Button,
  Modal,
} from './ui'

import { DAFTAR_SHORTCUT } from '../lib/shortcut'

/**
 * A6 — Daftar shortcut keyboard (dibuka dengan tombol `?`).
 * Daftarnya hidup di `src/lib/shortcut.ts` supaya **panduan 1 halaman (F4)**
 * dan dialog ini selalu menampilkan isi yang sama.
 */

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Shortcut keyboard"
      footer={
        <Button variant="primary" onClick={onClose}>
          Mengerti
        </Button>
      }
    >
      <p className="mb-3 text-xs leading-relaxed text-slate-400">
        Berlaku di halaman <b>editor formasi</b>. Selama kursor berada di dalam kolom isian,
        tombol-tombol ini sengaja tidak dipakai supaya pengetikan tidak kacau.
      </p>
      <div className="space-y-3" data-testid="daftar-shortcut">
        {DAFTAR_SHORTCUT.map((g) => (
          <div key={g.kelompok}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {g.kelompok}
            </p>
            <div className="overflow-hidden rounded-lg border border-slate-800">
              {g.baris.map(([k, keterangan]) => (
                <div
                  key={k}
                  className="flex items-center justify-between gap-3 border-b border-slate-800/70 px-3 py-1.5 last:border-0"
                >
                  <kbd className="shrink-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-[11px] text-slate-200">
                    {k}
                  </kbd>
                  <span className="text-right text-xs text-slate-300">{keterangan}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
