import { useEffect, useMemo, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "../../db/db"
import type { Drill, Song, TempoSegment } from "../../db/types"
import { dariBeatsLama, hitungMundurDefault } from "../../lib/birama"
import { fmtAngka, fmtBirama, panjangSegmenLagu, type PanjangSegmen } from "../../lib/segmenDrill"
import PilihBirama, { PilihBiramaSegmen } from "../PilihBirama"
import AturHitungMundur from "../AturHitungMundur"
import { Button, Field, Input, Modal, Select, Textarea, Toggle } from "../ui"
import { IconPlus } from "../Icons"
import { uid } from "../../lib/utils"


/**
 * #5 sisa — ketuk per hitungan untuk menampilkan panjang segmen dalam
 * **hitungan drill**.
 *
 * Editor lagu tidak tahu drill mana yang akan memakainya, jadi nilainya
 * diambil dari drill yang sudah menautkan lagu ini. Kalau belum ada (atau
 * nilainya berbeda-beda), dipakai asumsi lazim **2 ketuk per hitungan** —
 * satu hitungan = setengah birama 4/4 — dan sumbernya ditulis apa adanya di
 * keterangan supaya tidak dikira angka pasti.
 */
export function asumsiHitungan(drills: Drill[], songId: string): { nilai: number; sumber: string } {
  const dipakai = drills.filter((d) => d.songId === songId)
  const nilai = Array.from(new Set(dipakai.map((d) => d.beatsPerCount))).filter(
    (n) => Number.isFinite(n) && n > 0,
  )
  if (nilai.length === 1) return { nilai: nilai[0], sumber: 'dari drill yang memakai lagu ini' }
  if (nilai.length > 1) {
    const hitung = new Map<number, number>()
    dipakai.forEach((d) => hitung.set(d.beatsPerCount, (hitung.get(d.beatsPerCount) ?? 0) + 1))
    const terbanyak = [...hitung.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
    return {
      nilai: terbanyak,
      sumber: `dari drill yang memakai lagu ini (${nilai.length} nilai berbeda — dipakai yang terbanyak)`,
    }
  }
  return { nilai: 2, sumber: 'asumsi 2 ketuk per hitungan; belum ada drill yang memakai lagu ini' }
}

/** Peta id segmen → panjangnya; urutannya sama dengan urutan musikal. */
export function petaPanjang(segs: TempoSegment[], panjang: PanjangSegmen[]): Map<string, PanjangSegmen> {
  const urut = [...segs].sort(
    (a, b) =>
      a.measure - b.measure ||
      (a.beat ?? 1) - (b.beat ?? 1) ||
      (a.subdivision ?? 1) - (b.subdivision ?? 1),
  )
  const peta = new Map<string, PanjangSegmen>()
  urut.forEach((seg, i) => {
    const p = panjang[i]
    if (p && Math.abs(p.measure - seg.measure) < 1e-9) peta.set(seg.id, p)
  })
  return peta
}

/* ---------------------------------------------------------------------------
 * E3 — Mesin metronom sudah dipindah ke `src/lib/metronome.ts` supaya bisa
 * dipakai bersama oleh halaman Musik, editor drill, dan presenter (B5).
 * --------------------------------------------------------------------------- */

export function blankSong(): Song {
  return {
    id: uid('song_'),
    title: '',
    composer: '',
    bpm: 120,
    beats: 4,
    key: '',
    notes: '',
    tempoMap: [],
    createdAt: Date.now(),
  }
}

export function SongModal({
  open,
  song,
  onClose,
  onSave,
}: {
  open: boolean
  song: Song | null
  onClose: () => void
  onSave: (s: Song) => void
}) {
  const [s, setS] = useState<Song | null>(song)
  useEffect(() => setS(song), [song])
  /*
   * #5 sisa — panjang tiap segmen dalam **hitungan drill**, supaya musik dan
   * set drill direncanakan dengan satuan yang sama. Ketuk per hitungannya
   * diambil dari drill yang memakai lagu ini (lihat `asumsiHitungan`).
   *
   * Hook-nya WAJIB di atas `if (!s) return null` di bawah: kalau tidak, jumlah
   * hook berubah begitu lagunya ada dan React melempar error #310.
   */
  const semuaDrill = useLiveQuery(() => db.drills.toArray(), [], [])
  const asumsi = useMemo(() => asumsiHitungan(semuaDrill ?? [], s?.id ?? ''), [semuaDrill, s?.id])
  const panjangSegmen = useMemo(
    () =>
      s
        ? panjangSegmenLagu(
            {
              bpm: s.bpm,
              tandaBirama: s.tandaBirama ?? dariBeatsLama(s.beats),
              tempoMap: s.tempoMap,
              latih: s.latih ?? null,
            },
            asumsi.nilai,
            { akhirBirama: s.panjangBirama ?? null },
          )
        : [],
    [s, asumsi.nilai],
  )
  /** Peta id segmen → panjangnya, memakai urutan yang sama dengan `urutSegmen`. */
  const panjangById = useMemo(
    () => (s ? petaPanjang(s.tempoMap, panjangSegmen) : new Map<string, PanjangSegmen>()),
    [s, panjangSegmen],
  )
  if (!s) return null

  /* N5 — perubahan tempo yang tersimpan di lagu ini. */
  const arahLagu: 'datar' | 'accel' | 'ritard' = !s.latih?.on
    ? 'datar'
    : s.latih.ke > s.latih.dari
      ? 'accel'
      : s.latih.ke < s.latih.dari
        ? 'ritard'
        : 'datar'
  /** Rentang lagu dipakai untuk membagi langkahnya; 32 bila belum diisi. */
  const rentangLagu = Math.max(1, s.panjangBirama ?? 0) > 0 ? (s.panjangBirama ?? 32) : 32
  const hitungLangkahLagu = (dari: number, ke: number, tiap: number) => {
    const siklus = Math.max(1, Math.round(rentangLagu / Math.max(1, tiap)))
    return (ke - dari) / siklus
  }
  const pilihArahLagu = (arah: 'accel' | 'ritard') => {
    if (arahLagu === arah) {
      setS({ ...s, latih: null })
      return
    }
    const dari = s.bpm
    const ke = Math.min(400, Math.max(20, s.bpm + (arah === 'accel' ? 20 : -20)))
    const tiap = 4
    setS({ ...s, latih: { on: true, dari, ke, tiap, langkah: hitungLangkahLagu(dari, ke, tiap) } })
  }
  const gantiKeLagu = (ke: number) =>
    setS({
      ...s,
      latih: s.latih
        ? { ...s.latih, ke, langkah: hitungLangkahLagu(s.latih.dari, ke, s.latih.tiap) }
        : s.latih,
    })
  const gantiTiapLagu = (tiap: number) =>
    setS({
      ...s,
      latih: s.latih
        ? { ...s.latih, tiap, langkah: hitungLangkahLagu(s.latih.dari, s.latih.ke, tiap) }
        : s.latih,
    })

  /* N6 — segmen terurut: dipakai untuk mengetahui segmen SESUDAH sebuah
     segmen, karena luncuran temponya menuju segmen berikutnya. */
  const urutSegmen = [...s.tempoMap].sort((a, b) =>
    a.measure - b.measure || (a.beat ?? 1) - (b.beat ?? 1) ||
    (a.subdivision ?? 1) - (b.subdivision ?? 1),
  )

  /** N6 — kalau ada segmen berangsur, luncuran menyeluruh dikesampingkan. */
  const adaBerangsurDiLagu = s.tempoMap.some((t) => t.berangsur === 1 || (t.rampCounts ?? 0) > 0)

  const addSeg = () => {
    const lastMeasure = s.tempoMap.length ? Math.max(...s.tempoMap.map((t) => t.measure)) + 8 : 1
    const seg: TempoSegment = {
      id: uid('tm_'),
      label: `Bagian ${String.fromCharCode(65 + s.tempoMap.length)}`,
      measure: lastMeasure,
      bpm: s.tempoMap.at(-1)?.bpm ?? s.bpm,
      beats: s.beats,
      beat: 1,
      subdivision: 1,
      subdivisionsPerBeat: 1,
      rampUnit: 'beat',
    }
    setS({ ...s, tempoMap: [...s.tempoMap, seg] })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={song?.title ? 'Edit lagu' : 'Tambah lagu'}
      testId="modal-lagu"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" onClick={() => onSave(s)}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Judul lagu">
          <Input autoFocus value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} />
        </Field>
        <Field label="Komposer / aransemen" hint="opsional">
          <Input value={s.composer ?? ''} onChange={(e) => setS({ ...s, composer: e.target.value })} />
        </Field>
        <Field label="Tempo dasar (BPM)">
          <Input type="number" value={s.bpm} onChange={(e) => setS({ ...s, bpm: Number(e.target.value) })} />
        </Field>
        <Field label="Tangga nada" hint="opsional">
          <Input value={s.key ?? ''} onChange={(e) => setS({ ...s, key: e.target.value })} placeholder="mis. Bb" />
        </Field>
      </div>

      {/* M1 — pilihan meter yang sama persis dengan metronom */}
      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3" data-testid="lagu-birama">
        <h3 className="mb-2 text-xs font-semibold text-slate-300">Tanda birama</h3>
        <PilihBirama
          nilai={s.tandaBirama ?? dariBeatsLama(s.beats)}
          onChange={(t) => setS({ ...s, tandaBirama: t, beats: t.pembilang })}
          bpm={s.bpm}
        />
      </div>

      {/* M1 — hitung mundur mengikuti birama pertama lagu */}
      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3" data-testid="lagu-hitung-mundur">
        <h3 className="mb-2 text-xs font-semibold text-slate-300">Hitung mundur</h3>
        <AturHitungMundur
          nilai={s.hitungMundur ?? hitungMundurDefault()}
          onChange={(h) => setS({ ...s, hitungMundur: h })}
          birama={s.tandaBirama ?? dariBeatsLama(s.beats)}
        />
      </div>

      {/* N5 — Accelerando & Ritardando yang TERSIMPAN DI LAGU ini.

          Beda dengan kendali di kartu metronom: yang itu untuk berlatih
          sesaat di perangkat ini, yang ini milik lagunya. Karena tersimpan
          di dalam `Song`, ia ikut terbawa ke HP seluruh anggota setiap
          kali pelatih menerbitkan materi — jadi satu band berlatih
          perubahan tempo yang sama, bukan masing-masing menebak sendiri. */}
      <div
        className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3"
        data-testid="lagu-perubahan-tempo"
      >
        <h3 className="mb-2 text-xs font-semibold text-slate-300">Perubahan tempo lagu ini</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={arahLagu === 'accel' ? 'primary' : undefined}
            onClick={() => pilihArahLagu('accel')}
            data-testid="lagu-accelerando"
          >
            Accelerando
          </Button>
          <Button
            size="sm"
            variant={arahLagu === 'ritard' ? 'primary' : undefined}
            onClick={() => pilihArahLagu('ritard')}
            data-testid="lagu-ritardando"
          >
            Ritardando
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500" data-testid="lagu-keterangan-arah">
          {arahLagu === 'accel'
            ? 'Lagu ini makin lama makin cepat.'
            : arahLagu === 'ritard'
              ? 'Lagu ini makin lama makin lambat.'
              : 'Tempo lagu ini tetap dari awal sampai akhir.'}
        </p>
        {adaBerangsurDiLagu && (
          <p
            className="mt-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-200"
            data-testid="lagu-catatan-dikesampingkan"
          >
            Salah satu segmen di bawah ditandai <b>Berangsur</b>, jadi pengaturan ini
            <b> dikesampingkan</b> saat lagu diputar. Yang dipakai luncuran per segmennya,
            karena ia lebih khusus.
          </p>
        )}
        {arahLagu !== 'datar' && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Tujuan (BPM)">
              <Input
                type="number"
                value={s.latih?.ke ?? s.bpm}
                onChange={(e) => gantiKeLagu(Number(e.target.value))}
                data-testid="lagu-latih-ke"
              />
            </Field>
            <Field label="Berubah tiap (birama)">
              <Input
                type="number"
                value={s.latih?.tiap ?? 4}
                onChange={(e) => gantiTiapLagu(Number(e.target.value))}
                data-testid="lagu-latih-tiap"
              />
            </Field>
          </div>
        )}
        {arahLagu !== 'datar' && s.latih && (
          <p className="mt-2 text-[11px] text-emerald-300/90" data-testid="lagu-latih-ringkasan">
            Dari {Math.round(s.latih.dari)} ke {Math.round(s.latih.ke)} BPM —{' '}
            {arahLagu === 'accel' ? 'naik' : 'turun'} {Math.abs(s.latih.langkah).toFixed(1)} BPM tiap{' '}
            {s.latih.tiap} birama. Tersimpan di lagu ini, jadi ikut terbawa ke seluruh anggota.
          </p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Tempo map (posisi birama / ketuk / subdivisi)</span>
          <Button size="sm" onClick={addSeg}>
            <IconPlus size={14} /> Segmen
          </Button>
        </div>
        <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
          Ketuk dan subdivisi memakai indeks 1-based. Ramp menyimpan jumlah hitungan dan satuannya secara eksplisit;
          perubahan pada hitungan pertama sudah bergerak, dan hitungan terakhir mencapai BPM target.
        </p>
        <p className="mb-2 text-[11px] leading-relaxed text-slate-500" data-testid="segmen-asumsi-hitungan">
          Panjang tiap segmen juga ditulis dalam <b>hitungan drill</b> ({fmtAngka(asumsi.nilai)} ketuk per
          hitungan, {asumsi.sumber}) — itulah satuan set di editor drill.
        </p>
        <div className="space-y-2">
          {[...s.tempoMap]
            .sort((a, b) => a.measure - b.measure || (a.beat ?? 1) - (b.beat ?? 1) || (a.subdivision ?? 1) - (b.subdivision ?? 1))
            .map((t) => (
              <div key={t.id} className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/40 p-2" data-testid={`segmen-${t.id}`}>
                {(() => {
                  const idx = urutSegmen.findIndex((x) => x.id === t.id)
                  const berikut = urutSegmen[idx + 1]
                  return (
                <>
                <div className="grid grid-cols-12 gap-2">
                <Input
                  className="col-span-4"
                  placeholder="Label"
                  data-testid={`segmen-label-${t.id}`}
                  value={t.label}
                  onChange={(e) =>
                    setS({ ...s, tempoMap: s.tempoMap.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)) })
                  }
                />
                <Input
                  className="col-span-2"
                  type="number"
                  min={1}
                  placeholder="Birama"
                  aria-label={`Birama segmen ${t.label}`}
                  data-testid={`segmen-birama-${t.id}`}
                  value={t.measure}
                  onChange={(e) =>
                    setS({
                      ...s,
                      tempoMap: s.tempoMap.map((x) => (x.id === t.id ? { ...x, measure: Number(e.target.value) } : x)),
                    })
                  }
                />
                <Input
                  className="col-span-2"
                  type="number"
                  min={1}
                  placeholder="Ketuk"
                  aria-label={`Ketuk segmen ${t.label}`}
                  data-testid={`segmen-ketuk-${t.id}`}
                  value={t.beat ?? 1}
                  onChange={(e) =>
                    setS({
                      ...s,
                      tempoMap: s.tempoMap.map((x) => (x.id === t.id ? { ...x, beat: Number(e.target.value) || 1 } : x)),
                    })
                  }
                />
                <Input
                  className="col-span-3"
                  type="number"
                  placeholder="BPM"
                  data-testid={`segmen-bpm-${t.id}`}
                  value={t.bpm}
                  onChange={(e) =>
                    setS({ ...s, tempoMap: s.tempoMap.map((x) => (x.id === t.id ? { ...x, bpm: Number(e.target.value) } : x)) })
                  }
                />
                <button
                  onClick={() => setS({ ...s, tempoMap: s.tempoMap.filter((x) => x.id !== t.id) })}
                  className="col-span-1 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-rose-300"
                >
                  ✕
                </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="Subdivisi posisi">
                    <Input
                      type="number"
                      min={1}
                      value={t.subdivision ?? 1}
                      aria-label={`Subdivisi posisi segmen ${t.label}`}
                      data-testid={`segmen-subdivisi-${t.id}`}
                      onChange={(e) => setS({
                        ...s,
                        tempoMap: s.tempoMap.map((x) => x.id === t.id
                          ? { ...x, subdivision: Number(e.target.value) || 1 }
                          : x),
                      })}
                    />
                  </Field>
                  <Field label="Subdivisi per ketuk">
                    <Input
                      type="number"
                      min={1}
                      max={64}
                      value={t.subdivisionsPerBeat ?? 1}
                      aria-label={`Jumlah subdivisi segmen ${t.label}`}
                      data-testid={`segmen-jumlah-subdivisi-${t.id}`}
                      onChange={(e) => setS({
                        ...s,
                        tempoMap: s.tempoMap.map((x) => x.id === t.id
                          ? { ...x, subdivisionsPerBeat: Number(e.target.value) || 1 }
                          : x),
                      })}
                    />
                  </Field>
                </div>
                {/* M1 — sukat per segmen: lagu bisa berganti meter di tengah */}
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-[11px] text-slate-500">Sukat</span>
                  <div className="flex-1">
                    <PilihBiramaSegmen
                      nilai={t.birama}
                      onChange={(bm) =>
                        setS({
                          ...s,
                          tempoMap: s.tempoMap.map((x) =>
                            x.id === t.id ? { ...x, birama: bm, beats: bm ? bm.pembilang : s.beats } : x,
                          ),
                        })
                      }
                      warisan={s.tandaBirama ?? dariBeatsLama(s.beats)}
                      testId={`segmen-meter-${t.id}`}
                    />
                  </div>
                </div>

                <div className="border-t border-slate-800/60 pt-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Field label="Panjang ramp (hitungan)" hint="kosong = perubahan langsung">
                      <Input
                        type="number"
                        min={1}
                        max={10000}
                        placeholder="mis. 6"
                        value={t.rampCounts ?? ''}
                        data-testid={`segmen-ramp-hitungan-${t.id}`}
                        onChange={(e) => {
                          const counts = Number(e.target.value)
                          setS({
                            ...s,
                            tempoMap: s.tempoMap.map((x) => x.id === t.id
                              ? { ...x, rampCounts: counts > 0 ? Math.floor(counts) : undefined, berangsur: 0 }
                              : x),
                          })
                        }}
                      />
                    </Field>
                    <Field label="Satuan hitungan ramp">
                      <Select
                        value={t.rampUnit ?? 'beat'}
                        data-testid={`segmen-ramp-unit-${t.id}`}
                        onChange={(e) => setS({
                          ...s,
                          tempoMap: s.tempoMap.map((x) => x.id === t.id
                            ? { ...x, rampUnit: e.target.value as TempoSegment['rampUnit'] }
                            : x),
                        })}
                      >
                        <option value="beat">Ketuk tertulis</option>
                        <option value="tempoBeat">Ketuk acuan BPM</option>
                        <option value="subdivision">Subdivisi ketuk tertulis</option>
                        <option value="tempoSubdivision">Subdivisi acuan BPM</option>
                        <option value="bar">Birama</option>
                      </Select>
                    </Field>
                    <Field label="Dari BPM" hint="kosong = tempo yang sedang berlaku">
                      <Input
                        type="number"
                        min={20}
                        max={400}
                        placeholder="otomatis"
                        value={t.rampFromBpm ?? ''}
                        data-testid={`segmen-ramp-dari-${t.id}`}
                        onChange={(e) => {
                          const value = e.target.value === '' ? undefined : Number(e.target.value)
                          setS({
                            ...s,
                            tempoMap: s.tempoMap.map((x) => x.id === t.id ? { ...x, rampFromBpm: value } : x),
                          })
                        }}
                      />
                    </Field>
                  </div>
                  {(t.rampUnit === 'subdivision' || t.rampUnit === 'tempoSubdivision') && (
                    <Field label="Subdivisi per hitungan" hint="3 = triplet">
                      <Input
                        type="number"
                        min={2}
                        max={64}
                        value={t.rampSubdivisions ?? 3}
                        data-testid={`segmen-ramp-subdivisi-${t.id}`}
                        onChange={(e) => setS({
                          ...s,
                          tempoMap: s.tempoMap.map((x) => x.id === t.id
                            ? { ...x, rampSubdivisions: Number(e.target.value) || 3 }
                            : x),
                        })}
                      />
                    </Field>
                  )}
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Posisi perubahan: birama / ketuk / subdivisi (semuanya mulai dari 1). BPM di atas adalah
                    target. Pada ramp berdurasi N hitungan, hitungan 1 sudah berubah dan hitungan N tepat
                    mencapai target.
                  </p>
                  {(t.rampCounts ?? 0) > 0 && (
                    <p className="mt-1 text-[11px] text-emerald-300/90" data-testid={`segmen-ramp-ringkasan-${t.id}`}>
                      Ramp {t.rampFromBpm ?? 'tempo aktif'} → {t.bpm} BPM selama {t.rampCounts} hitungan.
                    </p>
                  )}
                </div>

                {/* Legacy ramp: retained for existing bar-to-bar maps. */}
                {(t.rampCounts ?? 0) <= 0 && <div className="border-t border-slate-800/60 pt-1.5">
                  <Toggle
                    testId={`segmen-berangsur-${t.id}`}
                    checked={t.berangsur === 1}
                    onChange={(v) =>
                      setS({
                        ...s,
                        tempoMap: s.tempoMap.map((x) =>
                          x.id === t.id ? { ...x, berangsur: v ? 1 : 0 } : x,
                        ),
                      })
                    }
                    label={
                      berikut
                        ? `Berangsur ke bar ${berikut.measure} (${berikut.bpm} BPM)`
                        : 'Berangsur ke segmen berikutnya'
                    }
                  />
                  {t.berangsur === 1 && !berikut && (
                    <p
                      className="mt-1 text-[11px] text-amber-300/90"
                      data-testid={`berangsur-tanpa-tujuan-${t.id}`}
                    >
                      Belum ada segmen sesudahnya, jadi belum ada yang bisa diluncurkan. Tambah
                      segmen di birama berikutnya dulu.
                    </p>
                  )}
                  {t.berangsur === 1 && berikut && berikut.measure <= t.measure && (
                    <p
                      className="mt-1 text-[11px] text-amber-300/90"
                      data-testid={`berangsur-tumpang-${t.id}`}
                    >
                      Segmen berikutnya harus ditempatkan di birama yang lebih besar.
                    </p>
                  )}
                  {t.berangsur === 1 && berikut && berikut.measure > t.measure && (
                    <p
                      className="mt-1 text-[11px] text-emerald-300/90"
                      data-testid={`berangsur-ringkasan-${t.id}`}
                    >
                      Bar {t.measure}: {t.bpm} BPM → bar {berikut.measure}: {berikut.bpm} BPM —
                      diluncurkan selama {berikut.measure - t.measure} birama
                      {berikut.bpm > t.bpm ? ' (accelerando)' : berikut.bpm < t.bpm ? ' (ritardando)' : ''}.
                    </p>
                  )}
                </div>}
                {/* #5 sisa — panjang segmen dalam hitungan drill. */}
                {(() => {
                  const p = panjangById.get(t.id)
                  if (!p) return null
                  return (
                    <p className="text-[10px] text-slate-500" data-testid={`segmen-panjang-${t.id}`}>
                      {p.hitungan === null
                        ? 'Panjangnya belum tertentu — isi “panjang lagu” atau tambah segmen berikutnya'
                        : `≈ ${fmtAngka(p.hitungan)} hitungan drill · birama ${fmtBirama(p.mulaiBirama)}–${fmtBirama(p.akhirBirama)}`}
                    </p>
                  )
                })()}
                </>
                  )
                })()}
              </div>
            ))}

          {/* M1 — tombol tambah juga ada di BAWAH daftar, supaya mengisi
              banyak segmen tidak perlu menggulir kembali ke atas. */}
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 w-full"
            onClick={addSeg}
            data-testid="tambah-segmen-bawah"
          >
            <IconPlus size={14} /> Tambah segmen
          </Button>
          {s.tempoMap.length === 0 && (
            <p className="mt-1 text-center text-[11px] text-slate-500">
              Belum ada segmen. Segmen dipakai untuk mengubah tempo &amp; sukat di tengah lagu.
            </p>
          )}
        </div>
      </div>

      <Field label="Catatan" hint="opsional">
        <Textarea value={s.notes ?? ''} onChange={(e) => setS({ ...s, notes: e.target.value })} />
      </Field>
    </Modal>
  )
}
