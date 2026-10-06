/**
 * #10 — Impor drill Pyware.
 *
 * Layar ini hanya mengurutkan tiga hal yang sudah teruji: pratinjau
 * (`lib/pyware.ts`), pencocokan anggota (#1, `PanelCocok`), dan penulisan
 * yang selalu difoto lebih dulu (`lib/pywareTulis.ts`).
 *
 * Aturan yang dipegang layar ini:
 *
 * - **Tidak ada yang ditulis sebelum pelatih melihat ringkasannya.** Jumlah
 *   set, pemain, rentang hitungan, titik hasil interpolasi, dan posisi di
 *   luar lapangan semuanya tampil dulu.
 * - **Yang tidak bisa dipastikan tidak diputuskan diam-diam.** Satuan, asal
 *   pengukuran Y, dan arti kolom Count bisa ditebak dari judul kolom, tetapi
 *   tebakannya disebut di layar dan bisa diganti.
 * - **Impor tidak menimpa tanpa diminta.** Bawaannya menggabungkan set; yang
 *   menimpa harus dipilih sendiri, dan yang paling aman membuat salinan.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Drill, DrillSet, Member } from '../db/types'
import {
  KETERANGAN_MODE_PYWARE,
  LABEL_ASAL_Y_PYWARE,
  LABEL_MODE_PYWARE,
  LABEL_SATUAN_PYWARE,
  idPyware,
  pemainKeAnggota,
  ringkasPyware,
  saranAsalY,
  susunSetPyware,
  uraiPyware,
  type ArtiCount,
  type AsalYPyware,
  type HasilPyware,
  type ModeImporPyware,
  type SatuanPyware,
} from '../lib/pyware'
import { tulisImporPyware } from '../lib/pywareTulis'
import {
  keputusanAwal,
  susunSaran,
  terapkanCocok,
  type KeputusanCocok,
  type SaranBaris,
} from '../lib/namaAnggota'
import { db } from '../db/db'
import { simpanAnggota } from '../lib/simpanAnggota'
import { kenaliBerkas } from '../lib/bukaBerkas'
import { ambilTitipan, mintaPratinjau } from './BukaBerkas'
import { PanelCocok } from './PanelCocok'
import { Button, Field, Modal, Select, Textarea, useToast } from './ui'

type PilihanSatuan = 'auto' | SatuanPyware
type PilihanAsalY = 'auto' | AsalYPyware
type PilihanCount = 'auto' | ArtiCount

const CONTOH = [
  'Set,Count,Performer,Instrument,X (Sidelong),Y (Depth)',
  '1,1,T1,Trumpet,-12,20',
  '1,1,T2,Trumpet,-8,20',
  '2,9,T1,Trumpet,0,16',
  '2,9,T2,Trumpet,4,16',
].join('\n')

export default function ImporPywareModal({
  open,
  onClose,
  drill,
  sets,
  sYd,
  onSelesai,
  koordinatTeks,
}: {
  open: boolean
  onClose: () => void
  drill: Drill
  sets: DrillSet[]
  /** yard per langkah, dari pengaturan lapangan drill */
  sYd: number
  /** dipanggil setelah impor berhasil, membawa id drill hasilnya */
  onSelesai?: (drillId: string) => void
  /** ubah posisi (yard) menjadi teks koordinat lapangan, untuk pratinjau */
  koordinatTeks: (x: number, y: number) => string
}) {
  const toast = useToast()
  const [teks, setTeks] = useState('')
  const [satuan, setSatuan] = useState<PilihanSatuan>('auto')
  const [asalY, setAsalY] = useState<PilihanAsalY>('auto')
  const [artiCount, setArtiCount] = useState<PilihanCount>('auto')
  const [mode, setMode] = useState<ModeImporPyware>('gabung')
  const [menyimpan, setMenyimpan] = useState(false)
  const berkasRef = useRef<HTMLInputElement>(null)

  const [lokal, setLokal] = useState<Member[]>([])
  const [saran, setSaran] = useState<SaranBaris[]>([])
  const [keputusan, setKeputusan] = useState<Record<string, KeputusanCocok>>({})

  // #7 — titipan dari pintu "Buka berkas DrillKit": CSV Pyware yang
  // diteruskan ke sini langsung terisi, tanpa dipilih ulang.
  useEffect(() => {
    if (!open) return
    const cek = () => {
      const t = ambilTitipan(['csv-pyware'])
      if (t) setTeks(t.teks)
    }
    cek()
    window.addEventListener('drillkit:titipan', cek)
    return () => window.removeEventListener('drillkit:titipan', cek)
  }, [open])

  const opsi = useMemo(
    () => ({
      sYd,
      lebarYd: drill.field.widthYd,
      satuan: satuan === 'auto' ? undefined : satuan,
      asalY: asalY === 'auto' ? undefined : asalY,
      artiCount: artiCount === 'auto' ? undefined : artiCount,
    }),
    [sYd, drill.field.widthYd, satuan, asalY, artiCount],
  )

  const hasil: HasilPyware | null = useMemo(() => {
    if (!teks.trim()) return null
    try {
      return uraiPyware(teks, opsi)
    } catch {
      return null
    }
  }, [teks, opsi])

  const ringkas = useMemo(
    () => (hasil && hasil.bentuk === 'pyware' ? ringkasPyware(hasil, drill.field) : null),
    [hasil, drill.field],
  )

  /** Saran asal Y hanya dihitung bila ada titik yang keluar lapangan. */
  const saranY = useMemo(() => {
    if (!teks.trim() || !ringkas || ringkas.diLuarJumlah === 0) return null
    try {
      return saranAsalY(teks, opsi, drill.field)
    } catch {
      return null
    }
  }, [teks, ringkas, opsi, drill.field])

  // Pencocokan anggota (#1): pemain Pyware dibungkus jadi `Member` tiruan
  // dengan id `pyware:<kode>`, lalu lewat mesin saran/keputusan yang sama
  // dengan impor show. Alias yang sudah diingat cocok otomatis.
  //
  // Ketergantungannya **kunci pemain**, bukan objek `hasil`: kalau tidak,
  // setiap perubahan satuan/asal Y (yang mengurai ulang berkas) akan
  // membuang pilihan pencocokan yang sudah dibuat pelatih.
  const kunciPemain = useMemo(
    () => (hasil && hasil.bentuk === 'pyware' ? hasil.pemain.map((p) => p.kunci).join('|') : ''),
    [hasil],
  )

  useEffect(() => {
    if (!open || !kunciPemain || !hasil || hasil.bentuk !== 'pyware') return
    let hidup = true
    void (async () => {
      const ada = await db.members.toArray()
      const baris = susunSaran(pemainKeAnggota(hasil.pemain), ada)
      if (!hidup) return
      setLokal(ada)
      setSaran(baris)
      setKeputusan(keputusanAwal(baris))
    })()
    return () => {
      hidup = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kunciPemain])

  const tanya = saran.filter((s) => !s.otomatis).length
  const dikenal = saran.length - tanya
  /** pemain Pyware yang keputusannya "anggota baru" */
  const akanBaru = saran.filter((s) => (keputusan[s.masuk.id]?.jenis ?? 'baru') === 'baru').length
  const terpetakan = saran.length - akanBaru

  function bacaBerkas(f: File) {
    // Kenali dulu: berkas lain dialihkan ke pratinjau pintu #7, tidak
    // dipaksa masuk alur ini.
    void f.arrayBuffer().then((ab) => {
      const bita = new Uint8Array(ab)
      const kenal = kenaliBerkas(f.name, bita)
      if (kenal.jenis === 'csv-pyware' || kenal.jenis === 'csv-koordinat' || kenal.jenis === 'tak-dikenal') {
        setTeks(kenal.teks ?? '')
        return
      }
      mintaPratinjau(kenal, bita)
    })
  }

  async function terapkan() {
    if (!hasil || hasil.bentuk !== 'pyware' || !ringkas) return
    setMenyimpan(true)
    try {
      const masuk = pemainKeAnggota(hasil.pemain)
      const cocok = terapkanCocok({ masuk, lokal, keputusan, arah: 'lokal' })
      const idLokal = new Set(lokal.map((m) => m.id))
      const idBaru = new Set(
        cocok.anggotaTulis.filter((m) => !idLokal.has(m.id)).map((m) => m.id),
      )
      // Tulis anggota lebih dulu: alias harus sudah tersimpan sebelum
      // titik-titiknya menempel ke id yang benar.
      if (cocok.anggotaTulis.length) await simpanAnggota(cocok.anggotaTulis, [])

      /**
       * kunci pemain Pyware → id anggota DrillKit.
       *
       * `cocok.peta` hanya berisi yang DIPASANGKAN ke anggota lama; pemain
       * yang masuk sebagai anggota baru tidak ada di sana karena id-nya tidak
       * berubah. Tanpa cabang kedua ini, pemain baru tidak akan pernah
       * mendapat titik — impornya "berhasil" tetapi formasi bolong.
       */
      const petaKode: Record<string, string> = {}
      for (const p of hasil.pemain) {
        const idMasuk = idPyware(p.kode, p.nama)
        const id = cocok.peta[idMasuk] ?? (idBaru.has(idMasuk) ? idMasuk : undefined)
        if (id) petaKode[p.kunci] = id
      }
      if (!Object.keys(petaKode).length) {
        toast.push('Tidak ada pemain yang dicocokkan — tidak ada yang ditulis', 'err')
        return
      }

      const countsBawaan = sets.length ? sets[sets.length - 1].counts || 16 : 16
      const rancangan = susunSetPyware(hasil, { countsBawaan }).set
      const h = await tulisImporPyware({
        drillId: drill.id,
        rancangan,
        peta: petaKode,
        mode,
        anggotaBaru: [...idBaru],
      })

      const bagian: string[] = []
      if (h.setBaru) bagian.push(`${h.setBaru} set baru`)
      if (h.setDiperbarui) bagian.push(`${h.setDiperbarui} set diperbarui`)
      bagian.push(`${h.titikDitulis} titik`)
      if (idBaru.size) bagian.push(`${idBaru.size} anggota baru`)
      if (h.baru) bagian.push(`show baru: ${h.nama}`)
      else if (h.snapshotId) bagian.push('bisa dikembalikan dari Riwayat')
      toast.push(`Impor Pyware selesai · ${bagian.join(' · ')}`, 'info')

      setTeks('')
      onSelesai?.(h.drillId)
      onClose()
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Gagal mengimpor', 'err')
    } finally {
      setMenyimpan(false)
    }
  }

  const bisaTerapkan =
    !!hasil && hasil.bentuk === 'pyware' && !!ringkas && ringkas.jumlahTitik > 0 && terpetakan > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Impor drill Pyware (CSV koordinat)"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Tutup
          </Button>
          <Button
            variant="primary"
            data-testid="pyware-proses"
            onClick={() => void terapkan()}
            disabled={!bisaTerapkan || menyimpan}
          >
            {menyimpan ? 'Mengimpor…' : LABEL_MODE_PYWARE[mode]}
          </Button>
        </>
      }
    >
      <div className="space-y-4" data-testid="impor-pyware">
        <p className="text-[11px] leading-relaxed text-slate-400">
          Satu arah: <b>Pyware 3D → DrillKit</b> lewat lembar koordinat CSV. Di Pyware pakai{' '}
          <span className="font-mono">File → Print Coordinates</span> (Performer&apos;s Coordinate
          Sheet), salin isinya ke Excel, lalu simpan sebagai CSV. Yang diimpor titik tiap set;
          jalur di antaranya lurus — busur ditambahkan di editor.
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          <input
            ref={berkasRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            data-testid="berkas-pyware"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) bacaBerkas(f)
              e.target.value = ''
            }}
          />
          <Button size="sm" variant="soft" onClick={() => berkasRef.current?.click()}>
            Pilih berkas CSV…
          </Button>
          <span className="text-[11px] text-slate-500">atau tempel di bawah</span>
        </div>

        <Textarea
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          rows={7}
          placeholder={CONTOH}
          className="font-mono text-[11px]"
          data-testid="pyware-teks"
        />

        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Satuan angka" hint="Tebak = dari judul kolom">
            <Select
              value={satuan}
              data-testid="pyware-satuan"
              onChange={(e) => setSatuan(e.target.value as PilihanSatuan)}
            >
              <option value="auto">
                Tebak{hasil && satuan === 'auto' ? ` → ${hasil.satuan}` : ''}
              </option>
              {(Object.keys(LABEL_SATUAN_PYWARE) as SatuanPyware[]).map((k) => (
                <option key={k} value={k}>
                  {LABEL_SATUAN_PYWARE[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Y diukur" hint="Tebak = dari judul kolom">
            <Select
              value={asalY}
              data-testid="pyware-asaly"
              onChange={(e) => setAsalY(e.target.value as PilihanAsalY)}
            >
              <option value="auto">
                Tebak{hasil && asalY === 'auto' ? ` → ${hasil.asalY}` : ''}
              </option>
              {(Object.keys(LABEL_ASAL_Y_PYWARE) as AsalYPyware[]).map((k) => (
                <option key={k} value={k}>
                  {LABEL_ASAL_Y_PYWARE[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kolom Count berarti">
            <Select
              value={artiCount}
              data-testid="pyware-count"
              onChange={(e) => setArtiCount(e.target.value as PilihanCount)}
            >
              <option value="auto">
                Tebak{hasil && artiCount === 'auto' ? ` → ${hasil.artiCount}` : ''}
              </option>
              <option value="mutlak">Hitungan mutlak (1, 9, 25, …)</option>
              <option value="transisi">Panjang perpindahan (8, 16, …)</option>
            </Select>
          </Field>
        </div>

        <Field label="Cara memasukkan">
          <Select
            value={mode}
            data-testid="pyware-mode"
            onChange={(e) => setMode(e.target.value as ModeImporPyware)}
          >
            {(Object.keys(LABEL_MODE_PYWARE) as ModeImporPyware[]).map((m) => (
              <option key={m} value={m}>
                {LABEL_MODE_PYWARE[m]}
              </option>
            ))}
          </Select>
        </Field>
        <p className="-mt-2 text-[11px] leading-relaxed text-slate-500">
          {KETERANGAN_MODE_PYWARE[mode]}
        </p>

        {/* ----------------------------- Pratinjau ---------------------------- */}
        {hasil && hasil.bentuk === 'pyware' && ringkas && (
          <div
            data-testid="pyware-ringkas"
            className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-[11px] leading-relaxed"
          >
            <p className="text-slate-300">
              <b>{ringkas.jumlahSet}</b> set · <b>{ringkas.jumlahPemain}</b> pemain ·{' '}
              <b>{ringkas.jumlahTitik}</b> titik
              {ringkas.interpolasi > 0 && (
                <span className="text-sky-300/90">
                  {' '}
                  · {ringkas.interpolasi} titik diisi lurus di antara set
                </span>
              )}
              {hasil.dilewati > 0 && (
                <span className="text-amber-400"> · {hasil.dilewati} baris dilewati</span>
              )}
            </p>
            {ringkas.countMin !== null && ringkas.countMax !== null && (
              <p className="text-slate-400">
                Hitungan {ringkas.countMin}–{ringkas.countMax} (kolom Count dibaca sebagai{' '}
                <b className="text-slate-300">{hasil.artiCount}</b>
                {hasil.artiCountTebak ? ', hasil tebakan' : ''}).
              </p>
            )}
            {ringkas.diLuarJumlah > 0 && (
              <div className="mt-1.5 rounded border border-amber-600/40 bg-amber-950/20 p-2 text-amber-100/90">
                <p>
                  <b>{ringkas.diLuarJumlah} titik di luar lapangan.</b> Periksa satuan & asal Y —
                  atau memang formasi ini keluar lapangan.
                </p>
                <ul className="mt-1 space-y-0.5">
                  {ringkas.diLuar.slice(0, 5).map((t, i) => (
                    <li key={i} data-testid="pyware-luar">
                      {t.kode || t.nama} · {t.namaSet} · {koordinatTeks(t.x, t.y)} ({t.sumbu})
                    </li>
                  ))}
                </ul>
                {ringkas.diLuarJumlah > ringkas.diLuar.length && (
                  <p className="mt-0.5">…dan {ringkas.diLuarJumlah - ringkas.diLuar.length} titik lagi</p>
                )}
              </div>
            )}
            {saranY && (
              <p className="mt-1.5 text-sky-300/90" data-testid="pyware-saran-y">
                Coba Y diukur <b>{LABEL_ASAL_Y_PYWARE[saranY.asalY]}</b>: {saranY.sekarang} titik
                keluar lapangan sekarang, {saranY.saran} dengan pilihan itu.
              </p>
            )}
            {hasil.catatan.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-slate-500">
                {hasil.catatan.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {hasil && hasil.bentuk === 'tidak-dikenal' && (
          <p className="rounded-lg border border-amber-600/40 bg-amber-950/20 p-2.5 text-[11px] text-amber-100/90">
            Judul kolom dengan pasangan X/Y tidak terbaca. Pastikan ada baris judul seperti{' '}
            <span className="font-mono">Set,Count,Performer,X,Y</span> — kolom X/Y boleh berjudul{' '}
            <span className="font-mono">X (Sidelong)</span> /{' '}
            <span className="font-mono">Y (Depth)</span>.
          </p>
        )}

        {/* --------------------------- Cocokkan anggota ------------------------ */}
        {hasil && hasil.bentuk === 'pyware' && saran.length > 0 && (
          <div className="border-t border-slate-800 pt-3">
            <p className="mb-1.5 text-xs font-medium text-slate-400">
              Cocokkan pemain Pyware ({terpetakan} dari {saran.length} sudah berpasangan
              {akanBaru > 0 ? `, ${akanBaru} masuk sebagai anggota baru` : ''})
            </p>
            <PanelCocok
              saran={saran}
              lokal={lokal}
              keputusan={keputusan}
              onUbah={(id, kep) => setKeputusan((s) => ({ ...s, [id]: kep }))}
              pengantar={`Pencocokan diingat: kode Pyware disimpan sebagai alias, jadi impor berikutnya langsung cocok. ${dikenal} pemain sudah dikenali lewat alias.`}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}
