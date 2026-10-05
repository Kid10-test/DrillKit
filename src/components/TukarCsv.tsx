import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../db/db'
import type { Drill, DrillSet, Member } from '../db/types'
import {
  type AsalYCsv,
  type BarisImpor,
  type HasilImpor,
  type SatuanCsv,
  bacaCsvKoordinat,
} from '../lib/csvKoordinat'
import { toCSV } from '../lib/utils'
import { kenaliBerkas } from '../lib/bukaBerkas'
import { ambilTitipan, mintaPratinjau } from './BukaBerkas'
import { namaDenganPanggilan } from '../lib/namaAnggota'
import { Button, Field, Modal, Select, Textarea, useToast } from './ui'

/* ========================================================================== */
/*  DD7 — Tukar formasi lewat CSV                                             */
/*                                                                            */
/*  Dua arah:                                                                 */
/*   - **Unduh** — lembar koordinat (panjang) dan formasi lebar untuk Excel.    */
/*   - **Impor** — tempel atau pilih berkas, lalu lihat dulu sebelum dipakai.  */
/*                                                                            */
/*  Prinsip utamanya: **impor tidak pernah menimpa tanpa diminta**. Bawaannya  */
/*  membuat set baru di akhir daftar, jadi formasi yang sudah ada aman.        */
/* ========================================================================== */

const SATUAN_LABEL: Record<SatuanCsv, string> = {
  langkah: 'Langkah (8-to-5)',
  yard: 'Yard',
  meter: 'Meter',
}

const ASAL_LABEL: Record<AsalYCsv, string> = {
  belakang: 'Dari garis belakang (bentuk ekspor DrillKit)',
  tengah: 'Dari tengah lapangan (+ = belakang)',
}

