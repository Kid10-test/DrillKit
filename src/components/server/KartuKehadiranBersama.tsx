/**
 * v2.14 — Pengaturan › Kehadiran bersama: atur proyek Supabase, masuk dengan
 * Google, lihat peran, undang staf (pemilik), dan sinkron.
 *
 * Kartu ini tidak memuat pustaka Supabase sampai servernya sudah diatur —
 * perangkat yang tidak memakai kehadiran bersama tidak mengunduh apa pun.
 */
import { useEffect, useState } from 'react'
import { saveSettings } from '../../db/db'
import type { KonfigServerTim } from '../../db/types'
import { useSettings } from '../../hooks/useSettings'
import { Badge, Button, ConfirmButton, Field, Input, Modal, Select, useToast } from '../ui'
import {
  DAFTAR_PERAN,
  KET_PERAN,
  LABEL_PERAN,
  bolehKerangka,
  emailSah,
  kapanSinkron,
  konfigServer,
  periksaKonfigServer,
  pesanProgramDitahan,
  refProyek,
  type PeranStaf,
  type StatusServer,
} from '../../lib/kehadiranBersama'
import { bacaStatusServer } from './statusServer'

type Mod = typeof import('../../lib/serverKehadiran')
type Staf = Awaited<ReturnType<Mod['daftarStaf']>>[number]

const ENV = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}

function useStatusServer(): StatusServer {
  const [st, setSt] = useState(bacaStatusServer)
  useEffect(() => {
    const f = () => setSt(bacaStatusServer())
    window.addEventListener('drillkit-server', f)
    const t = window.setInterval(f, 30_000)
    return () => {
      window.removeEventListener('drillkit-server', f)
      window.clearInterval(t)
    }
  }, [])
  return st
}

function useOnline(): boolean {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine !== false)
  useEffect(() => {
    const f = () => setOn(navigator.onLine !== false)
    window.addEventListener('online', f)
    window.addEventListener('offline', f)
    return () => {
      window.removeEventListener('online', f)
      window.removeEventListener('offline', f)
    }
  }, [])
  return on
}

