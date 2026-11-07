/**
 * #31 — Panel Mode Podium di dalam `DrillPresenter`.
 *
 * Bukan pemutar tandingan: panel ini hanya **mengendalikan** mesin presenter
 * (indeks set, urutan latihan, klik, tempo latihan #4) lewat callback.
 * Isinya disusun menurut urutan pikir Gitapati di menara:
 *   1. dari mana (Set ↔ Huruf ↔ Birama) dan sampai set berapa,
 *   2. tempo berapa (70–100%),
 *   3. count-in apa (Standby + Mark Time, klik lapangan #29),
 *   4. papan aba-aba 40 m sekali ketuk,
 *   5. sudah berapa kali blok ini diulang (Rep Counter).
 */
import { useLayoutEffect, useRef, useState } from 'react'
import type { DrillSet, LogRepSet } from '../../db/types'
import {
  ISYARAT_PODIUM,
  PALET_PLAKAT,
  PERSEN_PODIUM,
  PILIHAN_MARK_TIME,
  PILIHAN_STANDBY,
  PROFIL_PODIUM,
  URUTAN_PALET,
  barisPlakat,
  rapikanTeksPlakat,
  setUntukBirama,
  teksPlakatHuruf,
  teksPlakatRentang,
  teksPlakatReset,
  ukuranHurufPlakat,
} from '../../lib/podium'
import type { HurufLatihan, LangkahHitungMasuk, PaletPlakat, ProfilPodium, SetelanPodium } from '../../lib/podium'
import { LABEL_TAHAP } from '../../lib/podium'
import { ringkasLogRep } from '../../lib/latihan'

const LABEL_PROFIL: Record<ProfilPodium, string> = { drbeat: 'Dr. Beat', cowbell: 'Cowbell', rim: 'Rim' }

type Pemilih = 'set' | 'huruf' | 'birama'