export default function TukarCsvModal({
  open,
  onClose,
  drill,
  sets,
  roster,
  sYd,
  lebarYd,
  setAktifId,
  koordinatTeks,
  onSelesai,
  /** unduh lembar koordinat bentuk panjang (sudah ada sejak awal) */
  onUnduhLembar,
}: {
  open: boolean
  onClose: () => void
  drill: Drill
  sets: DrillSet[]
  roster: Member[]
  /** yard per langkah, dari pengaturan lapangan */
  sYd: number
  /** lebar lapangan (yard) */
  lebarYd: number
  /** set yang sedang dibuka — dipakai target "timpa set aktif" */
  setAktifId?: string
  /** ubah posisi (yard) jaring teks koordinat, untuk pratinjau */
  koordinatTeks: (x: number, y: number) => string
  onSelesai?: () => void
  onUnduhLembar: () => void
}) {
  const toast = useToast()
  const [teks, setTeks] = useState('')
  const [satuan, setSatuan] = useState<SatuanCsv>('langkah')
  const [asalY, setAsalY] = useState<AsalYCsv>('belakang')
  const [target, setTarget] = useState<'baru' | 'timpa'>('baru')
  const [menyimpan, setMenyimpan] = useState(false)
  const berkasRef = useRef<HTMLInputElement>(null)

  // #7 — titipan dari pintu baru: CSV koordinat yang diteruskan ke sini
  // langsung terisi, tanpa dipilih ulang. Hanya diambil saat modal terbuka;
  // selagi tertutup titipannya dibiarkan menunggu.
  useEffect(() => {
    if (!open) return
    const cek = () => {
      const t = ambilTitipan(['csv-koordinat'])
      if (t) setTeks(t.teks)
    }
    cek()
    window.addEventListener('drillkit:titipan', cek)
    return () => window.removeEventListener('drillkit:titipan', cek)
  }, [open])

  const hasil: HasilImpor | null = useMemo(() => {
    if (!teks.trim()) return null
    try {
      return bacaCsvKoordinat(teks, { sYd, lebarYd, satuan, asalY })
    } catch {
      return null
    }
  }, [teks, sYd, lebarYd, satuan, asalY])

  /** Cocokkan baris CSV dengan anggota: kode dulu, baru nama. */
  const cocok = useMemo(() => {
    if (!hasil) return { pasangan: [] as { m: Member; b: BarisImpor }[], asing: [] as BarisImpor[] }
    const byKode = new Map(roster.map((m) => [m.code.trim().toLowerCase(), m]))
    const byNama = new Map(roster.map((m) => [m.name.trim().toLowerCase(), m]))
    const pasangan: { m: Member; b: BarisImpor }[] = []
    const asing: BarisImpor[] = []
    const sudah = new Set<string>()
    for (const b of hasil.baris) {
      const m =
        byKode.get(b.kode.toLowerCase()) ?? (b.nama ? byNama.get(b.nama.toLowerCase()) : undefined)
      if (m && !sudah.has(m.id)) {
        sudah.add(m.id)
        pasangan.push({ m, b })
      } else if (!m) asing.push(b)
    }
    return { pasangan, asing }
  }, [hasil, roster])

  const jumlahTitik = useMemo(
    () =>
      cocok.pasangan.reduce(
        (a, { b }) => a + b.pos.filter((p): p is { x: number; y: number } => p !== null).length,
        0,
      ),
    [cocok],
  )

  /* ------------------------------- Ekspor -------------------------------- */

  /** Formasi lebar: satu baris per pemain, sepasang kolom X/Y tiap set. */
  function unduhLebar() {
    const kepala = ['Kode', 'Nama', 'Section', 'Instrumen']
    for (const s of sets) kepala.push(`${s.name} X`, `${s.name} Y`)
    const baris: unknown[][] = [kepala]
    for (const m of roster) {
      const ada = sets.some((s) => s.points[m.id])
      if (!ada) continue
      const r: unknown[] = [m.code, m.name, m.section, m.instrument ?? '']
      for (const s of sets) {
        const p = s.points[m.id]
        r.push(p ? Math.round((p.x / sYd) * 4) / 4 : '')
        r.push(p ? Math.round(((p.y + lebarYd / 2) / sYd) * 4) / 4 : '')
      }
      baris.push(r)
    }
    const berkas = new File(
      [toCSV(baris)],
      `${drill.name.replace(/[^\w-]+/g, '-').toLowerCase()}-formasi.csv`,
      { type: 'text/csv' },
    )
    const url = URL.createObjectURL(berkas)
    const a = document.createElement('a')
    a.href = url
    a.download = berkas.name
    a.click()
    URL.revokeObjectURL(url)
    toast.push(`Formasi ${baris.length - 1} pemain × ${sets.length} set diunduh`)
  }

  /** Contoh berkas kosong supaya mudah diisi di Excel lalu diimpor balik. */
  function unduhTemplate() {
    const kepala = ['Kode', 'Nama', 'Set 1 X', 'Set 1 Y', 'Set 2 X', 'Set 2 Y']
    const baris: unknown[][] = [kepala]
    for (const m of roster.slice(0, 6)) {
      baris.push([m.code, m.name, '', '', '', ''])
    }
    const berkas = new File([toCSV(baris)], 'template-formasi.csv', { type: 'text/csv' })
    const url = URL.createObjectURL(berkas)
    const a = document.createElement('a')
    a.href = url
    a.download = berkas.name
    a.click()
    URL.revokeObjectURL(url)
    toast.push('Template diunduh — isi di Excel, lalu impor')
  }

  /* ------------------------------- Impor --------------------------------- */

  function bacaBerkas(f: File) {
    // #7 — kenali dulu: yang bukan CSV koordinat dialihkan ke pratinjau.
    void f.arrayBuffer().then((ab) => {
      const bita = new Uint8Array(ab)
      const kenal = kenaliBerkas(f.name, bita)
      if (kenal.jenis === 'csv-koordinat' || kenal.jenis === 'tak-dikenal') {
        // Tak-dikenal tetap dimasukkan apa adanya: parser koordinat yang
        // menilai (mis. CSV tanpa judul kolom) — seperti perilaku lama.
        setTeks(kenal.teks ?? '')
        return
      }
      mintaPratinjau(kenal, bita)
    })
  }

  async function terapkan() {
    if (!hasil || !cocok.pasangan.length) return
    setMenyimpan(true)
    try {
      if (target === 'timpa') {
        const s = sets.find((x) => x.id === setAktifId)
        if (!s) {
          toast.push('Tidak ada set yang aktif', 'err')
          return
        }
        const points = { ...s.points }
        let n = 0
        for (const { m, b } of cocok.pasangan) {
          const p = b.pos[0]
          if (!p) continue
          points[m.id] = { x: p.x, y: p.y, facing: points[m.id]?.facing ?? 'front' }
          n++
        }
        await db.sets.update(s.id, { points })
        await db.drills.update(drill.id, { updatedAt: Date.now() })
        toast.push(`${n} titik ditulis ke ${s.name}`, 'info')
      } else {
        const dasar = sets.length ? Math.max(...sets.map((x) => x.order)) + 1 : 0
        const counts = sets[sets.length - 1]?.counts ?? 16
        const baru: DrillSet[] = hasil.namaSet.map((nama, i) => ({
          id: `set_${Date.now().toString(36)}_${i}`,
          drillId: drill.id,
          order: dasar + i,
          name: nama,
          counts,
          points: {},
          createdAt: Date.now(),
        }))
        let n = 0
        for (const { m, b } of cocok.pasangan) {
          for (let i = 0; i < baru.length; i++) {
            const p = b.pos[i]
            if (!p) continue
            baru[i].points[m.id] = { x: p.x, y: p.y, facing: 'front' }
            n++
          }
        }
        await db.sets.bulkPut(baru)
        await db.drills.update(drill.id, { updatedAt: Date.now() })
        toast.push(`${baru.length} set baru dibuat dari ${n} titik`, 'info')
      }
      setTeks('')
      onSelesai?.()
      onClose()
    } finally {
      setMenyimpan(false)
    }
  }

  const bisaTerapkan =
    !!hasil && hasil.bentuk !== 'tidak-dikenal' && cocok.pasangan.length > 0 && jumlahTitik > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tukar formasi lewat CSV"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Tutup
          </Button>
          <Button variant="primary" onClick={terapkan} disabled={!bisaTerapkan || menyimpan}>
            {menyimpan
              ? 'Menyimpan…'
              : target === 'timpa'
                ? 'Timpa set aktif'
                : `Buat ${hasil?.namaSet.length ?? 0} set baru`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* ------------------------------ Unduh ------------------------------ */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-400">Unduh</p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="soft" onClick={unduhLebar} title="Satu baris per pemain, sepasang kolom X/Y tiap set">
              Formasi lebar (Excel)
            </Button>
            <Button size="sm" variant="ghost" onClick={onUnduhLembar} title="Satu baris per pemain per set — enak dibaca & dicetak">
              Lembar koordinat (panjang)
            </Button>
            <Button size="sm" variant="ghost" onClick={unduhTemplate} title="Berkas kosong untuk diisi">
              Template kosong
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
            <b>Formasi lebar</b> enak diedit di Excel: satu baris per pemain, dan tiap set punya
            kolom <span className="font-mono">X</span> dan <span className="font-mono">Y</span>{' '}
            sendiri. Angkanya dalam <b>langkah</b>; X diukur dari tengah lapangan (negatif = sisi
            S2), Y dari garis belakang.
          </p>
        </div>

        {/* ------------------------------ Impor ------------------------------ */}
        <div className="border-t border-slate-800 pt-3">
          <p className="mb-1.5 text-xs font-medium text-slate-400">Impor</p>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <input
              ref={berkasRef}
              type="file"
              accept=".json,.csv,.tsv,.txt,.zip,application/json,text/csv,application/zip"
              data-testid="berkas-koordinat"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) bacaBerkas(f)
                e.target.value = ''
              }}
            />
            <Button size="sm" variant="soft" onClick={() => berkasRef.current?.click()}>
              Pilih berkas…
            </Button>
            <span className="text-[11px] text-slate-500">atau tempel langsung di bawah</span>
          </div>

          <Textarea
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            rows={6}
            placeholder={'Kode,Nama,Set 1 X,Set 1 Y\nC01,Andra,-8,12'}
            className="font-mono text-[11px]"
          />

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Field label="Satuan angka">
              <Select value={satuan} onChange={(e) => setSatuan(e.target.value as SatuanCsv)}>
                {(Object.keys(SATUAN_LABEL) as SatuanCsv[]).map((k) => (
                  <option key={k} value={k}>
                    {SATUAN_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Y diukur">
              <Select value={asalY} onChange={(e) => setAsalY(e.target.value as AsalYCsv)}>
                {(Object.keys(ASAL_LABEL) as AsalYCsv[]).map((k) => (
                  <option key={k} value={k}>
                    {ASAL_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Hasilnya dipakai untuk">
            <Select value={target} onChange={(e) => setTarget(e.target.value as 'baru' | 'timpa')}>
              <option value="baru">Buat set baru di akhir (aman)</option>
              <option value="timpa">Timpa set yang sedang dibuka</option>
            </Select>
          </Field>

          {/* ---------------------------- Pratinjau --------------------------- */}
          {hasil && (
            <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5">
              {hasil.bentuk === 'tidak-dikenal' ? (
                <p className="text-[11px] text-amber-400">
                  Kolom X/Y tidak terbaca. Pastikan ada judul kolom seperti{' '}
                  <span className="font-mono">Set 1 X</span> dan{' '}
                  <span className="font-mono">Set 1 Y</span>, atau kolom{' '}
                  <span className="font-mono">X</span> dan <span className="font-mono">Y</span>.
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-slate-400">
                    Bentuk <b className="text-slate-300">{hasil.bentuk}</b> ·{' '}
                    {hasil.namaSet.length} set · {cocok.pasangan.length} pemain cocok ·{' '}
                    {jumlahTitik} titik
                    {hasil.dilewati > 0 && (
                      <span className="text-amber-400"> · {hasil.dilewati} baris dilewati</span>
                    )}
                  </p>
                  {cocok.asing.length > 0 && (
                    <p className="mt-1 text-[11px] text-amber-400">
                      {cocok.asing.length} baris tidak cocok dengan anggota mana pun:{' '}
                      {cocok.asing
                        .slice(0, 4)
                        .map((b) => b.kode || b.nama)
                        .join(', ')}
                      {cocok.asing.length > 4 ? '…' : ''}
                    </p>
                  )}
                  <div className="mt-1.5 max-h-40 overflow-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="text-slate-500">
                          <th className="px-1 py-0.5 text-left font-medium">Pemain</th>
                          {hasil.namaSet.map((n, i) => (
                            <th key={i} className="px-1 py-0.5 text-left font-medium">
                              {n}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cocok.pasangan.slice(0, 5).map(({ m, b }) => (
                          <tr key={m.id} className="border-t border-slate-800/70">
                            <td className="px-1 py-0.5 text-slate-300">
                              {m.code} — {namaDenganPanggilan(m)}
                            </td>
                            {b.pos.map((p, i) => (
                              <td key={i} className="px-1 py-0.5 text-slate-400">
                                {p ? koordinatTeks(p.x, p.y) : '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {cocok.pasangan.length > 5 && (
                      <p className="mt-1 text-[10px] text-slate-600">
                        …dan {cocok.pasangan.length - 5} pemain lagi
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
