/**
 * #36 — Program Latsar: penyusun program latihan berfase yang langsung
 * menjadi jadwal & rencana sesi.
 *
 * Satu layar, dari atas ke bawah: dasar (rentang, hari, jam, tambahan,
 * libur) → tonggak (Hakrab, Pelantikan, Camp, …) → fase berpola isi sesi →
 * aturan pelantikan → garis waktu → pratinjau sesi (buat / tautkan / tetap,
 * sesi wajib) → terapkan. Sesi yang sudah ada ditautkan, bukan diduplikat.
 * Peserta & pemantauannya ada di Absensi → Syarat pelantikan.
 */
import { useEffect, useMemo, useState } from 'react'
import type { FaseProgram, PolaSesi, ProgramLatihan, Session, TonggakProgram } from '../../db/types'
import { db, saveSettings } from '../../db/db'
import { Button, ConfirmButton, Input, Modal, Select, useToast } from '../ui'
import { NAMA_HARI_SENIN, hariSenin } from '../../lib/kalender'
import { PRESET_TARGET, polaContohLatsar } from '../../lib/ranahSesi'
import {
  LABEL_TONGGAK,
  WARNA_FASE,
  cariPolaLatsar,
  lengkapiAturan,
  periksaProgram,
  programBaru,
  rencanakanProgram,
  ringkasRencana,
  terapkanRencana,
  usulFase,
  type ItemRencana,
} from '../../lib/programLatsar'
import { todayISO, uid } from '../../lib/utils'
import { useSettings } from '../../hooks/useSettings'
import { useSeksiAktif } from '../../hooks/useSeksiAktif'
import { GarisWaktuProgram } from './GarisWaktuProgram'
import { EditorAturanPelantikan } from './EditorAturanPelantikan'

const buatId = (awalan: string) => uid(awalan)
const salin = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const labelTgl = (iso: string) => `${NAMA_HARI_SENIN[hariSenin(iso)]} ${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`
const kunciItem = (x: ItemRencana) => `${x.tanggal}|${x.jenis}|${x.jenis === 'latihan' ? '' : x.judul.toLowerCase()}`
const JENIS_TONGGAK: TonggakProgram['jenis'][] = ['acara', 'tes', 'pelantikan', 'camp', 'libur']