export default function KartuKehadiranBersama() {
  const toast = useToast()
  const settings = useSettings()
  const st = useStatusServer()
  const online = useOnline()
  const konfig = konfigServer(settings.serverKehadiran, ENV)
  const [mod, setMod] = useState<Mod | null>(null)
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const [atur, setAtur] = useState(false)
  const [draf, setDraf] = useState<KonfigServerTim>({})
  const [sedang, setSedang] = useState('')
  const [staf, setStaf] = useState<Staf[] | null>(null)
  const [undang, setUndang] = useState<{ email: string; nama: string; peran: PeranStaf }>({ email: '', nama: '', peran: 'pencatat' })

  useEffect(() => {
    if (!konfig) return
    let hidup = true
    void import('../../lib/serverKehadiran').then((m) => {
      if (!hidup) return
      setMod(m)
      void m.akun().then((a) => {
        if (!hidup) return
        setEmail(a?.email ?? null)
        // Peran dibaca ulang dari server tiap kartu dibuka (bisa diubah pemilik kapan saja).
        if (a && navigator.onLine !== false) void m.muatTim().catch((e) => m.tulisStatus({ galat: m.pesanGalat(e) }))
      })
    })
    return () => {
      hidup = false
    }
    // konfig dibandingkan lewat isinya, bukan identitas objeknya
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [konfig?.url, konfig?.kunci])

  // Akun berubah (selesai masuk/keluar) → baca ulang.
  useEffect(() => {
    if (mod) void mod.akun().then((a) => setEmail(a?.email ?? null))
  }, [mod, st.email, st.timId])

  const pemilik = bolehKerangka(st.peran)
  useEffect(() => {
    if (!mod || !pemilik || !st.timId || !online) {
      setStaf(null)
      return
    }
    let hidup = true
    mod
      .daftarStaf(st.timId)
      .then((d) => hidup && setStaf(d))
      .catch(() => hidup && setStaf(null))
    return () => {
      hidup = false
    }
  }, [mod, pemilik, st.timId, online])

  const masalah = periksaKonfigServer(draf)

  async function simpanKonfig() {
    const bersih: KonfigServerTim = { url: draf.url?.trim().replace(/\/+$/, '') || undefined, kunci: draf.kunci?.trim() || undefined }
    if (periksaKonfigServer(bersih).some((m) => /RAHASIA/.test(m))) {
      toast.push('Kunci rahasia tidak disimpan', 'err')
      return
    }
    await saveSettings({ serverKehadiran: bersih.url || bersih.kunci ? bersih : undefined })
    setAtur(false)
    toast.push('Pengenal server disimpan')
  }

  async function jalankan(label: string, f: () => Promise<unknown>, sukses?: string) {
    setSedang(label)
    try {
      await f()
      if (sukses) toast.push(sukses)
    } catch (e) {
      toast.push(mod ? mod.pesanGalat(e) : String(e), 'err')
    } finally {
      setSedang('')
    }
  }

  async function masuk() {
    if (!mod) return
    await jalankan('Membuka Google…', () => mod.masukGoogle())
  }

  async function sinkronSekarang() {
    if (!mod) return
    await jalankan(
      'Menyinkronkan…',
      async () => {
        mod.tulisStatus({ aktif: true })
        mod.mulaiPenjaga()
        const h = await mod.sinkronkan()
        toast.push(h.dikirim || h.diterima ? `Tersinkron · ${h.dikirim} dikirim · ${h.diterima} diterima` : 'Sudah sama dengan server')
      },
    )
  }

  async function kirimUndangan() {
    if (!mod || !st.timId) return
    const e = emailSah(undang.email)
    if (!e) {
      toast.push('Bentuk email belum benar', 'err')
      return
    }
    await jalankan(
      'Mengundang…',
      async () => {
        await mod.undangStaf(st.timId!, e, undang.peran, undang.nama)
        setUndang({ email: '', nama: '', peran: undang.peran })
        setStaf(await mod.daftarStaf(st.timId!))
      },
      `${e} diundang sebagai ${LABEL_PERAN[undang.peran]}`,
    )
  }

  const masukAkun = !!email
  const badge = !konfig ? (
    <Badge className="border-slate-700 bg-slate-800/60 text-slate-400">belum diatur</Badge>
  ) : !masukAkun ? (
    <Badge className="border-amber-800 bg-amber-950/50 text-amber-300">belum masuk</Badge>
  ) : st.belumDiundang ? (
    <Badge className="border-rose-800 bg-rose-950/50 text-rose-300">belum diundang</Badge>
  ) : st.peran ? (
    <Badge data-testid="server-peran" className="border-emerald-800 bg-emerald-950/50 text-emerald-300">
      {LABEL_PERAN[st.peran]}
    </Badge>
  ) : (
    <Badge className="border-slate-700 bg-slate-800/60 text-slate-400">memeriksa…</Badge>
  )

  return (
    <div data-testid="kartu-kehadiran-bersama" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-200">Kehadiran bersama</h2>
            {badge}
            {konfig && !online && <Badge className="border-slate-700 bg-slate-800/60 text-slate-400">offline</Badge>}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Satu daftar kehadiran untuk pemilik, danlat, pencatat, dan PH/asisten — masing-masing masuk dengan akun Google sendiri.
            Yang dikirim ke server hanya daftar anggota (nama, section), daftar sesi, dan catatan kehadiran. Drill, musik, nilai,
            nomor HP, dan data lain tetap di perangkat ini. Absensi tetap bisa diisi tanpa sinyal; kirimnya menyusul.{' '}
            <a href="./privasi.html" target="_blank" rel="noopener" className="text-emerald-400 underline-offset-2 hover:underline">
              Kebijakan privasi
            </a>{' '}
            ·{' '}
            <a href="./ketentuan.html" target="_blank" rel="noopener" className="text-emerald-400 underline-offset-2 hover:underline">
              Ketentuan
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {konfig && !masukAkun && (
            <Button variant="primary" data-testid="server-masuk" disabled={!online || !mod || !!sedang} onClick={() => void masuk()}>
              Masuk dengan Google
            </Button>
          )}
          {masukAkun && st.peran && (
            <Button variant="primary" data-testid="server-sinkron" disabled={!online || !!sedang} onClick={() => void sinkronSekarang()}>
              Sinkronkan sekarang
            </Button>
          )}
          {masukAkun && mod && (
            <Button variant="ghost" data-testid="server-keluar" onClick={() => void jalankan('Keluar…', () => mod.keluar(), 'Keluar dari kehadiran bersama')}>
              Keluar
            </Button>
          )}
          <Button
            variant="ghost"
            data-testid="server-atur"
            onClick={() => {
              setDraf({ ...(settings.serverKehadiran ?? {}) })
              setAtur(true)
            }}
          >
            {konfig ? 'Pengenal' : 'Atur'}
          </Button>
        </div>
      </div>

      {sedang && <p className="text-[11px] text-slate-400">{sedang}</p>}
      {st.galat && (
        <p data-testid="server-galat" className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
          {st.galat}
        </p>
      )}

      {pemilik && !!st.programDitahan && (
        <div data-testid="server-program-ditahan" className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
          <p>{pesanProgramDitahan(st.programDitahan)}</p>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <ConfirmButton
              label="Kosongkan di server"
              size="md"
              testId="server-program-kosongkan"
              disabled={!mod || !!sedang || !online}
              message={`Hapus ${st.programDitahan} program di server? Semua perangkat staf ikut kehilangan program & aturan pelantikannya.`}
              onConfirm={() => {
                if (mod) void jalankan('Mengosongkan program di server…', () => mod.kosongkanProgramDiServer(), 'Program latihan di server dikosongkan')
              }}
            />
            <Button
              variant="primary"
              data-testid="server-program-ambil"
              disabled={!mod || !!sedang || !online}
              onClick={() => {
                if (!mod) return
                void jalankan('Mengambil program dari server…', async () => {
                  const n = await mod.ambilProgramDariServer()
                  toast.push(`${n} program latihan dipulihkan dari server`)
                })
              }}
            >
              Ambil dari server
            </Button>
          </div>
        </div>
      )}

      {masukAkun && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-[12px] text-slate-300">
          <p data-testid="server-akun">
            <b className="text-slate-100">{email}</b>
            {st.namaTim && <> · {st.namaTim}</>}
          </p>
          {st.belumDiundang ? (
            <p className="mt-1 text-[11px] leading-relaxed text-rose-200" data-testid="server-belum-diundang">
              Email ini belum diundang. Minta pemilik menambahkannya di Pengaturan › Kehadiran bersama, lalu ketuk Masuk lagi.
            </p>
          ) : st.peran ? (
            <>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{KET_PERAN[st.peran]}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2">
                <label className="flex items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    data-testid="server-otomatis"
                    checked={!!st.aktif}
                    onChange={(e) => {
                      if (!mod) return
                      mod.tulisStatus({ aktif: e.target.checked })
                      if (e.target.checked) mod.mulaiPenjaga()
                    }}
                  />
                  Sinkron otomatis tiap menit
                </label>
                <span data-testid="server-terakhir" className="text-[11px] text-slate-500">
                  Terakhir: {kapanSinkron(st.terakhir, Date.now())}
                  {st.terakhir && (st.dikirim || st.diterima) ? ` · ${st.dikirim ?? 0} dikirim · ${st.diterima ?? 0} diterima` : ''}
                </span>
              </div>
            </>
          ) : null}
        </div>
      )}

      {pemilik && st.timId && (
        <div data-testid="server-staf" className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-xs font-semibold text-slate-200">Staf tim</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            Selama aplikasi Google masih <b>mode uji (Testing)</b>, email yang diundang juga harus ditambahkan di Google Cloud ›
            Google Auth Platform › Audience › Test users. Tanpa itu Google menolak sebelum DrillKit sempat memeriksa undangannya.
          </p>
          {staf === null ? (
            <p className="mt-2 text-[11px] text-slate-500">{online ? 'Memuat daftar staf…' : 'Daftar staf butuh internet.'}</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-800">
              {staf.map((s) => (
                <li key={s.email} data-testid="baris-staf" className="flex flex-wrap items-center gap-2 py-2 text-[12px]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-slate-200">{s.nama || s.email}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {s.nama ? `${s.email} · ` : ''}
                      {s.masuk_at ? 'sudah masuk' : 'belum pernah masuk'}
                    </p>
                  </div>
                  <Select
                    aria-label={`Peran ${s.email}`}
                    className="!w-auto !py-1 text-xs"
                    value={s.peran}
                    disabled={s.email === email}
                    onChange={(e) =>
                      mod &&
                      void jalankan('Mengubah peran…', async () => {
                        await mod.ubahPeranStaf(st.timId!, s.email, e.target.value as PeranStaf)
                        setStaf(await mod.daftarStaf(st.timId!))
                      })
                    }
                  >
                    {DAFTAR_PERAN.map((p) => (
                      <option key={p} value={p}>
                        {LABEL_PERAN[p]}
                      </option>
                    ))}
                  </Select>
                  {s.email !== email && (
                    <ConfirmButton
                      label="Hapus"
                      message={`Hapus ${s.email}?`}
                      onConfirm={() =>
                        mod &&
                        void jalankan('Menghapus…', async () => {
                          await mod.hapusStaf(st.timId!, s.email)
                          setStaf(await mod.daftarStaf(st.timId!))
                        })
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 grid gap-2 border-t border-slate-800 pt-3 sm:grid-cols-[1.4fr_1fr_auto_auto]">
            <Input
              data-testid="undang-email"
              type="email"
              inputMode="email"
              placeholder="email Google staf"
              value={undang.email}
              onChange={(e) => setUndang({ ...undang, email: e.target.value })}
            />
            <Input
              data-testid="undang-nama"
              placeholder="nama/jabatan (opsional)"
              maxLength={60}
              value={undang.nama}
              onChange={(e) => setUndang({ ...undang, nama: e.target.value })}
            />
            <Select data-testid="undang-peran" aria-label="Peran" value={undang.peran} onChange={(e) => setUndang({ ...undang, peran: e.target.value as PeranStaf })}>
              {DAFTAR_PERAN.map((p) => (
                <option key={p} value={p}>
                  {LABEL_PERAN[p]}
                </option>
              ))}
            </Select>
            <Button variant="soft" data-testid="undang-kirim" disabled={!online || !undang.email.trim() || !!sedang} onClick={() => void kirimUndangan()}>
              Undang
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{KET_PERAN[undang.peran]}</p>
        </div>
      )}

      <Modal
        open={atur}
        onClose={() => setAtur(false)}
        title="Pengenal server kehadiran"
        testId="modal-server-atur"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAtur(false)}>
              Batal
            </Button>
            <Button variant="primary" data-testid="server-simpan" disabled={masalah.some((m) => /RAHASIA/.test(m))} onClick={() => void simpanKonfig()}>
              Simpan
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-[12px] text-slate-300">
          <p className="leading-relaxed text-slate-400">
            Ambil dari Supabase › Project Settings › API Keys. Kosongkan bila situs ini sudah membawa pengenalnya sendiri
            {konfigServer(undefined, ENV) ? (
              <> (sekarang: <b className="text-slate-200">{refProyek(konfigServer(undefined, ENV)!.url)}</b>)</>
            ) : null}
            .
          </p>
          <Field label="Project URL">
            <Input data-testid="server-url" placeholder="https://xxxx.supabase.co" value={draf.url ?? ''} onChange={(e) => setDraf({ ...draf, url: e.target.value })} />
          </Field>
          <Field label="Publishable key" hint="Kunci publik, aman di aplikasi. JANGAN tempel secret/service_role key.">
            <Input data-testid="server-kunci" placeholder="sb_publishable_…" value={draf.kunci ?? ''} onChange={(e) => setDraf({ ...draf, kunci: e.target.value })} />
          </Field>
          {masalah.length > 0 && (
            <ul data-testid="server-masalah" className="list-disc space-y-1 pl-5 text-[11px] text-amber-300">
              {masalah.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  )
}
