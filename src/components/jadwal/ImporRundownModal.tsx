/**
 * v2.10.1 — Impor rundown: tempel tabel (Docs/Word/Sheets/WhatsApp), ambil dari
 * Google Drive, atau buka berkas (.docx/.html/.csv/.txt) → pratinjau yang
 * bisa disunting → rencana sesi / pola. Dimuat malas.
 *
 * Mesin pembacanya `lib/rundown.ts` — satu untuk semua sumber, jadi hasil
 * tempel dan hasil Drive selalu sama untuk tabel yang sama.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { BlokLatihan, TautanRundownDrive } from '../../db/types'
import { Button, Input, Modal, Select, useToast } from '../ui'
import { PenyuntingBlok } from './RencanaEditor'
import type { SeksiAktif } from '../../hooks/useSeksiAktif'
import {
  LABEL_PERAN,
  PERAN_KOLOM,
  bacaRundown,
  docxKeHtml,
  pilihTabelRundown,
  tabelDariNilai,
  tabelDariSumber,
  tebakKolomRundown,
  type PeranKolom,
  type PetaRundown,
  type TabelRundown,
} from '../../lib/rundown'
import { formatMenit, totalRencana } from '../../lib/latihan'
import { lamaSlot, menitDariJam } from '../../lib/runsheet'
import { cx, uid } from '../../lib/utils'
import { useGoogle, sisaIzin } from '../google/useGoogle'
import type { BerkasDrive } from '../../lib/googleDrive'

export interface HasilImporRundown {
  blok: BlokLatihan[]
  judul: string
  mulai: string | null
  selesai: string | null
  /** Jam sesi disesuaikan ke jam rundown. */
  sesuaikanJam: boolean
  mode: 'ganti' | 'tambah'
  /** Ada = rundown dari Drive (simpan tautannya); `null` = sumber lain (lepas tautan lama). */
  tautan: TautanRundownDrive | null
}

type Sumber = 'tempel' | 'drive' | 'berkas'

interface IsiSumber {
  tabel: TabelRundown[]
  nama: string
  /** Bila dari Drive. */
  drive?: { berkas: BerkasDrive; tab?: string; tabs?: string[] }
}

const buatId = (a: string) => uid(a)