export function ProgramModal({ open, onClose, sesi }: { open: boolean; onClose: () => void; sesi: Session[] }) {
  const settings = useSettings()
  const seksi = useSeksiAktif()
  const toast = useToast()
  const daftar = settings.programLatihan ?? []
  const pustaka = settings.polaSesi ?? []
  const [draf, setDraf] = useState<ProgramLatihan | null>(null)
  const [mode, setMode] = useState<'kosong' | 'ganti'>('kosong')
  const [wajibUbah, setWajibUbah] = useState<Record<string, boolean>>({})
  const [tambahTgl, setTambahTgl] = useState('')
  const [liburTgl, setLiburTgl] = useState('')

  useEffect(() => {
    if (!open) return
    setDraf(daftar[0] ? salin(daftar[0]) : null)
    setWajibUbah({})
    setMode('kosong')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const tersimpan = draf ? daftar.some((x) => x.id === draf.id) : false
  const masalah = draf ? periksaProgram(draf) : []
  const rencana = useMemo(
    () => (draf && masalah.length === 0 ? rencanakanProgram(draf, sesi, pustaka, { buatId, mode }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draf, sesi, pustaka, mode, masalah.length],
  )
  const wajibPeta = useMemo(() => {
    const m: Record<string, boolean> = {}
    for (const x of rencana?.item ?? []) m[x.sesi.id] = wajibUbah[kunciItem(x)] ?? x.wajib
    return m
  }, [rencana, wajibUbah])
  const ringkas = rencana ? ringkasRencana(rencana, wajibPeta) : null
  const tanggalWajib = useMemo(
    () => new Set((rencana?.item ?? []).filter((x) => wajibPeta[x.sesi.id]).map((x) => x.tanggal)),
    [rencana, wajibPeta],
  )

  const ubah = (x: Partial<ProgramLatihan>) => draf && setDraf({ ...draf, ...x })
  const hariPola = draf ? [...new Set([...draf.hari, ...draf.tambahan.map(hariSenin)])].sort() : []

  async function simpanDaftar(p0: ProgramLatihan) {
    // v2.8 — simpan aturan yang sudah dilengkapi (membuang persenMin/hadirMin #36).
    const p = { ...p0, aturan: lengkapiAturan(p0.aturan) }
    const ada = daftar.some((x) => x.id === p.id)
    await saveSettings({ programLatihan: ada ? daftar.map((x) => (x.id === p.id ? p : x)) : [...daftar, p] })
  }

  async function pastikanPola(): Promise<PolaSesi[]> {
    const ada = cariPolaLatsar(pustaka)
    if (ada.A && ada.B && ada.C) return pustaka
    const nama = new Set(pustaka.map((p) => p.nama.trim().toLowerCase()))
    const baru = polaContohLatsar(seksi, buatId).filter((p) => !nama.has(p.nama.toLowerCase()))
    const gabung = [...pustaka, ...baru]
    await saveSettings({ polaSesi: gabung })
    if (baru.length) toast.push(`${baru.length} contoh pola Latsar ditambahkan ke pustaka pola`, 'info')
    return gabung
  }

  async function usulkan() {
    if (!draf) return
    const pl = await pastikanPola()
    ubah({ fase: usulFase(draf, cariPolaLatsar(pl), buatId) })
  }

  async function simpanSaja() {
    if (!draf || masalah.length) return
    await simpanDaftar({ ...draf, nama: draf.nama.trim(), diubah: Date.now() })
    toast.push(`Program “${draf.nama.trim()}” disimpan`)
  }

  async function terapkan() {
    if (!draf || !rencana) return
    const { tulis, program } = terapkanRencana({ ...draf, nama: draf.nama.trim() }, rencana, wajibPeta)
    if (tulis.length) await db.sessions.bulkPut(tulis)
    await simpanDaftar(program)
    setDraf(salin(program))
    setWajibUbah({})
    toast.push(`Program diterapkan: ${ringkas!.buat} sesi baru, ${ringkas!.tautkan} ditautkan, ${ringkas!.wajib} sesi wajib`)
  }

  async function hapusProgram() {
    if (!draf) return
    const sisa = daftar.filter((x) => x.id !== draf.id)
    await saveSettings({ programLatihan: sisa })
    setDraf(sisa[0] ? salin(sisa[0]) : null)
    toast.push('Program dihapus — sesi di Jadwal tetap ada')
  }

  const ubahFase = (i: number, x: Partial<FaseProgram>) => draf && ubah({ fase: draf.fase.map((f, j) => (j === i ? { ...f, ...x } : f)) })
  const ubahTonggak = (i: number, x: Partial<TonggakProgram>) =>
    draf && ubah({ tonggak: draf.tonggak.map((t, j) => (j === i ? { ...t, ...x } : t)) })

  return (
    <Modal open={open} onClose={onClose} title="Program latihan" wide testId="modal-program">
      <div className="flex flex-wrap items-center gap-2">
        {daftar.length > 0 && (
          <div className="w-56">
            <Select
              data-testid="pilih-program"
              value={draf && tersimpan ? draf.id : ''}
              onChange={(e) => {
                const p = daftar.find((x) => x.id === e.target.value)
                if (p) {
                  setDraf(salin(p))
                  setWajibUbah({})
                }
              }}
            >
              {!tersimpan && <option value="">(program baru, belum disimpan)</option>}
              {daftar.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama}
                </option>
              ))}
            </Select>
          </div>
        )}
        <Button
          size="sm"
          data-testid="program-baru"
          onClick={() => {
            setDraf(programBaru(buatId, todayISO()))
            setWajibUbah({})
          }}
        >
          + Program baru
        </Button>
        {draf && tersimpan && (
          <ConfirmButton testId="hapus-program" message="Hapus program? Sesi di Jadwal tetap ada." onConfirm={hapusProgram} />
        )}
      </div>

      {!draf ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400" data-testid="program-kosong">
          Belum ada program. Program latihan menyusun seluruh masa latihan dasar sekaligus — hari & jam rutin, Hakrab,
          Pelantikan, Camp, dan fase-fasenya — lalu membuat sesi Jadwal beserta rencana isinya. Kehadiran pesertanya
          dipantau di <b className="text-slate-200">Absensi → Syarat pelantikan</b>.
        </div>
      ) : (
        <div className="space-y-4">
          {/* ------------------------------ dasar ------------------------------ */}
          <section className="space-y-2" data-testid="program-dasar">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dasar</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[11px] text-slate-400">
                Nama program
                <Input data-testid="prog-nama" value={draf.nama} onChange={(e) => ubah({ nama: e.target.value })} placeholder="mis. Latsar CAB 42" />
              </label>
              <label className="text-[11px] text-slate-400">
                Tempat (opsional)
                <Input data-testid="prog-tempat" value={draf.tempat ?? ''} onChange={(e) => ubah({ tempat: e.target.value || undefined })} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="text-[11px] text-slate-400">
                Mulai
                <Input type="date" data-testid="prog-mulai" value={draf.mulai} onChange={(e) => ubah({ mulai: e.target.value })} />
              </label>
              <label className="text-[11px] text-slate-400">
                Selesai
                <Input type="date" data-testid="prog-selesai" value={draf.selesai} min={draf.mulai} onChange={(e) => ubah({ selesai: e.target.value })} />
              </label>
              <label className="text-[11px] text-slate-400">
                Jam mulai
                <Input type="time" data-testid="prog-jam-mulai" value={draf.jamMulai} onChange={(e) => ubah({ jamMulai: e.target.value })} />
              </label>
              <label className="text-[11px] text-slate-400">
                Jam selesai
                <Input type="time" data-testid="prog-jam-selesai" value={draf.jamSelesai} onChange={(e) => ubah({ jamSelesai: e.target.value })} />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[11px] text-slate-500">Hari latihan:</span>
              {NAMA_HARI_SENIN.map((h, i) => {
                const on = draf.hari.includes(i)
                return (
                  <button
                    key={h}
                    type="button"
                    data-testid={`prog-hari-${i}`}
                    aria-pressed={on}
                    onClick={() => ubah({ hari: on ? draf.hari.filter((x) => x !== i) : [...draf.hari, i].sort() })}
                    className={`rounded-md border px-2 py-1 text-xs ${on ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200' : 'border-slate-600 text-slate-400'}`}
                  >
                    {h}
                  </button>
                )
              })}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <DaftarTanggal
                judul="Tanggal tambahan"
                ket="latihan di luar hari rutin"
                prefix="tambahan"
                nilai={draf.tambahan}
                isi={tambahTgl}
                setIsi={setTambahTgl}
                onUbah={(t) => ubah({ tambahan: t })}
              />
              <DaftarTanggal
                judul="Tanggal libur"
                ket="hari rutin yang ditiadakan"
                prefix="libur"
                nilai={draf.libur}
                isi={liburTgl}
                setIsi={setLiburTgl}
                onUbah={(t) => ubah({ libur: t })}
              />
            </div>
          </section>

          {/* ------------------------------ tonggak ------------------------------ */}
          <section className="space-y-2" data-testid="program-tonggak">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tonggak</h3>
            <p className="text-[11px] text-slate-500">
              Acara, pelantikan, camp, dan libur menggantikan latihan rutin di tanggalnya; tes tidak. Tonggak tanpa tanggal
              (mis. camp yang belum pasti) tetap dicatat untuk daftar susulan.
            </p>
            {draf.tonggak.map((t, i) => (
              <div key={t.id} data-testid={`tonggak-${i}`} className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-800 p-2 sm:grid-cols-[1fr_7rem_8.5rem_8.5rem_5.5rem_5.5rem_auto]">
                <Input data-testid={`tonggak-nama-${i}`} value={t.nama} onChange={(e) => ubahTonggak(i, { nama: e.target.value })} placeholder="Nama" />
                <Select data-testid={`tonggak-jenis-${i}`} value={t.jenis} onChange={(e) => ubahTonggak(i, { jenis: e.target.value as TonggakProgram['jenis'] })}>
                  {JENIS_TONGGAK.map((j) => (
                    <option key={j} value={j}>
                      {LABEL_TONGGAK[j]}
                    </option>
                  ))}
                </Select>
                <Input type="date" data-testid={`tonggak-dari-${i}`} value={t.dari ?? ''} onChange={(e) => ubahTonggak(i, { dari: e.target.value || undefined })} title="Tanggal (kosong = belum ditentukan)" />
                <Input type="date" data-testid={`tonggak-sampai-${i}`} value={t.sampai ?? ''} min={t.dari} onChange={(e) => ubahTonggak(i, { sampai: e.target.value || undefined })} title="Sampai (opsional)" />
                <Input type="time" data-testid={`tonggak-jam-mulai-${i}`} value={t.jamMulai ?? ''} onChange={(e) => ubahTonggak(i, { jamMulai: e.target.value || undefined })} title="Jam mulai" />
                <Input type="time" data-testid={`tonggak-jam-selesai-${i}`} value={t.jamSelesai ?? ''} onChange={(e) => ubahTonggak(i, { jamSelesai: e.target.value || undefined })} title="Jam selesai" />
                <Button size="sm" variant="ghost" data-testid={`hapus-tonggak-${i}`} onClick={() => ubah({ tonggak: draf.tonggak.filter((_, j) => j !== i) })}>
                  Hapus
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              data-testid="tambah-tonggak"
              onClick={() => ubah({ tonggak: [...draf.tonggak, { id: uid('tg_'), nama: '', jenis: 'acara' }] })}
            >
              + Tonggak
            </Button>
          </section>

          {/* ------------------------------ fase ------------------------------ */}
          <section className="space-y-2" data-testid="program-fase">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fase & pola isi sesi</h3>
              <Button size="sm" data-testid="usul-fase" onClick={usulkan} disabled={!draf.mulai || !draf.selesai}>
                Usulkan 3 fase Latsar
              </Button>
            </div>
            {draf.fase.length === 0 && (
              <p className="text-[11px] text-slate-500">
                Belum ada fase — sesi dibuat tanpa rencana isi. “Usulkan 3 fase” membagi program di Hakrab/acara pertama dan
                di pelantikan, memakai pola Latsar A/B/C dari pustaka (ditambahkan bila belum ada).
              </p>
            )}
            {draf.fase.map((f, i) => (
              <div key={f.id} data-testid={`fase-${i}`} className="space-y-1.5 rounded-lg border border-slate-800 p-2" style={{ borderLeft: `4px solid ${WARNA_FASE[i % WARNA_FASE.length]}` }}>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-[1fr_8.5rem_8.5rem_10rem_auto]">
                  <Input data-testid={`fase-nama-${i}`} value={f.nama} onChange={(e) => ubahFase(i, { nama: e.target.value })} className="col-span-2 sm:col-span-1" />
                  <Input type="date" data-testid={`fase-dari-${i}`} value={f.dari} onChange={(e) => ubahFase(i, { dari: e.target.value })} />
                  <Input type="date" data-testid={`fase-sampai-${i}`} value={f.sampai} min={f.dari} onChange={(e) => ubahFase(i, { sampai: e.target.value })} />
                  <Select
                    data-testid={`fase-target-${i}`}
                    value={f.target ? String(PRESET_TARGET.findIndex((p) => p.nama === f.target!.nama)) : ''}
                    onChange={(e) => ubahFase(i, { target: e.target.value === '' ? undefined : salin(PRESET_TARGET[Number(e.target.value)]) })}
                    title="Target neraca fase"
                  >
                    <option value="">Tanpa target</option>
                    {PRESET_TARGET.map((p, k) => (
                      <option key={p.nama} value={k}>
                        Target: {p.nama}
                      </option>
                    ))}
                    {f.target && !PRESET_TARGET.some((p) => p.nama === f.target!.nama) && <option value="-1">Target: {f.target.nama}</option>}
                  </Select>
                  <Button size="sm" variant="ghost" data-testid={`hapus-fase-${i}`} onClick={() => ubah({ fase: draf.fase.filter((_, j) => j !== i) })}>
                    Hapus
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {hariPola.map((h) => (
                    <label key={h} className="flex items-center gap-1 text-[11px] text-slate-400">
                      {NAMA_HARI_SENIN[h]}
                      <span className="w-40">
                        <Select
                          data-testid={`fase-pola-${i}-${h}`}
                          value={f.polaPerHari[String(h)] ?? ''}
                          onChange={(e) => {
                            const pp = { ...f.polaPerHari }
                            if (e.target.value) pp[String(h)] = e.target.value
                            else delete pp[String(h)]
                            ubahFase(i, { polaPerHari: pp })
                          }}
                        >
                          <option value="">— tanpa pola —</option>
                          {pustaka.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nama}
                            </option>
                          ))}
                        </Select>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {draf.fase.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                data-testid="tambah-fase"
                onClick={() => {
                  const akhir = draf.fase[draf.fase.length - 1]
                  ubah({ fase: [...draf.fase, { id: uid('fase_'), nama: `Fase ${draf.fase.length + 1}`, dari: akhir.sampai, sampai: draf.selesai, polaPerHari: {} }] })
                }}
              >
                + Fase
              </Button>
            )}
          </section>

          {/* ------------------------------ aturan ------------------------------ */}
          <EditorAturanPelantikan aturan={draf.aturan} nWajib={tanggalWajib.size} onChange={(aturan) => ubah({ aturan })} />

          {/* ------------------------------ pratinjau ------------------------------ */}
          <section className="space-y-2" data-testid="program-pratinjau">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Garis waktu & pratinjau</h3>
            <GarisWaktuProgram program={draf} wajib={tanggalWajib} hariIni={todayISO()} />
            {masalah.length > 0 ? (
              <ul data-testid="program-masalah" className="list-disc pl-5 text-[12px] text-amber-300">
                {masalah.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : (
              rencana &&
              ringkas && (
                <>
                  <p data-testid="program-ringkas" className="text-[12px] text-slate-300">
                    <b>{ringkas.latihan}</b> latihan · <b>{ringkas.buat}</b> sesi baru · <b>{ringkas.tautkan}</b> ditautkan ke sesi yang
                    sudah ada · <b>{ringkas.isi}</b> diisi rencana · <b data-testid="program-jumlah-wajib">{ringkas.wajib}</b> sesi wajib
                    {ringkas.lepas > 0 && <> · {ringkas.lepas} sesi lama dilepas dari program (tidak dihapus)</>}
                  </p>
                  <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-800">
                    <ul className="divide-y divide-slate-800/70" data-testid="daftar-rencana-program">
                      {rencana.item.map((x) => {
                        const k = kunciItem(x)
                        const wajib = wajibPeta[x.sesi.id]
                        const iFase = x.fase ? draf.fase.findIndex((f) => f.id === x.fase!.id) : -1
                        return (
                          <li key={k} data-testid={`rencana-${x.tanggal}${x.jenis === 'latihan' ? '' : `-${x.jenis}`}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2 py-1.5 text-[12px]">
                            <span className="w-16 shrink-0 text-slate-400">{labelTgl(x.tanggal)}</span>
                            <span className="min-w-0 flex-1 truncate text-slate-200">
                              {x.judul}
                              {x.jenis !== 'latihan' && <span className="ml-1 text-[10px] text-slate-500">({LABEL_TONGGAK[x.jenis]})</span>}
                            </span>
                            {iFase >= 0 && (
                              <span className="rounded px-1.5 text-[10px] font-semibold text-white" style={{ background: WARNA_FASE[iFase % WARNA_FASE.length] }}>
                                F{iFase + 1}
                              </span>
                            )}
                            {x.pola && <span className="max-w-[9rem] truncate text-[11px] text-slate-400">{x.pola.nama.split(' — ')[0]}</span>}
                            <span
                              data-aksi={x.aksi}
                              className={`rounded border px-1.5 text-[10px] ${
                                x.aksi === 'buat'
                                  ? 'border-emerald-500/40 text-emerald-300'
                                  : x.aksi === 'tautkan'
                                    ? 'border-sky-500/40 text-sky-300'
                                    : 'border-slate-600 text-slate-400'
                              }`}
                            >
                              {x.aksi === 'buat' ? 'baru' : x.aksi === 'tautkan' ? 'tautkan' : 'tetap'}
                              {x.isiRencana && x.aksi !== 'buat' ? ' + rencana' : ''}
                            </span>
                            <label className="flex items-center gap-1 text-[11px] text-slate-400" title="Dihitung untuk syarat pelantikan">
                              <input
                                type="checkbox"
                                data-testid={`wajib-${x.tanggal}${x.jenis === 'latihan' ? '' : `-${x.jenis}`}`}
                                checked={!!wajib}
                                onChange={(e) => setWajibUbah({ ...wajibUbah, [k]: e.target.checked })}
                              />
                              wajib
                            </label>
                            {x.catatan && <span className="w-full pl-16 text-[10px] text-slate-500">{x.catatan}</span>}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="mode-program" data-testid="program-mode-kosong" checked={mode === 'kosong'} onChange={() => setMode('kosong')} />
                      Isi rencana hanya untuk sesi yang kosong
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="radio" name="mode-program" data-testid="program-mode-ganti" checked={mode === 'ganti'} onChange={() => setMode('ganti')} />
                      Ganti rencana yang sudah ada (kecuali yang sudah berjalan)
                    </label>
                  </div>
                </>
              )
            )}
          </section>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-3">
            <Button variant="ghost" onClick={onClose}>
              Tutup
            </Button>
            <Button data-testid="program-simpan" onClick={simpanSaja} disabled={masalah.length > 0}>
              Simpan saja
            </Button>
            <Button variant="primary" data-testid="program-terapkan" onClick={terapkan} disabled={!rencana || masalah.length > 0}>
              Simpan & terapkan ke Jadwal
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function DaftarTanggal({
  judul,
  ket,
  prefix,
  nilai,
  isi,
  setIsi,
  onUbah,
}: {
  judul: string
  ket: string
  prefix: string
  nilai: string[]
  isi: string
  setIsi: (s: string) => void
  onUbah: (t: string[]) => void
}) {
  return (
    <div className="space-y-1 rounded-lg border border-slate-800 p-2">
      <p className="text-[11px] text-slate-400">
        {judul} <span className="text-slate-600">— {ket}</span>
      </p>
      <div className="flex gap-1.5">
        <div className="min-w-0 flex-1">
          <Input type="date" data-testid={`prog-${prefix}-isi`} value={isi} onChange={(e) => setIsi(e.target.value)} />
        </div>
        <Button
          size="sm"
          data-testid={`prog-${prefix}-tambah`}
          disabled={!isi || nilai.includes(isi)}
          onClick={() => {
            onUbah([...nilai, isi].sort())
            setIsi('')
          }}
        >
          Tambah
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {nilai.map((t) => (
          <button
            key={t}
            type="button"
            data-testid={`prog-${prefix}-${t}`}
            title="Hapus"
            onClick={() => onUbah(nilai.filter((x) => x !== t))}
            className="rounded-full border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 hover:border-rose-500"
          >
            {labelTgl(t)} ✕
          </button>
        ))}
      </div>
    </div>
  )
}
