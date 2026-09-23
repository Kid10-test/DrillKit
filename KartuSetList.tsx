/**
 * M3 — kartu set list: urutan lagu untuk satu penampilan.
 *
 * Sengaja dipisah dari `Music.tsx` supaya berkas halamannya tidak makin
 * membengkak. Komponen ini **tidak** memutar apa pun sendiri: ia hanya
 * menampilkan keadaan dan memanggil balik ke halaman.
 */
import { useState } from 'react'
import type { SetList, Song } from '../db/types'
import { hitungSetList, naik, turun } from '../lib/setlist'
import { formatWaktu, labelBirama } from '../lib/birama'
import { Button, Card, Field, Input, Select } from './ui'
import { IconMusic, IconPlay, IconPlus, IconTrash } from './Icons'
import { cx } from '../lib/utils'

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
  /**
   * N4 — dipakai mode anggota: susunan lagu bisa DILIHAT dan DIPUTAR,
   * tetapi tidak bisa diubah. Set list milik pelatih; kalau anggota bisa
   * mengurutkannya, satu orang tidak sengaja bisa mengacaukan urutan
   * penampilan untuk dirinya sendiri tanpa pelatih tahu.
   */
  hanyaPutar = false,
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
}) {
  const [tambahId, setTambahId] = useState('')

  const h = hitungSetList(aktif, songs)
  /** Lagu yang belum masuk set list ini — untuk pilihan "tambah". */
  const bisaDitambah = songs.filter((s) => !(aktif?.songIds ?? []).includes(s.id))

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
            onChange={(e) => onPilih(e.target.value)}
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
              /** Lagu ini yang sedang dimuat di metronom (belum tentu diputar). */
              const dimuat = b.id === laguDipilih
              return (
                <li
                  key={b.id}
                  data-testid={`setlist-baris-${i}`}
                  className={cx(
                    'flex items-center gap-2 rounded-lg border px-2.5 py-2 transition',
                    sedangIni
                      ? 'border-emerald-600/50 bg-emerald-600/10'
                      : 'border-slate-800 hover:bg-slate-800/40',
                  )}
                >
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
                      {b.bpm} BPM · {labelBirama(b.sukat)} ·{' '}
                      {b.detik === null ? (
                        <span className="text-amber-300/80">tanpa akhir</span>
                      ) : (
                        formatWaktu(b.detik)
                      )}
                    </p>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
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
