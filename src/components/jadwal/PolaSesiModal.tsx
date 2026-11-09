/**
 * #35 — pustaka pola sesi & penerapannya ke banyak sesi sekaligus.
 *
 * Contoh pemakaian Latsar: sesi Selasa selalu "Pola A — Fisik + Visual",
 * Kamis "Pola B — Musik + Section", Jumat "Pola C — Campuran". Anak tahu
 * hari ini latihan apa, dan pelatih tidak menyusun 18 sesi satu per satu.
 */
import { useEffect, useMemo, useState } from 'react'
import type { BlokLatihan, PolaSesi, Session, SessionType } from '../../db/types'
import { db, saveSettings } from '../../db/db'
import { Button, ConfirmButton, Input, Modal, Select, useToast } from '../ui'
import { NAMA_HARI_SENIN, hariSenin, tambahHari } from '../../lib/kalender'
import { formatMenit, totalRencana } from '../../lib/latihan'
import {
  JENIS_BERENCANA,
  komposisiRencana,
  labelKomposisi,
  polaContohLatsar,
  rencanakanTerapPola,
  type AturanTerapPola,
} from '../../lib/ranahSesi'
import { URUTAN_JENIS, sesiMeta, todayISO, uid } from '../../lib/utils'
import { useSettings } from '../../hooks/useSettings'
import { useSeksiAktif } from '../../hooks/useSeksiAktif'
import { BilahKomposisi } from './BilahKomposisi'
import { PenyuntingBlok } from './RencanaEditor'

const buatId = (awalan: string) => uid(awalan)

