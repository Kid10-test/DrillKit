/**
 * #26 (`v2.2.4`) — Laci belah *Beam*: partitur pendamping tepat di bawah
 * kanvas formasi (`MemberDrill` & `DrillPresenter`).
 *
 * Memakai ulang `LayarPartitur` (#11b–#13b, dimuat malas) — tidak ada
 * perender partitur kedua. Rentang birama Set aktif dihitung dari
 * `hitungPetaSetKeBirama` (#11d) lalu dipasang sebagai frasa sorot, sehingga
 * partitur langsung menggulir & menyorot birama set itu (mis. Set 7 →
 * Birama 25–28). Tombol **Ulang set ini** menyalakan loop frasa, jadi tombol
 * bunyi notasi (#13b) memainkan tepat potongan birama tersebut. Mode anggota
 * otomatis memilih part instrumen pemain sendiri (#11c / #13a).
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import type { Drill, DrillSet, Member, SectionDef, Song } from '../../db/types'
import { dariBeatsLama } from '../../lib/birama'
import { formatTautanSetBirama, hitungPetaSetKeBirama, type FrasaLatihan } from '../../lib/partiturFrasa'

const LayarPartitur = lazy(() => import('../LayarPartitur').then((m) => ({ default: m.LayarPartitur })))

export function LaciBeamPartitur({
  song,
  drill,
  sets,
  idxSet,
  anggotaAktif = null,
  sectionsTim,
  namaTim,
  hanyaPutar = false,
  onTutup,
  gelap = true,
}: {
  song: Song | null | undefined
  drill: Pick<Drill, 'beatsPerCount'>
  sets: DrillSet[]
  idxSet: number
  anggotaAktif?: Member | null
  sectionsTim?: SectionDef[]
  namaTim?: string
  hanyaPutar?: boolean
  onTutup: () => void
  gelap?: boolean
}) {
  const peta = useMemo(
    () =>
      song
        ? hitungPetaSetKeBirama(
            sets.map((s) => ({ counts: s.counts, name: s.name })),
            {
              bpm: song.bpm,
              tandaBirama: song.tandaBirama ?? dariBeatsLama(song.beats),
              tempoMap: song.tempoMap,
              latih: song.latih ?? null,
            },
            { beatsPerCount: drill.beatsPerCount },
          )
        : [],
    [song, sets, drill.beatsPerCount],
  )
  const info = peta[Math.max(0, Math.min(peta.length - 1, idxSet))]
  const [ulang, setUlang] = useState(false)
  useEffect(() => setUlang(false), [idxSet, song?.id])

  const frasa: FrasaLatihan | null = info
    ? { dari: info.biramaDari, sampai: info.biramaSampai, aktif: ulang ? 1 : 0, label: `Set ${info.nomorSet}` }
    : null

  const kelasBingkai = gelap
    ? 'rounded-xl border border-sky-800/50 bg-slate-950/80 p-2'
    : 'rounded-xl border border-slate-800 bg-slate-900/60 p-2'

  if (!song) {
    return (
      <div className={kelasBingkai} data-testid="laci-beam">
        <p className="text-[11px] text-slate-400">
          Drill ini belum ditautkan ke lagu, jadi birama partiturnya belum bisa dipetakan ke set.
        </p>
      </div>
    )
  }
  if (!song.partitur) {
    return (
      <div className={kelasBingkai} data-testid="laci-beam">
        <p className="text-[11px] text-slate-400">
          Lagu <b className="text-slate-200">{song.title}</b> belum punya partitur di perangkat ini.
          {hanyaPutar ? ' Minta pelatih menyertakan partitur saat membagikan paket.' : ' Unggah partitur di halaman Musik.'}
        </p>
      </div>
    )
  }

  return (
    <div className={kelasBingkai} data-testid="laci-beam" data-beam-rentang={info ? `${info.biramaDari}-${info.biramaSampai}` : ''}>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-sky-900/60 px-2 py-0.5 text-[11px] font-semibold text-sky-200" data-testid="beam-lencana">
          {info
            ? formatTautanSetBirama({
                setAwal: info.nomorSet,
                setAkhir: info.nomorSet,
                biramaDari: info.biramaDari,
                biramaSampai: info.biramaSampai,
              }).replace('Bar', 'Birama')
            : 'Set di luar lagu'}
        </span>
        <button
          type="button"
          data-testid="beam-ulang-set"
          onClick={() => setUlang((v) => !v)}
          className={
            'rounded-full border px-2.5 py-0.5 text-[11px] active:scale-[.97] ' +
            (ulang ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200' : 'border-slate-700 text-slate-300')
          }
          title="Ulangi terus birama set ini saat tombol bunyi notasi ditekan"
        >
          ↻ Ulang set ini
        </button>
        <button
          type="button"
          onClick={onTutup}
          className="ml-auto rounded-full border border-slate-700 px-2.5 py-0.5 text-[11px] text-slate-400"
        >
          Tutup partitur
        </button>
      </div>
      <Suspense fallback={<p className="p-3 text-center text-xs text-slate-500">Memuat partitur…</p>}>
        <LayarPartitur
          song={song}
          onTutup={onTutup}
          anggotaAktif={anggotaAktif}
          sectionsTim={sectionsTim}
          namaTim={namaTim}
          hanyaPutar={hanyaPutar}
          biramaAktif={info?.biramaDari ?? 1}
          frasa={frasa}
          panjangBiramaLagu={song.panjangBirama}
          onUbahFrasa={(patch) => {
            if (patch.aktif !== undefined) setUlang(patch.aktif === 1)
          }}
          daftarSetDrill={peta}
          labelKonteksPutar="Formasi"
        />
      </Suspense>
    </div>
  )
}