export function PanelPodium({
  sets,
  idx,
  sampai,
  onLompat,
  onSampai,
  huruf,
  petaBirama,
  adaLagu,
  persen,
  onPersen,
  setelan,
  onSetelan,
  berjalan,
  onMulai,
  onPlakat,
  logRep,
  namaSesi,
}: {
  sets: DrillSet[]
  idx: number
  /** indeks set akhir blok (0-based, > idx) */
  sampai: number
  onLompat: (i: number) => void
  onSampai: (i: number) => void
  huruf: HurufLatihan[]
  petaBirama: { biramaDari: number; biramaSampai: number }[] | null
  adaLagu: boolean
  /** persen tempo latihan yang berlaku; `null` bila mode BPM (bukan persen) */
  persen: number | null
  onPersen: (p: number) => void
  setelan: SetelanPodium
  onSetelan: (s: SetelanPodium) => void
  /** count-in atau urutan blok sedang berjalan */
  berjalan: boolean
  onMulai: () => void
  onPlakat: (teks: string) => void
  logRep: LogRepSet[]
  /** judul sesi hari ini tempat hitungan disimpan; `null` = tidak ada sesi */
  namaSesi: string | null
}) {
  const [pemilih, setPemilih] = useState<Pemilih>('set')
  const [birama, setBirama] = useState('')
  const [hasil, setHasil] = useState<string | null>(null)
  const [kustom, setKustom] = useState('')
  const nama = (i: number) => sets[i]?.name || `Set ${i + 1}`
  const p = persen ?? 100
  const rep = ringkasLogRep(logRep)

  function lompatKeBirama() {
    const b = Math.floor(Number(birama))
    if (!petaBirama || !Number.isFinite(b) || b < 1) {
      setHasil('Isi nomor birama yang sah.')
      return
    }
    const i = setUntukBirama(petaBirama, b)
    if (i < 0) return
    onLompat(i)
    const r = petaBirama[i]
    setHasil(`Birama ${b} → ${nama(i)} (birama ${r.biramaDari}–${r.biramaSampai})`)
  }

  const tab = (k: Pemilih, label: string) => (
    <button
      type="button"
      data-testid={`podium-tab-${k}`}
      onClick={() => setPemilih(k)}
      className={
        'flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ' +
        (pemilih === k ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-300')
      }
    >
      {label}
    </button>
  )
  const tombolKecil = (aktif: boolean) =>
    'min-w-[2.75rem] rounded-lg border px-2 py-1.5 text-xs font-semibold tabular-nums active:scale-[.97] ' +
    (aktif ? 'border-amber-400 bg-amber-400 text-slate-950' : 'border-slate-700 bg-slate-900 text-slate-300')

  return (
    <div className="flex flex-col gap-3 text-slate-100" data-testid="panel-podium">
      {/* 1 — Dari mana */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-2">
        <div className="mb-2 flex gap-1">
          {tab('set', 'Set')}
          {tab('huruf', 'Huruf latihan')}
          {tab('birama', 'Birama')}
        </div>
        {pemilih === 'set' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1">
              Dari
              <select
                data-testid="podium-pilih-dari"
                value={idx}
                onChange={(e) => onLompat(Number(e.target.value))}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
              >
                {sets.map((s, i) => (
                  <option key={s.id} value={i}>
                    {i + 1}. {s.name || `Set ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              sampai
              <select
                data-testid="podium-pilih-sampai"
                value={sampai}
                onChange={(e) => onSampai(Number(e.target.value))}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
              >
                {sets.map((s, i) =>
                  i > idx ? (
                    <option key={s.id} value={i}>
                      {i + 1}. {s.name || `Set ${i + 1}`}
                    </option>
                  ) : null,
                )}
              </select>
            </label>
          </div>
        )}
        {pemilih === 'huruf' &&
          (!adaLagu ? (
            <p className="text-xs text-slate-400">Tautkan drill ke lagu agar huruf latihan bisa dipakai.</p>
          ) : huruf.length === 0 ? (
            <p className="text-xs text-slate-400" data-testid="podium-huruf-kosong">
              Lagu ini belum punya huruf latihan. Beri label segmen di tempo map (mis. A, B, C) atau impor MusicXML.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {huruf.map((h, i) => {
                const keSet = petaBirama ? setUntukBirama(petaBirama, h.birama) : -1
                return (
                  <button
                    key={`${h.label}-${h.birama}`}
                    type="button"
                    data-testid={`podium-huruf-${i}`}
                    disabled={keSet < 0}
                    onClick={() => {
                      onLompat(keSet)
                      setHasil(`Huruf ${h.label} (birama ${h.birama}) → ${nama(keSet)}`)
                    }}
                    className={tombolKecil(keSet === idx) + ' disabled:opacity-40'}
                  >
                    {h.label}
                    <span className="ml-1 font-normal opacity-70">b.{h.birama}</span>
                  </button>
                )
              })}
            </div>
          ))}
        {pemilih === 'birama' &&
          (!adaLagu || !petaBirama ? (
            <p className="text-xs text-slate-400">Tautkan drill ke lagu agar bisa melompat menurut birama.</p>
          ) : (
            <div className="flex items-center gap-2">
              <input
                data-testid="podium-input-birama"
                inputMode="numeric"
                value={birama}
                onChange={(e) => setBirama(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') lompatKeBirama()
                }}
                placeholder="No. birama"
                className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
              />
              <button type="button" data-testid="podium-lompat-birama" onClick={lompatKeBirama} className={tombolKecil(false)}>
                Lompat
              </button>
            </div>
          ))}
        {hasil && pemilih !== 'set' && (
          <p className="mt-1.5 text-[11px] text-amber-200" data-testid="podium-hasil-lompat">
            {hasil}
          </p>
        )}
      </section>

      {/* 2 — Tempo latihan */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-2">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tempo latihan</p>
        <div className="flex flex-wrap gap-1.5">
          {PERSEN_PODIUM.map((x) => (
            <button
              key={x}
              type="button"
              data-testid={`podium-tempo-${x}`}
              aria-pressed={persen === x}
              onClick={() => onPersen(x)}
              className={tombolKecil(persen === x)}
            >
              {x}%
            </button>
          ))}
        </div>
      </section>

      {/* 3 — Count-in aba-aba */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-2">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Count-in aba-aba</p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="w-16 text-slate-400">Standby</span>
          {PILIHAN_STANDBY.map((n) => (
            <button
              key={n}
              type="button"
              data-testid={`podium-standby-${n}`}
              onClick={() => onSetelan({ ...setelan, standby: n })}
              className={tombolKecil(setelan.standby === n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="w-16 text-slate-400">Mark time</span>
          {PILIHAN_MARK_TIME.map((n) => (
            <button
              key={n}
              type="button"
              data-testid={`podium-mark-${n}`}
              onClick={() => onSetelan({ ...setelan, markTime: n })}
              className={tombolKecil(setelan.markTime === n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="w-16 text-slate-400">Klik</span>
          {PROFIL_PODIUM.map((k) => (
            <button
              key={k}
              type="button"
              data-testid={`podium-profil-${k}`}
              onClick={() => onSetelan({ ...setelan, profil: k })}
              className={tombolKecil(setelan.profil === k)}
            >
              {LABEL_PROFIL[k]}
            </button>
          ))}
        </div>
        <button
          type="button"
          data-testid="podium-mulai"
          onClick={onMulai}
          disabled={!berjalan && sampai <= idx}
          className={
            'mt-2 h-14 w-full rounded-xl text-base font-bold active:scale-[.98] disabled:opacity-40 ' +
            (berjalan ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white')
          }
        >
          {berjalan
            ? '■ Stop'
            : `▶ ${setelan.standby + setelan.markTime > 0 ? 'Hitung masuk & jalan' : 'Jalan'} · Set ${idx + 1}–${sampai + 1}`}
        </button>
      </section>

      {/* 4 — Papan aba-aba 40 m */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <p className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Papan aba-aba 40 m</p>
          {URUTAN_PALET.map((k) => (
            <button
              key={k}
              type="button"
              data-testid={`podium-palet-${k}`}
              title={PALET_PLAKAT[k].label}
              aria-pressed={setelan.palet === k}
              onClick={() => onSetelan({ ...setelan, palet: k })}
              className={'h-6 w-8 rounded border-2 text-[10px] font-black ' + (setelan.palet === k ? 'border-amber-400' : 'border-slate-700')}
              style={{ background: PALET_PLAKAT[k].latar, color: PALET_PLAKAT[k].teks }}
            >
              A
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            data-testid="podium-plakat-rentang"
            onClick={() => onPlakat(teksPlakatRentang(idx + 1, sampai + 1, p))}
            className={tombolKecil(false)}
          >
            {teksPlakatRentang(idx + 1, sampai + 1, p)}
          </button>
          <button
            type="button"
            data-testid="podium-plakat-reset"
            onClick={() => onPlakat(teksPlakatReset(1))}
            className={tombolKecil(false)}
          >
            {teksPlakatReset(1)}
          </button>
          {(() => {
            const h = petaBirama ? huruf.find((x) => setUntukBirama(petaBirama, x.birama) === idx) : undefined
            return h ? (
              <button
                type="button"
                data-testid="podium-plakat-huruf"
                onClick={() => onPlakat(teksPlakatHuruf(h.label, p))}
                className={tombolKecil(false)}
              >
                {teksPlakatHuruf(h.label, p)}
              </button>
            ) : null
          })()}
          {ISYARAT_PODIUM.map((t, i) => (
            <button key={t} type="button" data-testid={`podium-isyarat-${i}`} onClick={() => onPlakat(t)} className={tombolKecil(false)}>
              {t}
            </button>
          ))}
        </div>
        <form
          className="mt-1.5 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            const t = rapikanTeksPlakat(kustom)
            if (t) onPlakat(t)
          }}
        >
          <input
            data-testid="podium-plakat-kustom"
            value={kustom}
            maxLength={60}
            onChange={(e) => setKustom(e.target.value)}
            placeholder="Teks sendiri, pisahkan baris dengan ·"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
          />
          <button type="submit" data-testid="podium-plakat-kustom-tampil" className={tombolKecil(false)}>
            Tampil
          </button>
        </form>
      </section>

      {/* 5 — Rep Counter */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-2" data-testid="podium-rep">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Pengulangan blok · <span data-testid="podium-rep-total">{rep.total}</span>×
        </p>
        {rep.baris.length === 0 ? (
          <p className="text-xs text-slate-500">Belum ada blok yang diulang di sesi ini.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {rep.baris.map((r) => (
              <li
                key={`${r.dari}-${r.sampai}`}
                data-testid="podium-rep-baris"
                data-dari={r.dari}
                data-sampai={r.sampai}
                data-kali={r.kali}
                className="rounded-lg bg-slate-800 px-2 py-1 text-xs tabular-nums"
              >
                {r.label} <b className="text-amber-300">×{r.kali}</b>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[11px] text-slate-500" data-testid="podium-rep-sesi">
          {namaSesi ? `Tersimpan ke sesi hari ini: ${namaSesi}` : 'Tidak ada sesi hari ini — hitungan hanya di layar ini.'}
        </p>
      </section>
    </div>
  )
}

/** Indikator hitungan besar (count-in & count berjalan) di atas lapangan. */
export function HitunganBesar({
  langkah,
  labelJalan,
  totalJalan,
}: {
  langkah: LangkahHitungMasuk | null
  labelJalan: string
  totalJalan: number
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center"
      data-testid="hitungan-besar-podium"
      data-tahap={langkah ? langkah.tahap : 'jalan'}
    >
      <div
        className="flex items-baseline gap-3 rounded-2xl px-5 py-1 shadow-2xl"
        style={{ background: 'rgba(0,0,0,0.82)', color: langkah ? '#ffff00' : '#ffffff' }}
      >
        <span className="text-lg font-black tracking-wider sm:text-2xl" data-testid="hitungan-besar-label">
          {langkah ? LABEL_TAHAP[langkah.tahap] : labelJalan}
        </span>
        {langkah ? (
          <span className="text-6xl font-black tabular-nums leading-none sm:text-8xl" data-testid="hitungan-besar-angka">
            {langkah.ke}
          </span>
        ) : (
          <span className="text-6xl font-black tabular-nums leading-none sm:text-8xl">
            <span data-live-count-besar data-testid="hitungan-besar-angka">1</span>
            <span className="text-2xl opacity-60 sm:text-3xl">/{totalJalan}</span>
          </span>
        )}
      </div>
    </div>
  )
}

/** Plakat layar penuh *Flash-Cue Board 40 m* — ketuk di mana saja untuk menutup. */
export function PlakatPodium({ teks, palet, onTutup }: { teks: string; palet: PaletPlakat; onTutup: () => void }) {
  const baris = barisPlakat(teks)
  const warna = PALET_PLAKAT[palet]
  const ref = useRef<HTMLButtonElement>(null)
  /*
   * Perkiraan `ukuranHurufPlakat` dipakai untuk lukisan pertama; sebelum
   * tampil, lebar huruf yang benar-benar terpasang di perangkat diukur lalu
   * ukurannya disetel agar baris terpanjang memenuhi ±92% lebar layar.
   */
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const pas = () => {
      const spans = [...el.querySelectorAll<HTMLElement>('[data-testid="plakat-baris"]')]
      if (!spans.length) return
      for (const s of spans) s.style.fontSize = '100px'
      const lebar = Math.max(1, ...spans.map((s) => s.scrollWidth))
      const tinggi = Math.max(1, spans.reduce((t, s) => t + s.offsetHeight, 0))
      const px = Math.max(12, Math.floor(100 * Math.min((0.92 * window.innerWidth) / lebar, (0.84 * window.innerHeight) / tinggi)))
      for (const s of spans) s.style.fontSize = `${px}px`
    }
    pas()
    window.addEventListener('resize', pas)
    return () => window.removeEventListener('resize', pas)
  }, [teks])
  return (
    <button
      ref={ref}
      type="button"
      data-testid="plakat-podium"
      data-palet={palet}
      onClick={onTutup}
      aria-label={`Papan aba-aba: ${baris.join(', ')}. Ketuk untuk menutup.`}
      className="fixed inset-0 z-[220] flex flex-col items-center justify-center"
      style={{ background: warna.latar, color: warna.teks }}
    >
      {baris.map((b, i) => (
        <span
          key={i}
          data-testid="plakat-baris"
          className="block whitespace-nowrap font-black leading-[1.05]"
          style={{ fontSize: ukuranHurufPlakat(baris), fontFamily: 'Arial Black, Arial, Helvetica, sans-serif', letterSpacing: '0.02em' }}
        >
          {b}
        </span>
      ))}
    </button>
  )
}
