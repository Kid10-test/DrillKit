/**
 * M3 & #11d — Kartu set list: urutan lagu untuk satu penampilan, lencana frasa
 * latihan (`"Frasa 5–8 · 80%"`), serta tautan frasa partitur ↔ set drill
 * (`"Set 4–6 = Bar 9–16"`).
 *
 * Sengaja dipisah dari `Music.tsx` supaya berkas halamannya tidak makin
 * membengkak. Komponen ini **tidak** memutar apa pun sendiri: ia hanya
 * menampilkan keadaan dan memanggil balik ke halaman.
 */
import { useState } from 'react'
import type { SetList, Song, TautanFrasaSetList } from '../db/types'
import { formatWaktu, labelBirama } from '../lib/birama'
import {
  bacaTautanFrasaBaris,
  formatLencanaFrasa,
  formatTautanSetBirama,
  gabungRentangSetKeBirama,
  type FrasaLatihan,
  type InfoSetBirama,
} from '../lib/partiturFrasa'
import { hitungSetList, naik, turun } from '../lib/setlist'
import type { TempoLatihan } from '../lib/tempoLatihan'
import { cx } from '../lib/utils'
import { IconLoop, IconMusic, IconPlay, IconPlus, IconTrash } from './Icons'
import { Button, Card, Field, Input, Select } from './ui'

export interface InfoDrillLaguSetList {
  drillId: string
  namaDrill: string
  sets: InfoSetBirama[]
}

