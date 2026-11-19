/**
 * H1 — Pacu latihan: layar yang menemani latihan **sedang berjalan**.
 *
 * Keluhan yang mendasarinya: *latihan sering melenceng dari rencana, dan
 * bagian akhir yang kehabisan waktu.* Melencengnya tidak terjadi sekaligus
 * — ia menumpuk sedikit demi sedikit, dan baru terasa ketika blok terakhir
 * tak kebagian waktu. Layar ini membuat penumpukan itu **tampil sedari awal**.
 *
 * v2.11 — Pacu v2. Rundown di lapangan selalu berubah, jadi layar ini kini
 * ikut berubah bersamanya:
 *
 * 1. **Selisih berpatokan pada jam nyata.** Apel yang molor dan jeda di
 *    antara blok ikut terhitung; blok yang dilewati tidak menghentikan
 *    hitungan.
 * 2. **Satu blok berjalan.** Menekan Mulai menutup blok sebelumnya.
 * 3. **Rundown boleh diubah di tempat** — lewati, ubah menit, blok tambahan,
 *    tukar urutan, bawa ke sesi berikutnya — dengan rencana awal dibekukan
 *    sebagai acuan dan setiap perubahan tercatat di jejak.
 * 4. **Usul potong** menurut prioritas blok saat terlambat, dan **laporan
 *    realisasi** yang bisa langsung disalin ke grup.
 *
 * Sengaja memakai tombol besar: layar ini dipakai sambil berdiri di
 * lapangan, bukan sambil duduk di depan laptop.
 */
import { useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { BlokLatihan, JenisBlok, Session } from '../db/types'
import { jamDariMenit } from '../lib/runsheet'
import { LABEL_BLOK, URUTAN_BLOK, formatGeser, formatMenit, ringkasLogRep, type BarisPacu } from '../lib/latihan'
import {
  LABEL_STATUS_LAPORAN,
  bawaKeSesi,
  batalCatat,
  epochJamSesi,
  jamEpoch,
  jamTitik,
  koreksiBlok,
  laporanRealisasi,
  lewatiBlok,
  mulaiBlok,
  pindahBlok,
  posisiSesi,
  selesaiBlok,
  sesiBerikutnya,
  tambahBlok,
  tandaSelisih,
  terapkanUsulan,
  ubahMenit,
  ulangSemua,
  usulPotong,
  type PerubahanPacu,
} from '../lib/pacu'
import { uid } from '../lib/utils'
import { PenandaSesi } from './PenandaSesi'
import { useSeksiAktif } from '../hooks/useSeksiAktif'

/** #35 — jalur paralel per seksi di blok: siapa, apa, bersama siapa, di mana. */
function JalurParalel({ b, besar }: { b: BlokLatihan | undefined; besar?: boolean }) {
  const seksi = useSeksiAktif()
  const cabang = b?.cabang ?? []
  if (!cabang.length) {
    const info = [b?.pelatih, b?.tempat].filter(Boolean).join(' · ')
    return info ? <p className={besar ? 'mt-1 text-sm text-slate-300' : 'block text-[11px] text-slate-500'}>{info}</p> : null
  }
  const nama = (id: string) => seksi.find((s) => s.id === id)?.label ?? id
  return (
    <ul data-testid="jalur-paralel" className={besar ? 'mt-3 grid gap-2 sm:grid-cols-2' : 'mt-0.5 space-y-0.5'}>
      {cabang.map((c) => (
        <li key={c.id} className={besar ? 'rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2' : 'text-[11px] text-slate-400'}>
          <span className={besar ? 'block text-xs font-semibold uppercase tracking-wide text-cyan-300' : 'font-semibold text-cyan-300/90'}>
            {c.seksi.map(nama).join(' + ') || '—'}
          </span>
          <span className={besar ? 'block text-base text-slate-100' : ''}>
            {besar ? '' : ': '}
            {c.judul || '—'}
          </span>
          {(c.pelatih || c.tempat) && (
            <span className={besar ? 'block text-xs text-slate-400' : ''}>
              {besar ? '' : ' · '}
              {[c.pelatih, c.tempat].filter(Boolean).join(' · ')}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Jam berjalan, diperbarui tiap detik. */
function pakaiJam() {
  const [kini, setKini] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setKini(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return {
    jam: `${String(kini.getHours()).padStart(2, '0')}:${String(kini.getMinutes()).padStart(2, '0')}`,
    detik: kini.getSeconds(),
    epoch: kini.getTime(),
  }
}

const WARNA_STATUS: Record<BarisPacu['status'], string> = {
  belum: 'text-slate-100',
  berjalan: 'text-emerald-200',
  selesai: 'text-slate-500 line-through',
  dilewati: 'text-slate-500 line-through decoration-amber-400/70',
  dibawa: 'text-slate-500 line-through decoration-sky-400/70',
  takTercatat: 'text-slate-500',
}

const LABEL_STATUS: Record<BarisPacu['status'], string> = {
  belum: '',
  berjalan: 'berjalan',
  selesai: 'selesai',
  dilewati: 'dilewati',
  dibawa: 'dibawa',
  takTercatat: 'tak tercatat',
}

const tombolKecil = 'shrink-0 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 active:scale-[.97] disabled:opacity-30'

export function PacuLatihan({ sesi, onClose, semuaSesi }: { sesi: Session; onClose: () => void; semuaSesi?: Session[] }) {
  const { jam, detik, epoch } = pakaiJam()
  const blok = sesi.rencanaLatihan ?? []
  const pos = useMemo(() => posisiSesi(sesi, epoch), [sesi, epoch])
  const usul = useMemo(() => usulPotong(pos), [pos])
  const tujuanBawa = useMemo(() => sesiBerikutnya(sesi, semuaSesi), [sesi, semuaSesi])
  const lap = useMemo(() => laporanRealisasi(sesi, pos), [sesi, pos])

  const [buka, setBuka] = useState<string | null>(null)
  const [formTambah, setFormTambah] = useState(false)
  const [yakinUlang, setYakinUlang] = useState(false)
  const [lapBuka, setLapBuka] = useState(false)
  const [tersalin, setTersalin] = useState(false)

  /**
   * Tulis perubahan dengan **ambil lalu simpan** rekaman segar — sama seperti
   * penanda sesi — supaya kunci yang dihapus (`rencanaAwal`) benar-benar hilang
   * dan perubahan dari tab lain tidak tertimpa data render lama.
   */
  async function tulis(buat: (segar: Session, kini: number) => PerubahanPacu) {
    const segar = await db.sessions.get(sesi.id)
    if (!segar) return
    const p = buat(segar, Date.now())
    if (!Object.keys(p).length) return
    const baru: Session = { ...segar }
    const rec = baru as unknown as Record<string, unknown>
    for (const [k, v] of Object.entries(p)) {
      if (v === undefined) delete rec[k]
      else rec[k] = v
    }
    await db.sessions.put(baru)
  }

  const mulai = (id: string) => tulis((s, t) => mulaiBlok(s, id, t))
  const selesai = (id: string) => tulis((s, t) => selesaiBlok(s, id, t))
  const lewati = (id: string) => tulis((s, t) => lewatiBlok(s, id, t))
  const pindah = (id: string, arah: -1 | 1) => tulis((s, t) => pindahBlok(s, id, arah, t))

  async function bawa(id: string) {
    if (!tujuanBawa) return
    await db.transaction('rw', db.sessions, async () => {
      const segar = await db.sessions.get(sesi.id)
      const tujuan = await db.sessions.get(tujuanBawa.id)
      if (!segar || !tujuan) return
      const h = bawaKeSesi(segar, id, tujuan, Date.now(), uid)
      if (!h) return
      await db.sessions.put({ ...segar, ...h.asal } as Session)
      await db.sessions.put({ ...tujuan, ...h.tujuan } as Session)
    })
    setBuka(null)
  }

  async function salinLaporan() {
    try {
      await navigator.clipboard.writeText(lap.teks)
    } catch {
      const t = document.createElement('textarea')
      t.value = lap.teks
      document.body.appendChild(t)
      t.select()
      document.execCommand('copy')
      t.remove()
    }
    setTersalin(true)
    setTimeout(() => setTersalin(false), 2000)
  }

  /** #31 — pengulangan blok yang dicatat otomatis oleh Mode Podium presenter. */
  const rep = useMemo(() => ringkasLogRep(sesi.logRep), [sesi.logRep])

  const berjalan = pos.berjalan
  const berikut = pos.berikut
  const sisa = pos.sisaBlok
  const lewat = sisa != null && sisa < 0
  const adaCatatan = pos.tercatat > 0
  const ujungSesi = (() => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(sesi.endTime ?? '')
    if (!m) return null
    let e = Number(m[1]) * 60 + Number(m[2])
    if (pos.mulaiAcuan != null && e < pos.mulaiAcuan) e += 1440
    return e
  })()
  const lewatSesi = pos.proyeksiSelesai != null && ujungSesi != null ? pos.proyeksiSelesai - ujungSesi : null

  const labelKartu = berjalan
    ? 'Sedang berjalan'
    : pos.fase === 'rampung'
      ? 'Selesai'
      : adaCatatan
        ? 'Jeda'
        : pos.blok
          ? 'Seharusnya sekarang'
          : 'Belum mulai'

  return (
    <div data-kiosk-allow data-testid="pacu-latihan" className="fixed inset-0 z-[200] flex flex-col bg-slate-950 text-slate-100">
      {/* Baris atas */}
      <div className="flex items-start gap-4 px-5 py-4 sm:px-8">
        <div className="min-w-0 flex-1">
          <p className="text-4xl font-semibold tabular-nums leading-none sm:text-6xl" data-testid="jam-pacu">
            {jam}
            <span className="ml-2 text-2xl text-slate-500 sm:text-3xl">:{String(detik).padStart(2, '0')}</span>
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

        {/* Blok yang sedang berjalan / jeda / seharusnya */}
        <div
          data-testid="kartu-berjalan"
          data-blok={pos.blok?.id ?? ''}
          data-keadaan={berjalan ? 'berjalan' : pos.fase === 'rampung' ? 'rampung' : adaCatatan ? 'jeda' : pos.blok ? 'rencana' : 'belum'}
          className={`rounded-2xl border p-4 sm:p-6 ${
            lewat
              ? 'border-rose-500/50 bg-rose-500/10'
              : adaCatatan && !berjalan && pos.fase !== 'rampung'
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'border-emerald-500/40 bg-emerald-500/10'
          }`}
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{labelKartu}</p>
          {pos.blok ? (
            <>
              <p className="text-2xl font-semibold leading-tight sm:text-4xl" data-testid="blok-berjalan">
                {pos.blok.judul}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {LABEL_BLOK[pos.blok.jenis]} · {pos.blok.menit} mnt
                {berjalan?.nyataMulai != null
                  ? ` · mulai ${jamDariMenit(berjalan.nyataMulai)} · sampai ${jamDariMenit(berjalan.nyataMulai + berjalan.menit)}`
                  : pos.blok.mulai != null && pos.blok.selesai != null
                    ? ` · ${jamDariMenit(pos.blok.mulai)}–${jamDariMenit(pos.blok.selesai)}`
                    : ''}
              </p>
              <JalurParalel b={blok.find((x) => x.id === pos.blok!.id)} besar />
              <p className={`mt-3 text-5xl font-semibold tabular-nums sm:text-7xl ${lewat ? 'text-rose-300' : ''}`} data-testid="sisa-blok">
                {sisa == null ? '—' : lewat ? `+${formatMenit(-sisa)}` : `${Math.round(sisa)}′`}
              </p>
              <p className="text-xs text-slate-500">
                {sisa == null ? 'tanpa waktu' : lewat ? 'sudah lewat dari jatahnya' : 'menit tersisa di blok ini'}
              </p>
              {!berjalan && berikut && berikut.id !== pos.blok.id && (
                <p className="mt-2 text-sm text-amber-200" data-testid="belum-ada-blok">
                  Belum ada blok yang dimulai. Berikutnya: <b>{berikut.judul}</b>.
                </p>
              )}
            </>
          ) : adaCatatan && berikut && pos.fase !== 'rampung' ? (
            <>
              <p className="text-2xl font-semibold leading-tight sm:text-4xl" data-testid="blok-berikut">
                Berikutnya: {berikut.judul}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {LABEL_BLOK[berikut.jenis]} · {berikut.menit} mnt
              </p>
              <p className="mt-3 text-5xl font-semibold tabular-nums text-amber-200 sm:text-7xl" data-testid="jeda">
                {Math.floor(pos.jeda ?? 0)}′
              </p>
              <p className="text-xs text-slate-500">jeda sejak blok terakhir selesai, ikut dihitung ke selisih</p>
            </>
          ) : (
            <p className="text-xl text-slate-400" data-testid="teks-tanpa-blok">
              {blok.length === 0
                ? 'Sesi ini belum punya rencana latihan.'
                : pos.fase === 'rampung'
                  ? 'Semua blok sudah dicatat.'
                  : berikut?.kiraMulai != null
                    ? `Blok pertama: ${berikut.judul}, mulai ${jamDariMenit(berikut.kiraMulai)}.`
                    : 'Di luar rentang rencana — blok belum mulai atau sudah rampung.'}
            </p>
          )}
        </div>

        {/* Geser & proyeksi — inti layar ini */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Selisih dari rencana</p>
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
            <div className="sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {pos.fase === 'rampung' && adaCatatan ? 'Selesai' : 'Proyeksi selesai'}
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums sm:text-4xl" data-testid="proyeksi-selesai">
                {pos.proyeksiSelesai == null ? '—' : jamDariMenit(pos.proyeksiSelesai)}
              </p>
              <p className="text-xs text-slate-500">
                {pos.target == null ? 'rencana tanpa jam' : `${sesi.rencanaAwal ? 'rencana awal' : 'rencana'} ${jamDariMenit(pos.target)}`}
              </p>
            </div>
          </div>
          {(pos.telatMulai != null && Math.round(pos.telatMulai) !== 0) || Math.round(pos.totalJeda) > 0 ? (
            <p className="mt-2 text-xs text-slate-400" data-testid="rincian-geser">
              {[
                pos.telatMulai != null && Math.round(pos.telatMulai) > 0 ? `mulai terlambat ${formatMenit(pos.telatMulai)}` : '',
                pos.telatMulai != null && Math.round(pos.telatMulai) < 0 ? `mulai lebih awal ${formatMenit(-pos.telatMulai)}` : '',
                Math.round(pos.totalJeda) > 0 ? `jeda antarblok ${formatMenit(pos.totalJeda)}` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
          {pos.geser >= 1 && pos.fase !== 'rampung' && (
            <p className="mt-3 text-sm text-rose-200" data-testid="peringatan-geser">
              Keterlambatan ini menumpuk ke blok terakhir — kalau tidak dikejar, <b>bagian akhir akan kehabisan waktu</b>.
              {lewatSesi != null && lewatSesi >= 1
                ? ` Proyeksinya ${formatMenit(lewatSesi)} melewati jam selesai sesi (${sesi.endTime}).`
                : ''}
            </p>
          )}

          {/* Usul potong menurut prioritas */}
          {pos.geser >= 1 && pos.fase !== 'rampung' && (usul.usulan.length > 0 || usul.sisa > 0) && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3" data-testid="usul-potong">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Usul supaya selesai tepat waktu</p>
              {usul.usulan.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-sm text-slate-200">
                  {usul.usulan.map((u) => (
                    <li key={u.blokId} data-testid={`usul-${u.blokId}`}>
                      {u.aksi === 'lewati' ? (
                        <>
                          Lewati <b>{u.judul}</b> ({u.dari} mnt)
                        </>
                      ) : (
                        <>
                          <b>{u.judul}</b> {u.dari} → {u.ke} mnt
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              {usul.sisa > 0 && (
                <p className="mt-1 text-xs text-amber-200" data-testid="usul-sisa">
                  Masih kurang {formatMenit(usul.sisa)}. Blok kunci tidak diusulkan untuk dipotong — putuskan bersama pelatih kepala.
                </p>
              )}
              {usul.usulan.length > 0 && (
                <button
                  type="button"
                  data-testid="terapkan-usulan"
                  onClick={() => tulis((s, t) => terapkanUsulan(s, usul.usulan, t))}
                  className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white active:scale-[.98]"
                >
                  Terapkan usulan
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tombol utama — besar, karena dipakai sambil berdiri */}
        {berjalan || berikut ? (
          <div className="flex flex-wrap gap-3">
            {berjalan ? (
              <>
                <button
                  type="button"
                  data-testid="tombol-selesai"
                  onClick={() => selesai(berjalan.id)}
                  className="flex-1 rounded-2xl bg-emerald-600 px-6 py-5 text-xl font-semibold text-white active:scale-[.98]"
                >
                  Selesai — “{berjalan.judul}”
                </button>
                {berikut && (
                  <button
                    type="button"
                    data-testid="tombol-lanjut"
                    onClick={() => mulai(berikut.id)}
                    className="flex-1 rounded-2xl border border-sky-600 px-6 py-5 text-xl font-semibold text-sky-200 active:scale-[.98]"
                  >
                    Lanjut ke “{berikut.judul}”
                  </button>
                )}
              </>
            ) : berikut ? (
              <>
                <button
                  type="button"
                  data-testid="tombol-mulai"
                  onClick={() => mulai(berikut.id)}
                  className="flex-1 rounded-2xl bg-sky-600 px-6 py-5 text-xl font-semibold text-white active:scale-[.98]"
                >
                  Mulai — “{berikut.judul}”
                </button>
                <button
                  type="button"
                  data-testid="tombol-lewati"
                  onClick={() => lewati(berikut.id)}
                  className="rounded-2xl border border-slate-700 px-5 py-5 text-base text-slate-300 active:scale-[.98]"
                >
                  Lewati
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {/* Daftar seluruh blok */}
        {pos.baris.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" data-testid="daftar-blok-pacu">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Rundown · {formatMenit(pos.totalRencana)}
                {sesi.rencanaAwal ? ` · rencana awal dibekukan ${jamEpoch(sesi.rencanaAwal.dibekukan)}` : ''}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="tombol-tambah"
                  onClick={() => setFormTambah((x) => !x)}
                  className="rounded px-2 py-1 text-[11px] text-sky-300 hover:bg-slate-800"
                >
                  + Blok tambahan
                </button>
                {adaCatatan &&
                  (yakinUlang ? (
                    <>
                      <button
                        type="button"
                        data-testid="reset-realisasi-yakin"
                        onClick={async () => {
                          await tulis((s, t) => ulangSemua(s, t))
                          setYakinUlang(false)
                        }}
                        className="rounded bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white"
                      >
                        Hapus semua catatan jam
                      </button>
                      <button type="button" onClick={() => setYakinUlang(false)} className="rounded px-2 py-1 text-[11px] text-slate-400">
                        Batal
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      data-testid="reset-realisasi"
                      onClick={() => setYakinUlang(true)}
                      className="rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-800 hover:text-rose-300"
                    >
                      Ulangi pencatatan
                    </button>
                  ))}
              </div>
            </div>
            {yakinUlang && (
              <p className="mb-2 text-xs text-rose-200">
                Semua jam mulai/selesai dan rencana awal akan dihapus. Untuk membetulkan satu blok saja, pakai tombol ⋯ lalu Koreksi.
              </p>
            )}
            {formTambah && (
              <FormTambah
                onBatal={() => setFormTambah(false)}
                onSimpan={async (isi) => {
                  await tulis((s, t) => tambahBlok(s, isi, t, uid))
                  setFormTambah(false)
                }}
              />
            )}
            <ul className="space-y-1">
              {pos.baris.map((b, i) => {
                const aktif = berjalan?.id === b.id
                const asli = blok.find((x) => x.id === b.id)
                const awal = sesi.rencanaAwal?.blok.find((x) => x.id === b.id)
                const tambahan = !!sesi.rencanaAwal && !awal
                const belum = b.status === 'belum'
                const bisaNaik = belum && i > 0 && pos.baris.slice(0, i).some((x) => x.status === 'belum')
                const bisaTurun = belum && pos.baris.slice(i + 1).some((x) => x.status === 'belum')
                const terbuka = buka === b.id
                return (
                  <li
                    key={b.id}
                    data-testid={`baris-blok-${b.id}`}
                    data-status={b.status}
                    className={`rounded-lg px-2 py-2 ${aktif ? 'bg-slate-800' : ''}`}
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-slate-600">{i + 1}.</span>
                      <span className="min-w-0 flex-1 basis-52">
                        <span className="block break-words text-base">
                          <span className={WARNA_STATUS[b.status]}>{b.judul}</span>
                          {b.prioritas === 'kunci' && (
                            <span className="ml-2 rounded border border-amber-500/40 px-1 text-[10px] text-amber-300">kunci</span>
                          )}
                          {b.prioritas === 'potong' && (
                            <span className="ml-2 rounded border border-slate-600 px-1 text-[10px] text-slate-400">potong dulu</span>
                          )}
                          {tambahan && (
                            <span className="ml-2 rounded border border-sky-500/40 px-1 text-[10px] text-sky-300">tambahan</span>
                          )}
                        </span>
                        <span className="block text-[11px] text-slate-500" data-testid={`info-blok-${b.id}`}>
                          {LABEL_BLOK[b.jenis]} · {b.menit} mnt
                          {awal && awal.menit !== b.menit ? ` (awal ${awal.menit})` : ''}
                          {b.status === 'selesai' && b.nyataMulai != null && b.nyataSelesai != null
                            ? ` · nyata ${jamDariMenit(b.nyataMulai)}–${jamDariMenit(b.nyataSelesai)} (${Math.round(b.nyataMenit ?? 0)} mnt, ${tandaSelisih((b.nyataMenit ?? 0) - (awal?.menit ?? b.menit))})`
                            : ''}
                          {/* Jam mulai–sampai dibuat lebih terang supaya pencatat waktu cukup melirik jam HP. */}
                          {b.status === 'berjalan' && b.nyataMulai != null ? (
                            <>
                              {' · '}
                              <span className="tabular-nums text-slate-200" data-testid={`jam-blok-${b.id}`}>
                                mulai {jamDariMenit(b.nyataMulai)} · sampai {jamDariMenit(b.nyataMulai + b.menit)}
                              </span>
                            </>
                          ) : b.status === 'belum' && (b.kiraMulai != null || b.mulai != null) ? (
                            <>
                              {' · '}
                              <span className="tabular-nums text-slate-300" data-testid={`jam-blok-${b.id}`}>
                                {b.kiraMulai != null
                                  ? `±${jamDariMenit(b.kiraMulai)}–${jamDariMenit(b.kiraSelesai ?? b.kiraMulai + b.menit)}`
                                  : `${jamDariMenit(b.mulai!)}–${jamDariMenit(b.selesai ?? b.mulai! + b.menit)}`}
                              </span>
                            </>
                          ) : null}
                          {LABEL_STATUS[b.status] && b.status !== 'selesai' && b.status !== 'berjalan'
                            ? ` · ${LABEL_STATUS[b.status]}`
                            : ''}
                          {b.status === 'dibawa' && b.dibawaKe
                            ? ` ke ${semuaSesi?.find((x) => x.id === b.dibawaKe)?.title ?? 'sesi lain'}`
                            : ''}
                        </span>
                        {belum && <JalurParalel b={asli} />}
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-1">
                        {belum && (
                          <>
                            <button
                              type="button"
                              data-testid={`naik-${b.id}`}
                              disabled={!bisaNaik}
                              onClick={() => pindah(b.id, -1)}
                              className={tombolKecil}
                              title="Majukan"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              data-testid={`turun-${b.id}`}
                              disabled={!bisaTurun}
                              onClick={() => pindah(b.id, 1)}
                              className={tombolKecil}
                              title="Mundurkan"
                            >
                              ↓
                            </button>
                            <button type="button" data-testid={`mulai-${b.id}`} onClick={() => mulai(b.id)} className={tombolKecil}>
                              Mulai
                            </button>
                          </>
                        )}
                        {aktif && (
                          <button
                            type="button"
                            data-testid={`selesai-${b.id}`}
                            onClick={() => selesai(b.id)}
                            className="shrink-0 rounded-lg border border-emerald-600 px-2 py-1 text-xs text-emerald-300 active:scale-[.97]"
                          >
                            Selesai
                          </button>
                        )}
                        <button
                          type="button"
                          data-testid={`menu-${b.id}`}
                          aria-expanded={terbuka}
                          onClick={() => setBuka(terbuka ? null : b.id)}
                          className={tombolKecil}
                          title="Ubah, lewati, bawa, atau koreksi"
                        >
                          ⋯
                        </button>
                      </span>
                    </div>
                    {terbuka && (
                      <PanelBlok
                        b={b}
                        sesi={sesi}
                        tujuanBawa={tujuanBawa}
                        onTutup={() => setBuka(null)}
                        onLewati={() => lewati(b.id).then(() => setBuka(null))}
                        onUbahMenit={(n) => tulis((s, t) => ubahMenit(s, b.id, n, t))}
                        onBawa={() => bawa(b.id)}
                        onKoreksi={(mulaiE, selesaiE) =>
                          tulis((s, t) => koreksiBlok(s, b.id, { mulai: mulaiE, selesai: selesaiE }, t)).then(() => setBuka(null))
                        }
                        onBatalCatat={() => tulis((s, t) => batalCatat(s, b.id, t)).then(() => setBuka(null))}
                        onMulaiUlang={() => mulai(b.id).then(() => setBuka(null))}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Laporan realisasi — pengganti lembar catatan jam di kertas */}
        {pos.baris.length > 0 && (adaCatatan || (sesi.jejakPacu?.length ?? 0) > 0) && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" data-testid="laporan-realisasi">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                data-testid="buka-laporan"
                aria-expanded={lapBuka || pos.fase === 'rampung'}
                onClick={() => setLapBuka((x) => !x)}
                className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
              >
                Laporan realisasi {lapBuka || pos.fase === 'rampung' ? '▾' : '▸'}
              </button>
              <button
                type="button"
                data-testid="salin-laporan"
                onClick={salinLaporan}
                className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-200 active:scale-[.97]"
              >
                {tersalin ? 'Tersalin' : 'Salin laporan'}
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-300" data-testid="ringkas-laporan">
              Rencana{' '}
              {lap.rencanaMulai != null && lap.rencanaSelesai != null
                ? `${jamTitik(lap.rencanaMulai)}–${jamTitik(lap.rencanaSelesai)}`
                : '—'}{' '}
              · nyata{' '}
              {lap.nyataMulai != null ? `${jamTitik(lap.nyataMulai)}–${lap.nyataSelesai != null ? jamTitik(lap.nyataSelesai) : '…'}` : '—'}
              {' · '}
              {lap.hitung.selesai} selesai
              {lap.hitung.dilewati ? `, ${lap.hitung.dilewati} dilewati` : ''}
              {lap.hitung.dibawa ? `, ${lap.hitung.dibawa} dibawa` : ''}
              {lap.hitung.tambahan ? `, ${lap.hitung.tambahan} tambahan` : ''}
              {lap.kunci.total ? ` · kunci ${lap.kunci.terlaksana}/${lap.kunci.total}` : ''}
            </p>
            {(lapBuka || pos.fase === 'rampung') && (
              <div className="mt-3 space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs" data-testid="tabel-laporan">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="py-1 pr-2">#</th>
                        <th className="py-1 pr-2">Blok</th>
                        <th className="py-1 pr-2">Rencana</th>
                        <th className="py-1 pr-2">Nyata</th>
                        <th className="py-1 pr-2 text-right">Selisih</th>
                        <th className="py-1">Keadaan</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-200">
                      {lap.baris.map((r) => (
                        <tr key={r.id} className="border-t border-slate-800" data-testid={`laporan-${r.id}`}>
                          <td className="py-1 pr-2 tabular-nums text-slate-500">{r.no}</td>
                          <td className="py-1 pr-2">
                            {r.judul}
                            {r.prioritas === 'kunci' ? <span className="ml-1 text-amber-300">•</span> : null}
                          </td>
                          <td className="py-1 pr-2 tabular-nums">
                            {r.rencanaMenit == null
                              ? `tambahan ${r.menitDiubah ?? ''}′`
                              : `${r.rencanaMulai != null ? jamTitik(r.rencanaMulai) + ' · ' : ''}${r.rencanaMenit}′${r.menitDiubah != null ? ` → ${r.menitDiubah}′` : ''}`}
                          </td>
                          <td className="py-1 pr-2 tabular-nums">
                            {r.nyataMulai != null
                              ? `${jamTitik(r.nyataMulai)}–${r.nyataSelesai != null ? jamTitik(r.nyataSelesai) : '…'}${r.nyataMenit != null ? ` · ${Math.round(r.nyataMenit)}′` : ''}`
                              : '—'}
                          </td>
                          <td
                            className={`py-1 pr-2 text-right tabular-nums ${r.selisih != null && r.selisih >= 1 ? 'text-rose-300' : r.selisih != null && r.selisih <= -1 ? 'text-emerald-300' : ''}`}
                          >
                            {r.selisih == null ? '' : tandaSelisih(r.selisih)}
                          </td>
                          <td className="py-1 text-slate-400">{LABEL_STATUS_LAPORAN[r.status]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {lap.jejak.length > 0 && (
                  <div data-testid="jejak-pacu">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Perubahan</p>
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-300">
                      {lap.jejak.map((j, k) => (
                        <li key={`${j.waktu}-${k}`} data-testid="baris-jejak">
                          <span className="tabular-nums text-slate-500">{jamEpoch(j.waktu)}</span> {j.teks}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* #31 — Rep Counter: ringkasan pengulangan blok dari presenter (catatan staf) */}
        {rep.baris.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4" data-testid="log-rep-pacu">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pengulangan blok · {rep.total}×</p>
              <button
                type="button"
                data-testid="reset-log-rep"
                onClick={() => db.sessions.update(sesi.id, { logRep: [] })}
                className="rounded px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-800 hover:text-rose-300"
              >
                Kosongkan
              </button>
            </div>
            <ul className="space-y-1">
              {rep.baris.map((r) => (
                <li
                  key={`${r.drillId}-${r.dari}-${r.sampai}`}
                  data-testid="baris-log-rep"
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {r.namaDrill || 'Drill'} · <b>{r.label}</b>
                  </span>
                  <span className="shrink-0 tabular-nums text-amber-300">×{r.kali}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/** Form blok tambahan (darurat): judul, menit, ranah. */
function FormTambah({
  onSimpan,
  onBatal,
}: {
  onSimpan: (isi: { judul: string; menit: number; jenis: JenisBlok }) => void
  onBatal: () => void
}) {
  const [judul, setJudul] = useState('')
  const [menit, setMenit] = useState('5')
  const [jenis, setJenis] = useState<JenisBlok>('lainnya')
  const n = Math.round(Number(menit))
  const sah = judul.trim() !== '' && Number.isFinite(n) && n > 0
  return (
    <form
      data-testid="form-tambah"
      className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (sah) onSimpan({ judul: judul.trim(), menit: n, jenis })
      }}
    >
      <label className="min-w-[10rem] flex-1 text-[11px] text-slate-400">
        Judul
        <input
          data-testid="tambah-judul"
          value={judul}
          onChange={(e) => setJudul(e.target.value)}
          placeholder="mis. Briefing hujan"
          className="mt-0.5 block w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
        />
      </label>
      <label className="w-20 text-[11px] text-slate-400">
        Menit
        <input
          data-testid="tambah-menit"
          type="number"
          min={1}
          value={menit}
          onChange={(e) => setMenit(e.target.value)}
          className="mt-0.5 block w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
        />
      </label>
      <label className="w-36 text-[11px] text-slate-400">
        Ranah
        <select
          data-testid="tambah-jenis"
          value={jenis}
          onChange={(e) => setJenis(e.target.value as JenisBlok)}
          className="mt-0.5 block w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
        >
          {URUTAN_BLOK.map((t) => (
            <option key={t} value={t}>
              {LABEL_BLOK[t]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        data-testid="tambah-simpan"
        disabled={!sah}
        className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        Tambahkan
      </button>
      <button type="button" onClick={onBatal} className="rounded-lg px-2 py-1.5 text-sm text-slate-400">
        Batal
      </button>
      <p className="w-full text-[11px] text-slate-500">
        Masuk tepat sesudah blok yang sedang berjalan, dan menit tambahannya ikut dihitung ke selisih.
      </p>
    </form>
  )
}

/** Panel ⋯ satu blok: ubah menit, lewati, bawa, atau koreksi jam nyata. */
function PanelBlok({
  b,
  sesi,
  tujuanBawa,
  onTutup,
  onLewati,
  onUbahMenit,
  onBawa,
  onKoreksi,
  onBatalCatat,
  onMulaiUlang,
}: {
  b: BarisPacu
  sesi: Session
  tujuanBawa: Session | null
  onTutup: () => void
  onLewati: () => void
  onUbahMenit: (n: number) => void
  onBawa: () => void
  onKoreksi: (mulai: number, selesai: number | null) => void
  onBatalCatat: () => void
  onMulaiUlang: () => void
}) {
  const [menit, setMenit] = useState(String(b.menit))
  const jamAwal = (m: number | null) => (m == null ? '' : jamDariMenit(m))
  const [jMulai, setJMulai] = useState(jamAwal(b.nyataMulai))
  const [jSelesai, setJSelesai] = useState(jamAwal(b.nyataSelesai))
  const belum = b.status === 'belum'
  const berjalan = b.status === 'berjalan'
  const nMenit = Math.round(Number(menit))
  const eMulai = jMulai ? epochJamSesi(sesi.date, jMulai, sesi.startTime) : null
  const eSelesai = jSelesai ? epochJamSesi(sesi.date, jSelesai, sesi.startTime) : null
  const koreksiSah = eMulai != null && (eSelesai == null ? berjalan || !jSelesai : eSelesai >= eMulai)

  return (
    <div data-testid={`panel-pacu-${b.id}`} className="mt-2 space-y-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm">
      {(belum || berjalan) && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="w-24 text-[11px] text-slate-400">
            Menit
            <input
              data-testid={`ubah-menit-${b.id}`}
              type="number"
              min={1}
              value={menit}
              onChange={(e) => setMenit(e.target.value)}
              className="mt-0.5 block w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            />
          </label>
          <button
            type="button"
            data-testid={`simpan-menit-${b.id}`}
            disabled={!Number.isFinite(nMenit) || nMenit <= 0 || nMenit === b.menit}
            onClick={() => onUbahMenit(nMenit)}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-100 disabled:opacity-40"
          >
            Ubah menit
          </button>
          {belum && (
            <>
              <button
                type="button"
                data-testid={`lewati-${b.id}`}
                onClick={onLewati}
                className="rounded-lg border border-amber-600/60 px-3 py-1.5 text-sm text-amber-200"
              >
                Lewati
              </button>
              <button
                type="button"
                data-testid={`bawa-${b.id}`}
                disabled={!tujuanBawa}
                onClick={onBawa}
                className="rounded-lg border border-sky-600/60 px-3 py-1.5 text-sm text-sky-200 disabled:opacity-40"
                title={tujuanBawa ? '' : 'Belum ada sesi sesudah sesi ini di jadwal'}
              >
                {tujuanBawa
                  ? `Bawa ke ${tujuanBawa.title} (${tujuanBawa.date.slice(8)}/${tujuanBawa.date.slice(5, 7)})`
                  : 'Bawa ke sesi berikutnya'}
              </button>
            </>
          )}
        </div>
      )}

      {!belum && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {b.status === 'takTercatat' || b.status === 'dilewati' || b.status === 'dibawa' ? 'Catat jam nyata' : 'Koreksi jam nyata'}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[11px] text-slate-400">
              Mulai
              <input
                data-testid={`koreksi-mulai-${b.id}`}
                type="time"
                value={jMulai}
                onChange={(e) => setJMulai(e.target.value)}
                className="mt-0.5 block w-28 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>
            <label className="text-[11px] text-slate-400">
              Selesai
              <input
                data-testid={`koreksi-selesai-${b.id}`}
                type="time"
                value={jSelesai}
                onChange={(e) => setJSelesai(e.target.value)}
                className="mt-0.5 block w-28 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
              />
            </label>
            <button
              type="button"
              data-testid={`koreksi-simpan-${b.id}`}
              disabled={!koreksiSah}
              onClick={() => eMulai != null && onKoreksi(eMulai, eSelesai)}
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-100 disabled:opacity-40"
            >
              Simpan jam
            </button>
            {b.status !== 'takTercatat' && (
              <button
                type="button"
                data-testid={`batal-catat-${b.id}`}
                onClick={onBatalCatat}
                className="rounded-lg px-2 py-1.5 text-sm text-rose-300"
              >
                {b.status === 'dilewati' || b.status === 'dibawa' ? 'Batalkan lewati' : 'Hapus catatan blok ini'}
              </button>
            )}
            {(b.status === 'dilewati' || b.status === 'takTercatat') && (
              <button
                type="button"
                data-testid={`mulai-ulang-${b.id}`}
                onClick={onMulaiUlang}
                className="rounded-lg border border-sky-600/60 px-2 py-1.5 text-sm text-sky-200"
              >
                Mulai sekarang
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            {b.status === 'dibawa'
              ? 'Membatalkan tanda dibawa tidak menghapus salinannya di sesi tujuan — hapus di sana bila perlu.'
              : 'Hanya blok ini yang berubah; catatan blok lain tetap. Kosongkan Selesai bila blok masih berjalan.'}
          </p>
        </div>
      )}
      <button type="button" onClick={onTutup} className="text-[11px] text-slate-500">
        Tutup
      </button>
    </div>
  )
}

export default PacuLatihan
