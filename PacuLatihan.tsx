/**
 * H1 — Pacu latihan: layar yang menemani latihan **sedang berjalan**.
 *
 * Keluhan yang mendasarinya: *latihan sering melenceng dari rencana, dan
 * bagian akhir yang kehabisan waktu.* Melencengnya tidak terjadi sekaligus
 * — ia menumpuk sedikit demi sedikit, dan baru terasa ketika blok terakhir
 * tak kebagian waktu. Layar ini membuat penumpukan itu **tampil sedari awal**.
 *
 * Dua keputusan yang menentukan:
 *
 * 1. **Geser dihitung dari kenyataan, bukan rencana.** Sebelum blok pertama
 *    dimulai, gesernya 0 — bukan karena tepat waktu, melainkan karena belum
 *    ada yang bisa diketahui. Menyamakan "tidak tahu" dengan "tepat waktu"
 *    akan memberi rasa aman palsu.
 * 2. **Proyeksi selesai selalu ditampilkan.** Ujung rencana digeser
 *    sebesar keterlambatan yang sudah menumpuk, sehingga "bagian akhir akan
 *    kehabisan waktu" kelihatan jauh sebelum ia benar-benar terjadi.
 *
 * Sengaja memakai tombol besar: layar ini dipakai sambil berdiri di
 * lapangan, bukan sambil duduk di depan laptop.
 */
import { useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { Session } from '../db/types'
import { jamDariMenit, menitDariJam } from '../lib/runsheet'
import { LABEL_BLOK, formatGeser, formatMenit, posisiLatihan, susunRencana } from '../lib/latihan'
import { PenandaSesi } from './PenandaSesi'

/** Jam berjalan, diperbarui tiap detik. */
function pakaiJam() {
  const [kini, setKini] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setKini(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return {
    menit: kini.getHours() * 60 + kini.getMinutes(),
    jam: `${String(kini.getHours()).padStart(2, '0')}:${String(kini.getMinutes()).padStart(2, '0')}`,
    detik: kini.getSeconds(),
    epoch: kini.getTime(),
  }
}

export function PacuLatihan({ sesi, onClose }: { sesi: Session; onClose: () => void }) {
  const { menit, jam, detik, epoch } = pakaiJam()
  const blok = sesi.rencanaLatihan ?? []
  const realisasi = sesi.realisasiLatihan ?? []

  const mulai = menitDariJam(sesi.startTime)
  const rencana = useMemo(() => susunRencana(mulai, blok), [mulai, blok])
  const pos = useMemo(
    () => posisiLatihan({ rencana, realisasi, menit, kini: epoch }),
    [rencana, realisasi, menit, epoch],
  )

  /** Blok berikutnya yang belum punya catatan sama sekali. */
  const berikutnya = rencana.find((b) => !realisasi.some((r) => r.id === b.id)) ?? null
  const berjalan = pos.blok && realisasi.some((r) => r.id === pos.blok!.id && r.selesai == null)

  async function mulaiBlok(id: string) {
    const sisa = realisasi.filter((r) => r.id !== id)
    await db.sessions.update(sesi.id, {
      realisasiLatihan: [...sisa, { id, mulai: Date.now(), selesai: null }],
    })
  }

  async function selesaiBlok(id: string) {
    await db.sessions.update(sesi.id, {
      realisasiLatihan: realisasi.map((r) => (r.id === id ? { ...r, selesai: Date.now() } : r)),
    })
  }

  async function resetRealisasi() {
    await db.sessions.update(sesi.id, { realisasiLatihan: [] })
  }

  const sisa = pos.sisaBlok
  const lewat = sisa != null && sisa < 0

  return (
    <div
      data-kiosk-allow
      data-testid="pacu-latihan"
      className="fixed inset-0 z-[200] flex flex-col bg-slate-950 text-slate-100"
    >
      {/* Baris atas */}
      <div className="flex items-start gap-4 px-5 py-4 sm:px-8">
        <div className="min-w-0 flex-1">
          <p className="text-4xl font-semibold tabular-nums leading-none sm:text-6xl" data-testid="jam-pacu">
            {jam}
            <span className="ml-2 text-2xl text-slate-500 sm:text-3xl">
              :{String(detik).padStart(2, '0')}
            </span>
          </p>
          <p className="mt-1 truncate text-sm text-slate-400" data-testid="judul-sesi-pacu">
            {sesi.title} · {sesi.startTime}–{sesi.endTime}
          </p>
        </div>
        <button
          type="button"
          data-testid="tutup-pacu"
          onClick={onClose}
          className="shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 active:scale-[.97]"
        >
          Tutup
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-6 sm:px-8">
        {/* Penanda sesi: kapan sesinya sendiri mulai & selesai, terpisah dari blok */}
        <PenandaSesi s={sesi} />

        {/* Blok yang sedang berjalan */}
        <div
          data-testid="kartu-berjalan"
          data-blok={pos.blok?.id ?? ''}
          className={`rounded-2xl border p-4 sm:p-6 ${
            lewat ? 'border-rose-500/50 bg-rose-500/10' : 'border-emerald-500/40 bg-emerald-500/10'
          }`}
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {berjalan ? 'Sedang berjalan' : pos.fase === 'rampung' ? 'Selesai' : 'Seharusnya sekarang'}
          </p>
          {pos.blok ? (
            <>
              <p className="text-2xl font-semibold leading-tight sm:text-4xl" data-testid="blok-berjalan">
                {pos.blok.judul}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {LABEL_BLOK[pos.blok.jenis]} · rencana {pos.blok.menit} mnt
                {pos.blok.mulai != null && pos.blok.selesai != null
                  ? ` · ${jamDariMenit(pos.blok.mulai)}–${jamDariMenit(pos.blok.selesai)}`
                  : ''}
              </p>
              <p
                className={`mt-3 text-5xl font-semibold tabular-nums sm:text-7xl ${
                  lewat ? 'text-rose-300' : ''
                }`}
                data-testid="sisa-blok"
              >
                {sisa == null ? '—' : lewat ? `+${formatMenit(-sisa)}` : `${Math.round(sisa)}′`}
              </p>
              <p className="text-xs text-slate-500">
                {sisa == null ? 'tanpa waktu' : lewat ? 'sudah lewat dari jatahnya' : 'menit tersisa di blok ini'}
              </p>
            </>
          ) : (
            <p className="text-xl text-slate-400" data-testid="teks-tanpa-blok">
              {blok.length === 0
                ? 'Sesi ini belum punya rencana latihan.'
                : 'Di luar rentang rencana — blok belum mulai atau sudah rampung.'}
            </p>
          )}
        </div>

        {/* Geser & proyeksi — inti layar ini */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Geser dari rencana
              </p>
              <p
                data-testid="geser"
                data-geser={Math.round(pos.geser)}
                className={`mt-1 text-3xl font-semibold tabular-nums sm:text-4xl ${
                  pos.geser >= 1 ? 'text-rose-300' : pos.geser <= -1 ? 'text-emerald-300' : 'text-slate-200'
                }`}
              >
                {formatGeser(pos.geser)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Proyeksi selesai
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums sm:text-4xl" data-testid="proyeksi-selesai">
                {pos.proyeksiSelesai == null ? '—' : jamDariMenit(pos.proyeksiSelesai)}
              </p>
              <p className="text-xs text-slate-500">
                {pos.proyeksiSelesai == null
                  ? 'rencana tanpa jam'
                  : `rencana ${jamDariMenit(rencana[rencana.length - 1]?.selesai ?? 0)}`}
              </p>
            </div>
          </div>
          {pos.geser >= 1 && (
            <p className="mt-3 text-sm text-rose-200" data-testid="peringatan-geser">
              Keterlambatan ini menumpuk ke blok terakhir — kalau tidak dikejar,{' '}
              <b>bagian akhir akan kehabisan waktu</b>.
            </p>
          )}
        </div>

        {/* Tombol utama — besar, karena dipakai sambil berdiri */}
        {berikutnya || pos.blok ? (
          <div className="flex flex-wrap gap-3">
            {pos.blok && realisasi.some((r) => r.id === pos.blok!.id && r.selesai == null) ? (
              <button
                type="button"
                data-testid="tombol-selesai"
                onClick={() => selesaiBlok(pos.blok!.id)}
                className="flex-1 rounded-2xl bg-emerald-600 px-6 py-5 text-xl font-semibold text-white active:scale-[.98]"
              >
                Selesai — “{pos.blok.judul}”
              </button>
            ) : berikutnya ? (
              <button
                type="button"
                data-testid="tombol-mulai"
                onClick={() => mulaiBlok(berikutnya.id)}
                className="flex-1 rounded-2xl bg-sky-600 px-6 py-5 text-xl font-semibold text-white active:scale-[.98]"
              >
                Mulai — “{berikutnya.judul}”
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Daftar seluruh blok */}
        {rencana.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" data-testid="daftar-blok-pacu">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Rencana · {formatMenit(pos.totalRencana)}
              </p>
              {realisasi.length > 0 && (
                <button
                  type="button"
                  data-testid="reset-realisasi"
                  onClick={resetRealisasi}
                  className="rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-800 hover:text-rose-300"
                >
                  Ulangi pencatatan
                </button>
              )}
            </div>
            <ul className="space-y-1">
              {rencana.map((b) => {
                const r = realisasi.find((x) => x.id === b.id)
                const aktif = pos.blok?.id === b.id
                const sudah = r?.selesai != null
                return (
                  <li
                    key={b.id}
                    data-testid={`baris-blok-${b.id}`}
                    className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                      aktif ? 'bg-slate-800' : ''
                    }`}
                  >
                    <span className="w-6 shrink-0 text-right text-xs tabular-nums text-slate-600">
                      {b.urutan + 1}.
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-base ${
                          sudah ? 'text-slate-500 line-through' : 'text-slate-100'
                        }`}
                      >
                        {b.judul}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {LABEL_BLOK[b.jenis]} · {b.menit} mnt
                        {b.mulai != null && ` · ${jamDariMenit(b.mulai)}`}
                        {sudah && r && ` · nyata ${formatMenit((r.selesai! - r.mulai) / 60000)}`}
                      </span>
                    </span>
                    {!sudah && !aktif && (
                      <button
                        type="button"
                        data-testid={`mulai-${b.id}`}
                        onClick={() => mulaiBlok(b.id)}
                        className="shrink-0 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 active:scale-[.97]"
                      >
                        Mulai
                      </button>
                    )}
                    {aktif && r?.selesai == null && (
                      <button
                        type="button"
                        data-testid={`selesai-${b.id}`}
                        onClick={() => selesaiBlok(b.id)}
                        className="shrink-0 rounded-lg border border-emerald-600 px-2 py-1 text-xs text-emerald-300 active:scale-[.97]"
                      >
                        Selesai
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