export function KartuSetList({
  daftar,
  aktif,
  songs,
  laguDipilih,
  sedangMain,
  indeksMain,
  onPilih,
  onBuat,
  onHapus,
  onGantiNama,
  onUrut,
  onMainkan,
  onPilihLagu,
  onTambah,
  hanyaPutar = false,
  latihanUntuk,
  onSemuaAsli,
  frasaUntuk,
  petaSetUntukLagu,
  onSimpanTautanSet,
  onAktifkanTautanSet,
}: {
  daftar: SetList[]
  aktif: SetList | null
  songs: Song[]
  /** id lagu yang sedang dipilih di metronom */
  laguDipilih: string
  /** metronom sedang berbunyi */
  sedangMain: boolean
  /** indeks dalam set list yang sedang diputar — `null` kalau tidak memutar set list */
  indeksMain: number | null
  onPilih: (id: string) => void
  onBuat?: () => void
  onHapus?: () => void
  onGantiNama?: (nama: string) => void
  onUrut?: (songIds: string[]) => void
  onMainkan: (i: number) => void
  onPilihLagu: (id: string) => void
  onTambah?: (songId: string) => void
  hanyaPutar?: boolean
  /** #4 — tempo latihan tiap lagu (per perangkat); durasi & tempo ikut. */
  latihanUntuk?: (songId: string) => TempoLatihan | null
  /** #4 — kembalikan semua lagu di set list ini ke tempo asli. */
  onSemuaAsli?: (songIds: string[]) => void
  /** #11d — frasa latihan tiap lagu (per perangkat / M2). */
  frasaUntuk?: (songId: string) => FrasaLatihan | null
  /** #11d — pemetaan set drill lagu bila lagu ditautkan ke sebuah drill. */
  petaSetUntukLagu?: (songId: string) => InfoDrillLaguSetList | null
  /** #11d — simpan atau hapus tautan `Set A–B = Bar X–Y` pada baris set list. */
  onSimpanTautanSet?: (
    indeksBaris: number,
    songId: string,
    tautan: TautanFrasaSetList | null,
  ) => void
  /** #11d — aktifkan latihan frasa dari keping tautan `Set A–B = Bar X–Y`. */
  onAktifkanTautanSet?: (songId: string, tautan: TautanFrasaSetList) => void
}) {
  const [tambahId, setTambahId] = useState('')
  const [barisEditTautan, setBarisEditTautan] = useState<number | null>(null)
  const [drafSetAwal, setDrafSetAwal] = useState(1)
  const [drafSetAkhir, setDrafSetAkhir] = useState(1)
  const [drafBarDari, setDrafBarDari] = useState(1)
  const [drafBarSampai, setDrafBarSampai] = useState(4)

  const h = hitungSetList(aktif, songs, latihanUntuk)
  const adaLatihan = h.baris.some((b) => b.latihan)
  /** Lagu yang belum masuk set list ini — untuk pilihan "tambah". */
  const bisaDitambah = songs.filter((s) => !(aktif?.songIds ?? []).includes(s.id))
  const petaLagu = new Map(songs.map((s) => [s.id, s]))

  function bukaEditorTautan(indeks: number, songId: string) {
    if (barisEditTautan === indeks) {
      setBarisEditTautan(null)
      return
    }
    const sudahAda = bacaTautanFrasaBaris(aktif?.tautanFrasa, indeks, songId)
    const infoDrill = petaSetUntukLagu?.(songId) ?? null
    if (sudahAda) {
      setDrafSetAwal(sudahAda.setAwal)
      setDrafSetAkhir(sudahAda.setAkhir)
      setDrafBarDari(sudahAda.biramaDari)
      setDrafBarSampai(sudahAda.biramaSampai)
    } else if (infoDrill && infoDrill.sets.length > 0) {
      const pertama = infoDrill.sets[0]
      setDrafSetAwal(pertama.nomorSet)
      setDrafSetAkhir(pertama.nomorSet)
      setDrafBarDari(pertama.biramaDari)
      setDrafBarSampai(pertama.biramaSampai)
    } else {
      const frasaKini = frasaUntuk?.(songId)
      setDrafSetAwal(1)
      setDrafSetAkhir(1)
      setDrafBarDari(frasaKini?.dari ?? 1)
      setDrafBarSampai(frasaKini?.sampai ?? 4)
    }
    setBarisEditTautan(indeks)
  }

  function pilihRentangSetDariDrill(
    sets: InfoSetBirama[],
    awalBaru: number,
    akhirBaru: number,
  ) {
    setDrafSetAwal(awalBaru)
    setDrafSetAkhir(akhirBaru)
    const gabung = gabungRentangSetKeBirama(sets, awalBaru, akhirBaru)
    if (gabung) {
      setDrafBarDari(gabung.biramaDari)
      setDrafBarSampai(gabung.biramaSampai)
    }
  }

  return (
    <Card className="mt-4" data-testid="kartu-setlist">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconMusic size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-200">Set list</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={aktif?.id ?? ''}
            onChange={(e) => {
              setBarisEditTautan(null)
              onPilih(e.target.value)
            }}
            data-testid="pilih-setlist"
            className="min-w-[12rem]"
          >
            <option value="">— tidak ada —</option>
            {daftar.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          {!hanyaPutar && (
            <Button size="sm" onClick={onBuat} data-testid="setlist-baru">
              <IconPlus size={14} /> Baru
            </Button>
          )}
          {!hanyaPutar && aktif && (
            <Button size="sm" variant="ghost" onClick={onHapus} data-testid="setlist-hapus">
              <IconTrash size={14} />
            </Button>
          )}
        </div>
      </div>

      {!aktif ? (
        <p className="mt-3 text-[11px] text-slate-500" data-testid="setlist-kosong">
          Belum ada set list. Set list menyusun beberapa lagu menjadi satu urutan penampilan, dan
          metronom bisa memutarnya berurutan tanpa berhenti.
        </p>
      ) : (
        <>
          <div className="mt-3">
            <Field label="Nama set list">
              <Input
                value={aktif.name}
                onChange={(e) => onGantiNama?.(e.target.value)}
                readOnly={hanyaPutar}
                data-testid="setlist-nama"
              />
            </Field>
          </div>

          {/* Ringkasan: jumlah lagu & total durasi */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
            <span className="text-[11px] text-slate-400">
              <b className="text-slate-200 tabular-nums" data-testid="setlist-jumlah">
                {h.baris.length}
              </b>{' '}
              lagu
            </span>
            <span className="text-[11px] text-slate-400">
              total{' '}
              <b className="text-slate-200 tabular-nums" data-testid="setlist-total">
                {formatWaktu(h.total)}
              </b>
            </span>
            {adaLatihan && (
              <span className="flex items-center gap-2">
                <span
                  className="rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200"
                  data-testid="setlist-ada-latihan"
                >
                  memakai tempo latihan
                </span>
                {onSemuaAsli && (
                  <button
                    type="button"
                    onClick={() => onSemuaAsli(h.baris.map((b) => b.id))}
                    className="rounded-lg border border-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-200 hover:bg-slate-800"
                    data-testid="setlist-semua-asli"
                  >
                    Semua ke tempo asli
                  </button>
                )}
              </span>
            )}
            {h.tanpaPanjang > 0 && (
              <span
                className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200"
                data-testid="setlist-peringatan"
              >
                {h.tanpaPanjang} lagu belum diisi panjangnya — total baru perkiraan
              </span>
            )}
          </div>

          {/* Daftar lagu, berurutan */}
          <ol className="mt-3 space-y-1.5" data-testid="setlist-daftar">
            {h.baris.length === 0 && (
              <li className="text-[11px] text-slate-500">Belum ada lagu di set list ini.</li>
            )}
            {h.baris.map((b, i) => {
              const sedangIni = indeksMain === i
              const dimuat = b.id === laguDipilih
              const objekLagu = petaLagu.get(b.id)
              const lencanaFrasa = formatLencanaFrasa(
                frasaUntuk?.(b.id),
                latihanUntuk?.(b.id),
                objekLagu?.panjangBirama,
              )
              const tautanSet = bacaTautanFrasaBaris(aktif.tautanFrasa, i, b.id)
              const infoDrill = petaSetUntukLagu?.(b.id) ?? null
              const sedangEditTautan = !hanyaPutar && barisEditTautan === i

              return (
                <li
                  key={`${i}-${b.id}`}
                  data-testid={`setlist-baris-${i}`}
                  className={cx(
                    'rounded-lg border px-2.5 py-2 transition',
                    sedangIni
                      ? 'border-emerald-600/50 bg-emerald-600/10'
                      : 'border-slate-800 hover:bg-slate-800/40',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-slate-500">
                      {i + 1}
                    </span>

                    {/* Klik baris = pilih lagu itu di metronom */}
                    <button
                      type="button"
                      onClick={() => onPilihLagu(b.id)}
                      className="min-w-0 flex-1 text-left"
                      data-testid={`setlist-pilih-${i}`}
                    >
                      <p className="truncate text-sm font-medium text-slate-100">
                        {b.judul}
                        {b.adaRekaman && (
                          <span
                            className="ml-1.5 inline-flex items-center text-[10px] text-emerald-400"
                            title="Lagu ini memiliki rekaman audio"
                            data-testid={`setlist-rekaman-${i}`}
                          >
                            🎵
                          </span>
                        )}
                        {dimuat && (
                          <span
                            className="ml-1.5 rounded-full bg-slate-700/70 px-1.5 py-0.5 text-[9px] font-medium text-slate-300"
                            data-testid={`setlist-dimuat-${i}`}
                          >
                            dimuat
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {b.latihan ? (
                          <span className="text-amber-200" data-testid={`setlist-latihan-${i}`}>
                            {b.bpmLatihan} BPM (asli {b.bpm}) · {b.latihan}
                          </span>
                        ) : (
                          `${b.bpm} BPM`
                        )}{' '}
                        · {labelBirama(b.sukat)} ·{' '}
                        {b.detik === null ? (
                          <span className="text-amber-300/80">tanpa akhir</span>
                        ) : (
                          formatWaktu(b.detik)
                        )}
                      </p>
                    </button>

                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                      {lencanaFrasa && (
                        <span
                          data-testid={`setlist-lencana-frasa-${i}`}
                          className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-amber-200"
                        >
                          <IconLoop size={10} />
                          {lencanaFrasa}
                        </span>
                      )}

                      {tautanSet && (
                        <button
                          type="button"
                          data-testid={`setlist-tautan-set-${i}`}
                          onClick={() => onAktifkanTautanSet?.(b.id, tautanSet)}
                          title="Klik untuk memuat lagu ini dan melatih rentang birama set drill tersebut"
                          className="inline-flex items-center gap-1 rounded-full border border-sky-500/50 bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-sky-200 transition hover:bg-sky-500/25"
                        >
                          {formatTautanSetBirama(tautanSet)}
                        </button>
                      )}

                      {!hanyaPutar && onSimpanTautanSet && (
                        <button
                          type="button"
                          data-testid={`setlist-atur-tautan-${i}`}
                          onClick={() => bukaEditorTautan(i, b.id)}
                          title="Tautkan frasa birama lagu ini ke rentang set drill (mis. Set 4–6 = Bar 9–16)"
                          className={cx(
                            'rounded-lg border px-2 py-1 text-[10px] font-medium transition',
                            sedangEditTautan
                              ? 'border-sky-500/60 bg-sky-500/15 text-sky-200'
                              : 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                          )}
                        >
                          {tautanSet ? 'Ubah set' : 'Tautkan set'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onMainkan(i)}
                        title="Mainkan set list mulai dari lagu ini"
                        data-testid={`setlist-mainkan-${i}`}
                        className={cx(
                          'rounded-lg border px-2 py-1.5 transition',
                          sedangIni
                            ? 'border-emerald-600/50 bg-emerald-600/15 text-emerald-200'
                            : 'border-slate-700 text-slate-300 hover:bg-slate-800',
                        )}
                      >
                        <IconPlay size={13} />
                      </button>
                      {!hanyaPutar && (
                        <button
                          type="button"
                          onClick={() => onUrut?.(naik(aktif.songIds, i))}
                          disabled={i === 0}
                          title="Naikkan"
                          data-testid={`setlist-naik-${i}`}
                          className="rounded-lg border border-slate-700 px-1.5 py-1 text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                        >
                          ↑
                        </button>
                      )}
                      {!hanyaPutar && (
                        <button
                          type="button"
                          onClick={() => onUrut?.(turun(aktif.songIds, i))}
                          disabled={i === h.baris.length - 1}
                          title="Turunkan"
                          data-testid={`setlist-turun-${i}`}
                          className="rounded-lg border border-slate-700 px-1.5 py-1 text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                        >
                          ↓
                        </button>
                      )}
                      {!hanyaPutar && (
                        <button
                          type="button"
                          onClick={() => onUrut?.(aktif.songIds.filter((_, k) => k !== i))}
                          title="Keluarkan dari set list"
                          data-testid={`setlist-buang-${i}`}
                          className="rounded-lg border border-slate-700 px-1.5 py-1 text-slate-400 hover:bg-slate-800"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* #11d — Penyunting ringkas tautan Set A–B = Bar X–Y */}
                  {sedangEditTautan && (
                    <div
                      data-testid={`setlist-panel-tautan-${i}`}
                      className="mt-2 space-y-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-[11px]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-300">
                          {infoDrill
                            ? `Tautkan ke drill "${infoDrill.namaDrill}" (${infoDrill.sets.length} set)`
                            : 'Tautkan rentang set & birama (belum ada drill tertaut otomatis)'}
                        </span>
                        <span
                          data-testid={`setlist-pratinjau-tautan-${i}`}
                          className="font-semibold tabular-nums text-sky-300"
                        >
                          {formatTautanSetBirama({
                            setAwal: drafSetAwal,
                            setAkhir: drafSetAkhir,
                            biramaDari: drafBarDari,
                            biramaSampai: drafBarSampai,
                          })}
                        </span>
                      </div>

                      {infoDrill && infoDrill.sets.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Field label="Dari set">
                            <Select
                              value={String(drafSetAwal)}
                              data-testid={`setlist-tautan-set-awal-${i}`}
                              onChange={(e) => {
                                const awal = Math.max(1, Number(e.target.value) || 1)
                                pilihRentangSetDariDrill(
                                  infoDrill.sets,
                                  awal,
                                  Math.max(awal, drafSetAkhir),
                                )
                              }}
                            >
                              {infoDrill.sets.map((s) => (
                                <option key={s.index} value={s.nomorSet}>
                                  Set {s.nomorSet} ({s.nama}) — Bar {s.biramaDari}–{s.biramaSampai}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field label="Sampai set">
                            <Select
                              value={String(drafSetAkhir)}
                              data-testid={`setlist-tautan-set-akhir-${i}`}
                              onChange={(e) => {
                                const akhir = Math.max(1, Number(e.target.value) || 1)
                                pilihRentangSetDariDrill(
                                  infoDrill.sets,
                                  Math.min(drafSetAwal, akhir),
                                  akhir,
                                )
                              }}
                            >
                              {infoDrill.sets.map((s) => (
                                <option key={s.index} value={s.nomorSet}>
                                  Set {s.nomorSet} ({s.nama}) — Bar {s.biramaDari}–{s.biramaSampai}
                                </option>
                              ))}
                            </Select>
                          </Field>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <Field label="Dari set">
                            <Input
                              type="number"
                              min={1}
                              value={drafSetAwal}
                              data-testid={`setlist-tautan-set-awal-${i}`}
                              onChange={(e) =>
                                setDrafSetAwal(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                              }
                            />
                          </Field>
                          <Field label="Sampai set">
                            <Input
                              type="number"
                              min={1}
                              value={drafSetAkhir}
                              data-testid={`setlist-tautan-set-akhir-${i}`}
                              onChange={(e) =>
                                setDrafSetAkhir(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                              }
                            />
                          </Field>
                          <Field label="Dari birama">
                            <Input
                              type="number"
                              min={1}
                              value={drafBarDari}
                              data-testid={`setlist-tautan-bar-dari-${i}`}
                              onChange={(e) =>
                                setDrafBarDari(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                              }
                            />
                          </Field>
                          <Field label="Sampai birama">
                            <Input
                              type="number"
                              min={1}
                              value={drafBarSampai}
                              data-testid={`setlist-tautan-bar-sampai-${i}`}
                              onChange={(e) =>
                                setDrafBarSampai(
                                  Math.max(1, Math.floor(Number(e.target.value) || 1)),
                                )
                              }
                            />
                          </Field>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {tautanSet && (
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`setlist-tautan-hapus-${i}`}
                            onClick={() => {
                              onSimpanTautanSet?.(i, b.id, null)
                              setBarisEditTautan(null)
                            }}
                          >
                            Hapus tautan
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="primary"
                          data-testid={`setlist-tautan-simpan-${i}`}
                          onClick={() => {
                            const setAwal = Math.min(drafSetAwal, drafSetAkhir)
                            const setAkhir = Math.max(drafSetAwal, drafSetAkhir)
                            const biramaDari = Math.min(drafBarDari, drafBarSampai)
                            const biramaSampai = Math.max(drafBarDari, drafBarSampai)
                            const baru: TautanFrasaSetList = {
                              ...(infoDrill ? { drillId: infoDrill.drillId } : {}),
                              setAwal,
                              setAkhir,
                              biramaDari,
                              biramaSampai,
                            }
                            onSimpanTautanSet?.(i, b.id, baru)
                            onAktifkanTautanSet?.(b.id, baru)
                            setBarisEditTautan(null)
                          }}
                        >
                          Simpan & latih frasa
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>

          {/* Tambah lagu */}
          {!hanyaPutar && bisaDitambah.length > 0 && (
            <div className="mt-3 flex items-end gap-2">
              <div className="flex-1">
                <Field label="Tambah lagu" hint="lagu yang belum ada di set list ini">
                  <Select
                    value={tambahId}
                    onChange={(e) => setTambahId(e.target.value)}
                    data-testid="setlist-pilih-tambah"
                  >
                    <option value="">— pilih lagu —</option>
                    {bisaDitambah.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button
                size="sm"
                disabled={!tambahId}
                onClick={() => {
                  if (!tambahId) return
                  onTambah?.(tambahId)
                  setTambahId('')
                }}
                data-testid="setlist-tambah"
              >
                Tambah
              </Button>
            </div>
          )}

          <p className="mt-2 text-[10px] text-slate-500" data-testid="setlist-keterangan">
            {sedangMain && indeksMain !== null
              ? 'Memutar set list — metronom pindah sendiri ke lagu berikutnya.'
              : 'Tekan ▶ untuk memutar set list ini berurutan sampai habis.'}
          </p>
        </>
      )}
    </Card>
  )
}