export default function ImporRundownModal({
  open,
  onClose,
  seksi,
  sesi,
  adaRencana,
  tautan,
  konteks,
  onTerapkan,
}: {
  open: boolean
  onClose: () => void
  seksi: SeksiAktif[]
  /** Sesi tujuan; kosong untuk pola. */
  sesi?: { startTime: string; endTime: string; title: string } | null
  /** Sesi sudah punya rencana? (tawarkan ganti / tambah) */
  adaRencana?: boolean
  /** Tautan rundown Drive yang sudah ada di sesi ini (ambil ulang). */
  tautan?: TautanRundownDrive
  konteks: 'sesi' | 'pola'
  onTerapkan: (h: HasilImporRundown) => void
}) {
  const toast = useToast()
  const g = useGoogle()
  const [sumber, setSumber] = useState<Sumber>(tautan ? 'drive' : 'tempel')
  const [teks, setTeks] = useState('')
  const [html, setHtml] = useState('')
  const [isi, setIsi] = useState<IsiSumber | null>(null)
  const [iTabel, setITabel] = useState(0)
  const [peta, setPeta] = useState<PetaRundown | null>(null)
  const [blok, setBlok] = useState<BlokLatihan[]>([])
  const [disunting, setDisunting] = useState(false)
  const [sesuaikan, setSesuaikan] = useState(true)
  const [mode, setMode] = useState<'ganti' | 'tambah'>('ganti')
  const [judul, setJudul] = useState('')
  const [sibuk, setSibuk] = useState('')
  const [berubah, setBerubah] = useState<string | null>(null)

  // Modal dibuka ulang → mulai bersih.
  useEffect(() => {
    if (!open) return
    setSumber(tautan ? 'drive' : 'tempel')
    setTeks('')
    setHtml('')
    setIsi(null)
    setPeta(null)
    setBlok([])
    setDisunting(false)
    setMode('ganti')
    setBerubah(null)
  }, [open, tautan])

  const tabel = isi?.tabel[iTabel] ?? null
  const ringkasSeksi = useMemo(() => seksi.map((s) => ({ id: s.id, label: s.label })), [seksi])

  function pakaiIsi(baru: IsiSumber, tabelAwal?: number) {
    setIsi(baru)
    const i = tabelAwal != null && tabelAwal < baru.tabel.length ? tabelAwal : pilihTabelRundown(baru.tabel)
    setITabel(i)
    const t = baru.tabel[i]
    setPeta(t ? tebakKolomRundown(t.baris, ringkasSeksi) : null)
    setJudul((t?.judul || baru.nama || '').replace(/^\*+|\*+$/g, '').trim())
    setDisunting(false)
  }

  const hasil = useMemo(
    () => (tabel && peta ? bacaRundown(tabel, peta, { seksi: ringkasSeksi, buatId, selesaiSesi: sesi?.endTime }) : null),
    [tabel, peta, ringkasSeksi, sesi?.endTime],
  )
  // Hasil baca baru menimpa suntingan — kecuali pelatih sudah menyunting.
  useEffect(() => {
    if (hasil && !disunting) setBlok(hasil.blok)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasil])

  /* ------------------------------- tempel ------------------------------- */
  function onTempel(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const h = e.clipboardData.getData('text/html')
    const t = e.clipboardData.getData('text/plain')
    if (!h && !t) return
    e.preventDefault()
    setHtml(h)
    setTeks(t || '')
    const tb = tabelDariSumber({ html: h, teks: t })
    if (!tb.length) toast.push('Tidak ada tabel atau baris berjam yang terbaca', 'info')
    pakaiIsi({ tabel: tb, nama: '' })
  }

  function onKetik(v: string) {
    setTeks(v)
    setHtml('')
    const tb = v.trim() ? tabelDariSumber({ teks: v }) : []
    pakaiIsi({ tabel: tb, nama: '' })
  }

  /* -------------------------------- berkas ------------------------------- */
  async function bukaBerkas(f: File) {
    setSibuk('Membaca berkas…')
    try {
      const tb = await tabelDariBerkas(f.name, new Uint8Array(await f.arrayBuffer()))
      if (!tb.length) toast.push('Tidak ada tabel rundown di berkas itu', 'info')
      pakaiIsi({ tabel: tb, nama: f.name.replace(/\.[^.]+$/, '') })
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Berkas tidak bisa dibaca', 'err')
    } finally {
      setSibuk('')
    }
  }

  /* -------------------------------- Drive -------------------------------- */
  async function ambilDrive(b: BerkasDrive, tab?: string, tabelAwal?: number) {
    if (!g.mod || !g.konfig) return
    setSibuk('Mengambil dari Google Drive…')
    try {
      const info = await g.mod.infoBerkas(b.id)
      const isiDrive = await g.mod.ambilIsiRundown(info, tab)
      let tb: TabelRundown[]
      let tabTerpakai: string | undefined
      let tabs: string[] | undefined
      if (isiDrive.jenis === 'sheet') {
        tb = [tabelDariNilai(isiDrive.tab, isiDrive.nilai)]
        tabTerpakai = isiDrive.tab
        tabs = isiDrive.tabs
      } else if (isiDrive.jenis === 'docx') tb = await tabelDariBerkas(info.name, isiDrive.bita)
      else tb = tabelDariSumber(isiDrive.jenis === 'html' ? { html: isiDrive.html } : { teks: isiDrive.teks })
      if (!tb.length) toast.push(`Tidak ada tabel rundown di “${info.name}”`, 'info')
      pakaiIsi({ tabel: tb, nama: info.name, drive: { berkas: info, tab: tabTerpakai, tabs } }, tabelAwal)
      if (tautan && tautan.id === info.id) setBerubah(info.modifiedTime && info.modifiedTime !== tautan.diubah ? info.modifiedTime : '')
    } catch (e) {
      toast.push(g.mod.pesanGalat(e), 'err')
    } finally {
      setSibuk('')
    }
  }

  async function pilihDrive() {
    if (!g.mod || !g.konfig) return
    try {
      const b = await g.mod.pilihBerkas(g.konfig, 'rundown', 'Pilih rundown (Docs, Sheets, .docx)')
      if (b) await ambilDrive(b)
    } catch (e) {
      toast.push(g.mod.pesanGalat(e), 'err')
    }
  }

  async function ambilUlang() {
    if (!g.mod || !g.konfig || !tautan) return
    try {
      await g.mod.sambung(g.konfig)
      await ambilDrive({ id: tautan.id, name: tautan.nama, mimeType: tautan.mimeType }, tautan.tab, tautan.tabel)
    } catch (e) {
      toast.push(g.mod.pesanGalat(e), 'err')
    }
  }

  async function sambung() {
    if (!g.mod || !g.konfig) return
    try {
      await g.mod.sambung(g.konfig)
    } catch (e) {
      toast.push(g.mod.pesanGalat(e), 'err')
    }
  }

  /* ------------------------------- terapkan ------------------------------ */
  const jamBeda = !!(sesi && hasil?.mulai && hasil.selesai && (hasil.mulai !== sesi.startTime || hasil.selesai !== sesi.endTime))
  const pakaiJamRundown = jamBeda && sesuaikan
  const slot =
    konteks === 'pola'
      ? undefined
      : pakaiJamRundown
        ? lamaSlot(menitDariJam(hasil!.mulai!), menitDariJam(hasil!.selesai!))
        : sesi
          ? lamaSlot(menitDariJam(sesi.startTime), menitDariJam(sesi.endTime))
          : undefined

  function terapkan() {
    if (!blok.length) return
    const d = isi?.drive
    onTerapkan({
      blok,
      judul: judul.trim() || sesi?.title || 'Rundown',
      mulai: hasil?.mulai ?? null,
      selesai: hasil?.selesai ?? null,
      sesuaikanJam: pakaiJamRundown,
      mode: adaRencana ? mode : 'ganti',
      tautan: d
        ? {
            id: d.berkas.id,
            nama: d.berkas.name,
            mimeType: d.berkas.mimeType,
            diubah: d.berkas.modifiedTime ?? '',
            tabel: iTabel,
            ...(d.tab ? { tab: d.tab } : {}),
            diambil: Date.now(),
          }
        : null,
    })
    onClose()
  }

  const ubahPeran = (peran: PeranKolom, v: number) => {
    if (!peta) return
    setDisunting(false)
    setPeta({ ...peta, kolom: { ...peta.kolom, [peran]: v } })
  }

  const judulKolom = tabel && peta ? (peta.judulBaris >= 0 ? tabel.baris[peta.judulBaris] : (tabel.baris[0] ?? []).map((_, i) => `Kolom ${i + 1}`)) : []

  /* -------------------------------- tampil ------------------------------- */
  return (
    <Modal open={open} onClose={onClose} title={konteks === 'pola' ? 'Pola dari rundown' : 'Impor rundown'} wide testId="modal-impor-rundown">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['tempel', 'Tempel'],
              ['drive', 'Google Drive'],
              ['berkas', 'Berkas'],
            ] as [Sumber, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              data-testid={`rundown-sumber-${id}`}
              aria-pressed={sumber === id}
              onClick={() => setSumber(id)}
              className={cx(
                'rounded-md border px-2.5 py-1 text-xs font-medium',
                sumber === id ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200' : 'border-slate-600 text-slate-400',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {sumber === 'tempel' && (
          <div>
            <p className="mb-1 text-[11px] text-slate-500">
              Salin tabel rundown dari Google Docs, Word, atau Sheets (blok seluruh tabel → Ctrl+C), lalu tempel di sini. Pesan WhatsApp
              berformat “17.30 – 17.40 Apel pembuka” juga bisa.
            </p>
            <textarea
              data-testid="rundown-tempel"
              value={teks}
              onPaste={onTempel}
              onChange={(e) => onKetik(e.target.value)}
              rows={isi?.tabel.length ? 3 : 6}
              placeholder={'Jam\tKegiatan\tPJ\tTempat\n17.30 – 17.40\tApel pembuka\tDanlat\tLapangan\n17.40 – 17.55\tMaghrib\t\tMusala'}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-[11px] text-slate-100 outline-none focus:border-emerald-500"
            />
            {html && <p className="text-[10px] text-slate-500">Struktur tabel dari papan klip ikut terbaca.</p>}
          </div>
        )}

        {sumber === 'berkas' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
              Pilih berkas
              <input
                type="file"
                accept=".docx,.html,.htm,.csv,.tsv,.txt,text/csv,text/plain,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                data-testid="rundown-berkas"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) await bukaBerkas(f)
                }}
              />
            </label>
            <span className="text-[11px] text-slate-500">
              .docx (Word), .html, .csv, atau .txt — dibaca di perangkat ini saja, bisa tanpa internet. Untuk Google Docs: File → Download → .docx.
            </span>
          </div>
        )}

        {sumber === 'drive' && (
          <div data-testid="rundown-drive" className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 text-[12px]">
            {!g.konfig ? (
              <p className="text-slate-400">
                Google Drive belum diatur di perangkat ini.{' '}
                <Link to="/pengaturan" onClick={onClose} className="text-emerald-300 underline">
                  Pengaturan › Google Drive
                </Link>{' '}
                — sekali atur, sesudah itu tinggal pilih berkas. Sementara itu, pakai <b>Tempel</b>.
              </p>
            ) : !g.online ? (
              <p data-testid="rundown-drive-offline" className="text-amber-300">
                Sedang offline — Google Drive butuh internet. Tempel atau Berkas tetap bisa dipakai.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {tautan && (
                    <Button size="sm" variant="primary" data-testid="rundown-ambil-ulang" onClick={() => void ambilUlang()} disabled={!!sibuk}>
                      Ambil ulang “{tautan.nama}”
                    </Button>
                  )}
                  <Button size="sm" variant={tautan ? 'ghost' : 'primary'} data-testid="rundown-pilih-drive" onClick={() => void pilihDrive()} disabled={!!sibuk}>
                    {tautan ? 'Pilih berkas lain…' : 'Pilih berkas di Drive'}
                  </Button>
                  {!g.tersambung && (
                    <Button size="sm" variant="ghost" data-testid="rundown-sambung" onClick={() => void sambung()}>
                      Sambungkan dulu
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  {g.tersambung ? `Tersambung · izin berlaku ${sisaIzin(g.habis)}.` : 'Ketukan pertama membuka jendela izin Google.'} DrillKit hanya bisa
                  membuka berkas yang kamu pilih di sini.
                </p>
                {berubah != null && (
                  <p data-testid="rundown-berubah" className={berubah ? 'text-amber-300' : 'text-slate-400'}>
                    {berubah ? 'Berkas sudah diubah sejak terakhir diambil — periksa pratinjau di bawah.' : 'Tidak ada perubahan sejak terakhir diambil.'}
                  </p>
                )}
                {isi?.drive?.tabs && isi.drive.tabs.length > 1 && (
                  <label className="block text-[11px] text-slate-400">
                    Tab
                    <Select
                      data-testid="rundown-tab"
                      value={isi.drive.tab ?? ''}
                      onChange={(e) => void ambilDrive(isi.drive!.berkas, e.target.value)}
                      className="py-1 text-xs"
                    >
                      {isi.drive.tabs.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        {sibuk && <p className="text-[12px] text-slate-400">{sibuk}</p>}

        {isi && isi.tabel.length > 1 && (
          <label className="block text-[11px] text-slate-400">
            Tabel ({isi.tabel.length} di berkas ini)
            <Select
              data-testid="rundown-tabel"
              value={iTabel}
              onChange={(e) => {
                const i = Number(e.target.value)
                setITabel(i)
                setPeta(tebakKolomRundown(isi.tabel[i].baris, ringkasSeksi))
                setJudul(isi.tabel[i].judul || isi.nama)
                setDisunting(false)
              }}
            >
              {isi.tabel.map((t, i) => (
                <option key={i} value={i}>
                  {i + 1}. {t.judul || (t.baris[0] ?? []).filter(Boolean).slice(0, 3).join(' · ') || 'Tabel'} ({t.baris.length} baris)
                </option>
              ))}
            </Select>
          </label>
        )}

        {tabel && peta && hasil && (
          <>
            <details className="rounded-lg border border-slate-800 bg-slate-950/30 p-2" data-testid="rundown-kolom">
              <summary className="cursor-pointer text-[11px] text-slate-400">
                Kolom terbaca:{' '}
                {PERAN_KOLOM.filter((p) => peta.kolom[p] >= 0)
                  .map((p) => `${LABEL_PERAN[p]} = “${judulKolom[peta.kolom[p]] || `Kolom ${peta.kolom[p] + 1}`}”`)
                  .join(' · ') || '—'}
                {peta.seksi.length > 0 && ` · per seksi: ${peta.seksi.map((s) => judulKolom[s.kolom]).join(', ')}`}
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PERAN_KOLOM.map((p) => (
                  <label key={p} className="text-[11px] text-slate-400">
                    {LABEL_PERAN[p]}
                    <Select data-testid={`rundown-kolom-${p}`} value={peta.kolom[p]} onChange={(e) => ubahPeran(p, Number(e.target.value))} className="py-1 text-xs">
                      <option value={-1}>— tidak ada —</option>
                      {judulKolom.map((j, i) => (
                        <option key={i} value={i}>
                          {j || `Kolom ${i + 1}`}
                        </option>
                      ))}
                    </Select>
                  </label>
                ))}
                <label className="text-[11px] text-slate-400">
                  Baris judul kolom
                  <Select
                    data-testid="rundown-judul-baris"
                    value={peta.judulBaris}
                    onChange={(e) => {
                      setDisunting(false)
                      setPeta({ ...peta, judulBaris: Number(e.target.value) })
                    }}
                    className="py-1 text-xs"
                  >
                    <option value={-1}>Tidak ada</option>
                    {tabel.baris.slice(0, 4).map((b, i) => (
                      <option key={i} value={i}>
                        Baris {i + 1}: {b.filter(Boolean).slice(0, 3).join(' · ').slice(0, 40)}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            </details>

            <p data-testid="rundown-ringkas" className="text-[12px] text-slate-300">
              <b>{blok.length}</b> blok · {formatMenit(totalRencana(blok))}
              {hasil.mulai && hasil.selesai && (
                <>
                  {' '}
                  · jam rundown <b data-testid="rundown-jam">{hasil.mulai.replace(':', '.')}–{hasil.selesai.replace(':', '.')}</b>
                </>
              )}
              {hasil.dibaca > 0 && <span className="text-slate-500"> · dari {hasil.dibaca} baris</span>}
            </p>

            {hasil.peringatan.length > 0 && (
              <ul data-testid="rundown-peringatan" className="space-y-0.5 text-[11px] text-amber-300">
                {hasil.peringatan.map((p, i) => (
                  <li key={i} data-kode={p.kode}>
                    ⚠ {p.teks}
                  </li>
                ))}
              </ul>
            )}

            {konteks === 'sesi' && sesi && (
              <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/30 p-2 text-[12px] text-slate-300">
                {jamBeda && (
                  <label className="flex items-start gap-2">
                    <input type="checkbox" data-testid="rundown-sesuaikan-jam" checked={sesuaikan} onChange={(e) => setSesuaikan(e.target.checked)} className="mt-0.5" />
                    <span>
                      Sesuaikan jam sesi ke <b>{hasil.mulai}–{hasil.selesai}</b>{' '}
                      <span className="text-slate-500">
                        (sekarang {sesi.startTime}–{sesi.endTime}). Rencana dihitung dari jam mulai sesi, jadi jam yang berbeda menggeser semua blok.
                      </span>
                    </span>
                  </label>
                )}
                {adaRencana && (
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="mode-rundown" data-testid="rundown-mode-ganti" checked={mode === 'ganti'} onChange={() => setMode('ganti')} />
                      Ganti rencana sekarang
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="mode-rundown" data-testid="rundown-mode-tambah" checked={mode === 'tambah'} onChange={() => setMode('tambah')} />
                      Tambahkan di akhir
                    </label>
                  </div>
                )}
              </div>
            )}

            {konteks === 'pola' && (
              <label className="block text-[11px] text-slate-400">
                Nama pola
                <Input data-testid="rundown-nama-pola" value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="mis. Latsar P3 — Tes II + Section" />
              </label>
            )}

            <div data-testid="rundown-pratinjau" className="rounded-lg border border-slate-800 p-2">
              <p className="mb-1 text-[11px] text-slate-500">Pratinjau — ubah judul, jenis, atau menit di sini sebelum dipakai.</p>
              <PenyuntingBlok
                blok={blok}
                onChange={(b) => {
                  setDisunting(true)
                  setBlok(b)
                }}
                slot={slot}
                seksi={seksi}
              />
            </div>
          </>
        )}

        {isi && !isi.tabel.length && !sibuk && (
          <p className="text-[12px] text-slate-400">Belum ada tabel yang terbaca. Pastikan yang disalin adalah tabel rundown (dengan kolom jam).</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" data-testid="rundown-terapkan" disabled={!blok.length || (konteks === 'pola' && !judul.trim())} onClick={terapkan}>
            {konteks === 'pola' ? 'Buat pola' : `Pakai rundown (${blok.length} blok)`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** .docx / .html / .csv / .txt → tabel. .docx dibuka dengan pembuka ZIP yang sama dengan .mxl. */
async function tabelDariBerkas(nama: string, bita: Uint8Array): Promise<TabelRundown[]> {
  const zip = bita[0] === 0x50 && bita[1] === 0x4b
  if (zip || /\.docx$/i.test(nama)) {
    const { bukaEntriUtamaArsip } = await import('../../lib/mxl')
    const r = await bukaEntriUtamaArsip(bita, { utamakan: /^word\/document\.xml$/i, label: '.docx' })
    if (!r.ok) throw new Error(`Berkas Word tidak bisa dibuka: ${r.alasan}`)
    return tabelDariSumber({ html: docxKeHtml(new TextDecoder().decode(r.bita)) })
  }
  const teks = new TextDecoder().decode(bita)
  return /\.html?$/i.test(nama) || /<table\b/i.test(teks) ? tabelDariSumber({ html: teks }) : tabelDariSumber({ teks })
}