export function PolaSesiModal({ open, onClose, sesi }: { open: boolean; onClose: () => void; sesi: Session[] }) {
  const settings = useSettings()
  const seksi = useSeksiAktif()
  const toast = useToast()
  const pola = settings.polaSesi ?? []
  const ids = useMemo(() => seksi.map((s) => s.id), [seksi])
  const hariIni = todayISO()

  /* ---------------- sunting pola ---------------- */
  const [sunting, setSunting] = useState<PolaSesi | null>(null)

  async function simpanDaftar(daftar: PolaSesi[]) {
    await saveSettings({ polaSesi: daftar })
  }

  async function simpanSunting() {
    if (!sunting || !sunting.nama.trim()) return
    const nama = sunting.nama.trim()
    const bentrok = pola.find((p) => p.id !== sunting.id && p.nama.trim().toLowerCase() === nama.toLowerCase())
    if (bentrok) {
      toast.push(`Nama “${nama}” sudah dipakai pola lain`, 'err')
      return
    }
    const ada = pola.some((p) => p.id === sunting.id)
    await simpanDaftar(ada ? pola.map((p) => (p.id === sunting.id ? { ...sunting, nama } : p)) : [...pola, { ...sunting, nama }])
    toast.push(`Pola “${nama}” disimpan`)
    setSunting(null)
  }

  async function tambahContoh() {
    const contoh = polaContohLatsar(seksi, buatId)
    const nama = new Set(pola.map((p) => p.nama.trim().toLowerCase()))
    const baru = contoh.filter((p) => !nama.has(p.nama.toLowerCase()))
    if (!baru.length) {
      toast.push('Ketiga contoh pola sudah ada', 'info')
      return
    }
    await simpanDaftar([...pola, ...baru])
    toast.push(`${baru.length} contoh pola ditambahkan — ubah isinya sesuai kurikulum`)
  }

  /* ---------------- terapkan ---------------- */
  const tanggalAkhir = useMemo(() => {
    const mendatang = sesi.filter((s) => s.date >= hariIni).map((s) => s.date)
    return mendatang.length ? mendatang.reduce((a, b) => (b > a ? b : a)) : tambahHari(hariIni, 42)
  }, [sesi, hariIni])
  const [polaId, setPolaId] = useState('')
  const [aturan, setAturan] = useState<AturanTerapPola>(() => ({
    dari: hariIni,
    sampai: tambahHari(hariIni, 42),
    hari: [],
    jenis: [...JENIS_BERENCANA],
    mode: 'kosong',
  }))
  useEffect(() => {
    if (open) setAturan((a) => ({ ...a, dari: hariIni, sampai: tanggalAkhir }))
  }, [open])
  useEffect(() => {
    if (!pola.some((p) => p.id === polaId)) setPolaId(pola[0]?.id ?? '')
  }, [pola, polaId])

  const dipilih = pola.find((p) => p.id === polaId) ?? null
  const rencana = useMemo(
    () => (dipilih ? rencanakanTerapPola(sesi, dipilih, aturan, buatId) : { isi: [], dilewati: [] }),
    [dipilih, sesi, aturan],
  )

  async function terapkan() {
    if (!dipilih || !rencana.isi.length) return
    await db.sessions.bulkPut(rencana.isi)
    toast.push(`Pola “${dipilih.nama}” diterapkan ke ${rencana.isi.length} sesi`)
  }

  const labelTgl = (iso: string) => `${NAMA_HARI_SENIN[hariSenin(iso)]} ${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`
  const sudahBerjalan = rencana.dilewati.filter((d) => d.alasan === 'sudah-berjalan').length
  const sudahAda = rencana.dilewati.filter((d) => d.alasan === 'sudah-ada-rencana').length

  return (
    <Modal open={open} onClose={onClose} title="Pola sesi" wide testId="modal-pola-sesi">
      {sunting ? (
        <div data-testid="sunting-pola" className="space-y-3">
          <Input
            data-testid="sunting-pola-nama"
            value={sunting.nama}
            onChange={(e) => setSunting({ ...sunting, nama: e.target.value })}
            placeholder="Nama pola, mis. Latsar A — Fisik + Visual"
          />
          <PenyuntingBlok
            blok={sunting.rencana}
            onChange={(b: BlokLatihan[]) => setSunting({ ...sunting, rencana: b })}
            seksi={seksi}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSunting(null)}>
              Batal
            </Button>
            <Button variant="primary" data-testid="simpan-sunting-pola" onClick={simpanSunting} disabled={!sunting.nama.trim()}>
              Simpan pola
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[12px] text-slate-400">
            Pola adalah susunan isi sesi yang dipakai berulang — misalnya Selasa selalu fisik + visual, Kamis musik +
            section. Simpan pola dari modal jadwal (“Simpan sebagai pola”) atau susun di sini, lalu terapkan ke banyak sesi
            sekaligus.
          </p>

          <div data-testid="daftar-pola" className="space-y-1.5">
            {pola.length === 0 && <p className="text-sm text-slate-500">Belum ada pola.</p>}
            {pola.map((p) => {
              const k = komposisiRencana(p.rencana, ids)
              return (
                <div key={p.id} data-testid={`pola-${p.id}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{p.nama}</span>
                    <span className="text-[11px] text-slate-500">
                      {p.rencana.length} blok · {formatMenit(totalRencana(p.rencana))}
                    </span>
                    <Button size="sm" variant="ghost" data-testid={`sunting-pola-${p.id}`} onClick={() => setSunting(JSON.parse(JSON.stringify(p)))}>
                      Ubah
                    </Button>
                    <ConfirmButton testId={`hapus-pola-${p.id}`} message="Hapus pola?" onConfirm={() => simpanDaftar(pola.filter((x) => x.id !== p.id))} />
                  </div>
                  <BilahKomposisi m={k.rataRata} className="mt-1" tinggi={5} />
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {labelKomposisi(k.rataRata)}
                    {k.adaParalel ? ' · ada blok paralel per seksi' : ''}
                  </p>
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              data-testid="pola-baru"
              onClick={() => setSunting({ id: uid('pola_'), nama: '', rencana: [], dibuat: Date.now() })}
            >
              + Pola baru
            </Button>
            <Button size="sm" variant="ghost" data-testid="contoh-pola" onClick={tambahContoh}>
              Tambah 3 contoh pola Latsar (120 menit)
            </Button>
          </div>

          {pola.length > 0 && (
            <div data-testid="terap-pola" className="space-y-2 rounded-lg border border-slate-700 p-3">
              <p className="text-xs font-semibold text-slate-300">Terapkan ke banyak sesi</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Select data-testid="terap-pola-pilih" value={polaId} onChange={(e) => setPolaId(e.target.value)}>
                  {pola.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama}
                    </option>
                  ))}
                </Select>
                <Input type="date" data-testid="terap-dari" value={aturan.dari} onChange={(e) => setAturan({ ...aturan, dari: e.target.value })} />
                <Input
                  type="date"
                  data-testid="terap-sampai"
                  value={aturan.sampai}
                  min={aturan.dari}
                  onChange={(e) => setAturan({ ...aturan, sampai: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[11px] text-slate-500">Hari:</span>
                {NAMA_HARI_SENIN.map((h, i) => {
                  const on = aturan.hari.includes(i)
                  return (
                    <button
                      key={h}
                      type="button"
                      data-testid={`terap-hari-${i}`}
                      aria-pressed={on}
                      onClick={() =>
                        setAturan({ ...aturan, hari: on ? aturan.hari.filter((x) => x !== i) : [...aturan.hari, i].sort() })
                      }
                      className={`rounded-md border px-2 py-1 text-xs ${
                        on ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200' : 'border-slate-600 text-slate-400'
                      }`}
                    >
                      {h}
                    </button>
                  )
                })}
                <span className="ml-1 text-[10px] text-slate-500">{aturan.hari.length ? '' : '(semua hari)'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[11px] text-slate-500">Jenis:</span>
                {(URUTAN_JENIS as SessionType[]).map((t) => {
                  const on = aturan.jenis.includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      data-testid={`terap-jenis-${t}`}
                      aria-pressed={on}
                      onClick={() => setAturan({ ...aturan, jenis: on ? aturan.jenis.filter((x) => x !== t) : [...aturan.jenis, t] })}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        on ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200' : 'border-slate-600 text-slate-400'
                      }`}
                    >
                      {sesiMeta(t).label}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="mode-terap"
                    data-testid="terap-mode-kosong"
                    checked={aturan.mode === 'kosong'}
                    onChange={() => setAturan({ ...aturan, mode: 'kosong' })}
                  />
                  Hanya sesi yang belum punya rencana
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="mode-terap"
                    data-testid="terap-mode-ganti"
                    checked={aturan.mode === 'ganti'}
                    onChange={() => setAturan({ ...aturan, mode: 'ganti' })}
                  />
                  Ganti rencana yang sudah ada
                </label>
              </div>
              <p data-testid="terap-ringkas" className="text-[11px] text-slate-400">
                <b className="text-slate-200">{rencana.isi.length}</b> sesi akan diisi
                {rencana.isi.length > 0 && <>: {rencana.isi.slice(0, 12).map((s) => labelTgl(s.date)).join(', ')}{rencana.isi.length > 12 ? ', …' : ''}</>}
                .{sudahAda > 0 && ` ${sudahAda} dilewati karena sudah punya rencana.`}
                {sudahBerjalan > 0 && ` ${sudahBerjalan} dilewati karena sudah berjalan (realisasi tidak pernah ditimpa).`}
              </p>
              <div className="flex justify-end">
                <Button variant="primary" size="sm" data-testid="terap-ya" disabled={!rencana.isi.length} onClick={terapkan}>
                  Terapkan ke {rencana.isi.length} sesi
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
