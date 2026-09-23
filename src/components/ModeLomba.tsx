/**
 * G2 — Mode lomba: tampilan hari ini **saat ini juga**.
 *
 * G1 menjawab "apakah rencananya muat"; ini menjawab "di mana kita sekarang,
 * dan apa yang harus disiapkan berikutnya". Ditampilkan sebesar mungkin
 * supaya terbaca dari seberang ruang persiapan — karena pada hari lomba
 * layar ini diletakkan di sudut ruangan, bukan dipegang.
 *
 * Jamnya berjalan sendiri tiap detik. Semua keputusan "apa yang tampil"
 * dihitung oleh `posisiHari` (murni, teruji di node), jadi tampilan ini
 * hanya menyajikan.
 */
import { useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { ChecklistItem, SetList, Song } from '../db/types'
import { LABEL_JENIS, formatDetik, jamDariMenit } from '../lib/runsheet'
import type { RunSheet } from '../lib/runsheet'
import { formatHitungMundur, formatMenit, posisiHari } from '../lib/lomba'
import { hitungSetList } from '../lib/setlist'

/** Menit & detik saat ini — diperbarui tiap detik. */
function pakaiJam() {
  const [kini, setKini] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setKini(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return {
    menit: kini.getHours() * 60 + kini.getMinutes(),
    detik: kini.getSeconds(),
    jam: `${String(kini.getHours()).padStart(2, '0')}:${String(kini.getMinutes()).padStart(2, '0')}`,
  }
}

export function ModeLomba({
  run,
  songs,
  setlists,
  onClose,
}: {
  run: RunSheet
  songs: Song[]
  setlists: SetList[]
  onClose: () => void
}) {
  const { menit, detik, jam } = pakaiJam()
  const pos = useMemo(() => posisiHari(run, menit), [run, menit])

  // Hitung munduk ke sesi berikutnya, dalam detik — ikut detik jam sungguhan
  // supaya angkanya benar-benar berdetak, bukan melompat per menit.
  const sisaDetik =
    pos.berikutnya && pos.berikutnya.mulai != null
      ? Math.max(0, (pos.berikutnya.mulai - menit) * 60 - detik)
      : null

  const tampil = pos.tampilan
  const sl = tampil?.setListId ? setlists.find((s) => s.id === tampil.setListId) : undefined
  const hitung = sl ? hitungSetList(sl, songs) : null

  const ubahCentang = async (sesiId: string, daftar: ChecklistItem[]) => {
    await db.sessions.update(sesiId, { checklist: daftar })
  }

  return (
    <div
      data-kiosk-allow
      data-testid="mode-lomba"
      className="fixed inset-0 z-[200] flex flex-col bg-slate-950 text-slate-100"
    >
      {/* Baris atas: jam besar, tanggal, tutup */}
      <div className="flex items-start gap-4 px-5 py-4 sm:px-8">
        <div className="min-w-0 flex-1">
          <p
            className="text-4xl font-semibold tabular-nums leading-none sm:text-6xl"
            data-testid="jam-besar"
          >
            {jam}
            <span className="ml-2 text-2xl text-slate-500 sm:text-3xl">
              :{String(detik).padStart(2, '0')}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500" data-testid="fase-hari" data-fase={pos.fase}>
            {run.baris.length} sesi · {pos.sudahLewat} sudah lewat
          </p>
        </div>
        <button
          type="button"
          data-testid="tutup-lomba"
          onClick={onClose}
          className="shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 active:scale-[.97]"
        >
          Tutup
        </button>
      </div>

      {/* Isi utama */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-6 sm:px-8">
        {/* Sesi yang sedang berjalan */}
        {pos.sekarang ? (
          <Kartu
            judul="Sedang berjalan"
            testId="kartu-sekarang"
            aksen="border-emerald-500/40 bg-emerald-500/10"
          >
            <p className="text-2xl font-semibold leading-tight sm:text-4xl">
              {pos.sekarang.judul}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {LABEL_JENIS[pos.sekarang.jenis]}
              {pos.sekarang.tempat ? ` · ${pos.sekarang.tempat}` : ''} ·{' '}
              {jamDariMenit(pos.sekarang.mulai ?? 0)}–{jamDariMenit(pos.sekarang.selesai ?? 0)}
            </p>
            <p className="mt-3 text-5xl font-semibold tabular-nums sm:text-7xl" data-testid="sisa-slot">
              {pos.sisaSlot != null ? `${pos.sisaSlot}′` : '—'}
            </p>
            <p className="text-xs text-slate-500">menit tersisa di slot ini</p>
          </Kartu>
        ) : (
          <Kartu
            judul="Sedang berjalan"
            testId="kartu-sekarang"
            aksen="border-slate-800 bg-slate-900/60"
          >
            <p className="text-xl text-slate-400" data-testid="teks-senggang">
              {pos.fase === 'rampung'
                ? 'Semua sesi hari ini sudah selesai.'
                : pos.fase === 'belumMulai'
                  ? 'Hari belum dimulai.'
                  : 'Waktu senggang — di antara dua sesi.'}
            </p>
          </Kartu>
        )}

        {/* Berikutnya + hitung mundur */}
        {pos.berikutnya ? (
          <Kartu judul="Berikutnya" testId="kartu-berikutnya" aksen="border-sky-500/40 bg-sky-500/10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-2xl font-semibold leading-tight sm:text-3xl" data-testid="judul-berikutnya">
                  {pos.berikutnya.judul}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {jamDariMenit(pos.berikutnya.mulai ?? 0)} · {LABEL_JENIS[pos.berikutnya.jenis]}
                  {pos.berikutnya.tempat ? ` · ${pos.berikutnya.tempat}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-4xl font-semibold tabular-nums sm:text-5xl" data-testid="hitung-mundur">
                  {sisaDetik != null ? formatHitungMundur(sisaDetik) : '—'}
                </p>
                <p className="text-xs text-slate-500">
                  {pos.menitKeBerikutnya != null ? `lagi ${formatMenit(pos.menitKeBerikutnya)}` : ''}
                </p>
              </div>
            </div>
            {pos.berikutnya.catatan && (
              <p className="mt-2 text-sm text-slate-300">{pos.berikutnya.catatan}</p>
            )}
          </Kartu>
        ) : null}

        {/* Yang perlu dipersiapkan: set list penampilan terdekat */}
        {tampil && sl ? (
          <Kartu
            judul={`Disiapkan — ${sl.name}`}
            testId="kartu-setlist"
            aksen="border-amber-500/30 bg-amber-500/5"
          >
            <p className="mb-2 text-xs text-slate-400">
              {tampil.judul} · total {formatDetik(hitung?.total ?? 0)}
              {hitung?.tanpaPanjang ? ' (perkiraan — ada lagu tanpa panjang)' : ''}
            </p>
            <ol className="space-y-1" data-testid="daftar-lagu">
              {(hitung?.baris ?? []).map((b, i) => (
                <li key={b.id} className="flex items-baseline gap-3 text-lg sm:text-xl">
                  <span className="w-6 shrink-0 text-right text-sm tabular-nums text-slate-500">
                    {i + 1}.
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-100">{b.judul}</span>
                  <span className="shrink-0 text-sm tabular-nums text-slate-500">
                    {b.detik != null ? formatDetik(b.detik) : '—'}
                  </span>
                </li>
              ))}
            </ol>
          </Kartu>
        ) : null}

        {/* Checklist sesi yang sedang / berikutnya */}
        <DaftarPeriksa
          sesi={pos.sekarang ?? pos.berikutnya}
          onChange={ubahCentang}
        />

        {/* Peringatan rencana tetap tampil: kalau sesuatu tidak muat,
            hari H adalah saat terakhir ia berguna. */}
        {run.peringatan.length > 0 && (
          <div
            className="rounded-2xl border border-amber-600/40 bg-amber-950/20 p-4"
            data-testid="peringatan-lomba"
          >
            <p className="mb-1 text-sm font-semibold text-amber-300">Perhatian</p>
            <ul className="space-y-0.5">
              {run.peringatan.map((p, i) => (
                <li key={i} className="text-xs text-amber-100/90">
                  • {p}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function Kartu({
  judul,
  aksen,
  children,
  testId,
}: {
  judul: string
  aksen: string
  children: React.ReactNode
  testId: string
}) {
  return (
    <div className={`rounded-2xl border p-4 sm:p-6 ${aksen}`} data-testid={testId}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {judul}
      </p>
      {children}
    </div>
  )
}

function DaftarPeriksa({
  sesi,
  onChange,
}: {
  sesi: { id: string; checklist: ChecklistItem[] } | null
  onChange: (id: string, daftar: ChecklistItem[]) => void
}) {
  if (!sesi || !sesi.checklist.length) return null
  const selesai = sesi.checklist.filter((c) => c.done).length
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" data-testid="kartu-periksa">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Persiapan · {selesai}/{sesi.checklist.length}
      </p>
      <ul className="space-y-1">
        {sesi.checklist.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1 hover:bg-slate-800/50">
              <input
                type="checkbox"
                data-testid={`centang-${c.id}`}
                checked={Boolean(c.done)}
                onChange={() =>
                  onChange(
                    sesi.id,
                    sesi.checklist.map((x) =>
                      x.id === c.id ? { ...x, done: x.done ? 0 : 1 } : x,
                    ),
                  )
                }
                className="h-5 w-5 accent-emerald-500"
              />
              <span className={c.done ? 'text-slate-500 line-through' : 'text-slate-100'}>
                {c.text}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
