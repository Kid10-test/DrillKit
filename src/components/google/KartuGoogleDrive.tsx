/**
 * v2.10.1 — Pengaturan › Google Drive: atur pengenal proyek, sambungkan,
 * backup otomatis ke Drive, dan pulihkan dari Drive.
 */
import { useEffect, useState } from 'react'
import type { KonfigGoogleTim } from '../../db/types'
import { saveSettings } from '../../db/db'
import { useSettings } from '../../hooks/useSettings'
import { Badge, Button, Input, Modal, useToast } from '../ui'
import { formatBytes } from '../../lib/backup'
import {
  JEDA_BACKUP_DRIVE_MS,
  backupKeDrive,
  bacaStatusBackupDrive,
  tulisStatusBackupDrive,
  type StatusBackupDrive,
} from '../../lib/backupDrive'
import { adaIzinGoogle, sisaIzin, useGoogle } from './useGoogle'
import type { BerkasDrive } from '../../lib/googleDrive'

function kapan(at?: number): string {
  if (!at) return 'belum pernah'
  const beda = Date.now() - at
  if (beda < 60_000) return 'baru saja'
  if (beda < 3_600_000) return `${Math.floor(beda / 60_000)} menit lalu`
  if (beda < 86_400_000) return `${Math.floor(beda / 3_600_000)} jam lalu`
  const hari = Math.floor(beda / 86_400_000)
  return hari === 1 ? 'kemarin' : `${hari} hari lalu`
}

function useStatusBackup(): StatusBackupDrive {
  const [st, setSt] = useState(bacaStatusBackupDrive)
  useEffect(() => {
    const f = () => setSt(bacaStatusBackupDrive())
    window.addEventListener('drillkit-backup-drive', f)
    return () => window.removeEventListener('drillkit-backup-drive', f)
  }, [])
  return st
}

export function KartuGoogleDrive({ onPulihkan }: { onPulihkan: (f: File) => void }) {
  const toast = useToast()
  const settings = useSettings()
  const g = useGoogle()
  const st = useStatusBackup()
  const [atur, setAtur] = useState(false)
  const [draf, setDraf] = useState<KonfigGoogleTim>({})
  const [akun, setAkun] = useState<string>('')
  const [sedang, setSedang] = useState('')
  const [daftar, setDaftar] = useState<BerkasDrive[] | null>(null)

  useEffect(() => {
    if (!g.tersambung || !g.mod) {
      setAkun('')
      return
    }
    let hidup = true
    void g.mod.akun().then((a) => hidup && setAkun(a ? a.email : ''))
    return () => {
      hidup = false
    }
  }, [g.tersambung, g.mod])

  const masalah = g.mod ? g.mod.periksaKonfig(draf) : []

  async function simpanKonfig() {
    const bersih: KonfigGoogleTim = {
      clientId: draf.clientId?.trim() || undefined,
      apiKey: draf.apiKey?.trim() || undefined,
      appId: draf.appId?.trim() || undefined,
    }
    await saveSettings({ google: bersih.clientId || bersih.apiKey || bersih.appId ? bersih : undefined })
    setAtur(false)
    toast.push('Pengenal Google disimpan')
  }

  async function sambung() {
    if (!g.mod || !g.konfig) return
    try {
      await g.mod.sambung(g.konfig, { pilihAkun: !g.tersambung })
      toast.push('Google Drive tersambung')
      if (st.aktif) void jalankanBackup(false)
    } catch (e) {
      toast.push(g.mod.pesanGalat(e), 'err')
    }
  }

  async function jalankanBackup(paksa: boolean) {
    setSedang('Mengunggah backup…')
    try {
      const r = await backupKeDrive(settings.google, { paksa })
      if (r.hasil === 'tersimpan') toast.push('Backup tersimpan di Google Drive')
      else if (paksa && r.hasil === 'perlu-sambung') toast.push('Izin Google habis — ketuk Sambungkan dulu', 'info')
      else if (paksa && r.hasil === 'offline') toast.push('Sedang offline', 'info')
      else if (r.hasil === 'gagal') toast.push(r.pesan ?? 'Backup ke Drive gagal', 'err')
    } finally {
      setSedang('')
    }
  }

  async function bukaDaftar() {
    if (!g.mod || !g.konfig) return
    setSedang('Membuka folder backup…')
    try {
      await g.mod.sambung(g.konfig)
      const f = await g.mod.folderBackup(st.folderId)
      if (f.id !== st.folderId) tulisStatusBackupDrive({ folderId: f.id, folderLink: f.webViewLink })
      setDaftar(await g.mod.daftarBackup(f.id))
    } catch (e) {
      toast.push(g.mod.pesanGalat(e), 'err')
    } finally {
      setSedang('')
    }
  }

  async function pulihkan(b: BerkasDrive) {
    if (!g.mod) return
    setSedang(`Mengunduh ${b.name}…`)
    try {
      const teks = await g.mod.unduhTeks(b.id)
      setDaftar(null)
      onPulihkan(new File([teks], b.name, { type: 'application/json' }))
    } catch (e) {
      toast.push(g.mod.pesanGalat(e), 'err')
    } finally {
      setSedang('')
    }
  }

  const terkunci = !g.online
  const adaKonfig = !!g.konfig

  return (
    <div data-testid="kartu-google-drive" className="mb-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-slate-200">Google Drive</p>
            {!adaKonfig ? (
              <Badge className="border-slate-700 bg-slate-800/60 text-slate-400">belum diatur</Badge>
            ) : terkunci ? (
              <Badge className="border-slate-700 bg-slate-800/60 text-slate-400">butuh internet</Badge>
            ) : g.tersambung ? (
              <Badge className="border-emerald-800 bg-emerald-950/50 text-emerald-300">tersambung</Badge>
            ) : (
              <Badge className="border-amber-800 bg-amber-950/50 text-amber-300">belum tersambung</Badge>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Ambil rundown dari Google Docs/Sheets, tarik isian Google Form, dan simpan backup ke folder <b>DrillKit Backup</b>. DrillKit
            hanya bisa membuka berkas yang kamu pilih sendiri dan berkas yang ia buat. Izin berlaku ±1 jam; sesudah itu cukup ketuk
            Sambungkan lagi. Fitur lain tetap jalan tanpa internet.
          </p>
          {g.tersambung && (
            <p data-testid="google-akun" className="mt-1 text-[11px] text-slate-400">
              {akun ? <b className="text-slate-200">{akun}</b> : 'Akun Google'} · izin berlaku {sisaIzin(g.habis)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {adaKonfig && (
            <Button variant={g.tersambung ? 'ghost' : 'primary'} data-testid="google-sambung" disabled={terkunci} onClick={() => void sambung()}>
              {g.tersambung ? 'Ganti akun' : 'Sambungkan'}
            </Button>
          )}
          {g.tersambung && g.mod && (
            <Button variant="ghost" data-testid="google-putus" onClick={() => g.mod!.putus()}>
              Putuskan
            </Button>
          )}
          <Button
            variant="ghost"
            data-testid="google-atur"
            onClick={() => {
              setDraf({ ...(settings.google ?? {}) })
              setAtur(true)
            }}
          >
            {adaKonfig ? 'Pengenal' : 'Atur'}
          </Button>
        </div>
      </div>

      {adaKonfig && (
        <div className="mt-3 border-t border-slate-800 pt-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <label className="flex min-w-0 flex-1 items-start gap-2 text-[12px] text-slate-300">
              <input
                type="checkbox"
                data-testid="backup-drive-aktif"
                className="mt-0.5"
                checked={st.aktif}
                onChange={(e) => {
                  tulisStatusBackupDrive({ aktif: e.target.checked })
                  if (e.target.checked && adaIzinGoogle()) void jalankanBackup(false)
                }}
              />
              <span>
                Backup otomatis ke Drive
                <span className="block text-[11px] text-slate-500">
                  Satu berkas per hari, 14 hari terakhir disimpan. Diunggah sendiri bila ada perubahan (paling sering tiap{' '}
                  {JEDA_BACKUP_DRIVE_MS / 60_000} menit) selama tersambung. Terakhir: {kapan(st.at)}
                  {st.bytes ? ` · ${formatBytes(st.bytes)}` : ''}.
                </span>
                {st.galat && <span className="block text-[11px] text-amber-300">Gagal terakhir: {st.galat}</span>}
                {st.aktif && !g.tersambung && !terkunci && (
                  <span data-testid="backup-drive-menunggu" className="block text-[11px] text-amber-300">
                    Menunggu tersambung — ketuk Sambungkan supaya backup berjalan.
                  </span>
                )}
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="soft" data-testid="backup-drive-sekarang" disabled={terkunci || !g.tersambung || !!sedang} onClick={() => void jalankanBackup(true)}>
                Backup sekarang
              </Button>
              <Button size="sm" variant="ghost" data-testid="pulihkan-dari-drive" disabled={terkunci || !!sedang} onClick={() => void bukaDaftar()}>
                Pulihkan dari Drive…
              </Button>
              {st.folderLink && (
                <a href={st.folderLink} target="_blank" rel="noreferrer" className="self-center text-[11px] text-emerald-300 underline">
                  Buka folder
                </a>
              )}
            </div>
          </div>
          {sedang && <p className="mt-2 text-[11px] text-slate-400">{sedang}</p>}
        </div>
      )}

      <Modal open={atur} onClose={() => setAtur(false)} title="Pengenal Google" testId="modal-pengenal-google">
        <div className="space-y-3 text-[12px] text-slate-300">
          <p className="text-[11px] leading-relaxed text-slate-500">
            Dari proyek Google Cloud milikmu (sekali saja, ±15 menit, gratis). Ketiganya bukan kata sandi; yang menjaga akses tetap jendela izin
            Google di akunmu.
          </p>
          <details data-testid="google-langkah" className="rounded-lg border border-slate-800 px-3 py-2 text-[11px] text-slate-400">
            <summary className="cursor-pointer text-slate-300">Langkah di console.cloud.google.com</summary>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 leading-relaxed">
              <li>
                <b>New project</b> → catat <b>Project number</b> (angka saja) di Dashboard.
              </li>
              <li>
                <b>APIs &amp; Services → Library</b>: Enable <b>Google Drive API</b>, <b>Google Sheets API</b>, <b>Google Picker API</b>.
              </li>
              <li>
                <b>Google Auth Platform</b>: Audience <b>External</b>, status <b>Testing</b>, tambahkan akunmu di <b>Test users</b>; Data access →
                scope <code>drive.file</code>.
              </li>
              <li>
                <b>Clients → Create client</b> → Web application → Authorized JavaScript origins = alamat di bawah → salin Client ID.
              </li>
              <li>
                <b>Credentials → API key</b> → batasi ke situs ini dan ke <b>Google Picker API</b> → salin.
              </li>
            </ol>
            <p className="mt-1.5">Saat menyambung muncul “Google hasn’t verified this app” — tekan Continue; aplikasinya milikmu sendiri.</p>
          </details>
          <label className="block">
            Client ID (OAuth, jenis Web)
            <Input data-testid="google-client-id" value={draf.clientId ?? ''} onChange={(e) => setDraf({ ...draf, clientId: e.target.value })} placeholder="123456789012-xxxx.apps.googleusercontent.com" />
          </label>
          <label className="block">
            API key
            <Input data-testid="google-api-key" value={draf.apiKey ?? ''} onChange={(e) => setDraf({ ...draf, apiKey: e.target.value })} placeholder="AIza…" />
          </label>
          <label className="block">
            Nomor proyek
            <Input data-testid="google-app-id" inputMode="numeric" value={draf.appId ?? ''} onChange={(e) => setDraf({ ...draf, appId: e.target.value })} placeholder="123456789012" />
          </label>
          <p className="text-[11px] text-slate-500">
            Alamat aplikasi ini — daftarkan di “Authorized JavaScript origins”:{' '}
            <code data-testid="google-origin" className="select-all text-slate-300">
              {typeof window !== 'undefined' ? window.location.origin : ''}
            </code>
          </p>
          {masalah.length > 0 && (
            <ul data-testid="google-masalah" className="space-y-0.5 text-[11px] text-amber-300">
              {masalah.map((m) => (
                <li key={m}>⚠ {m}</li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAtur(false)}>
              Batal
            </Button>
            <Button variant="primary" data-testid="google-simpan" onClick={() => void simpanKonfig()}>
              Simpan
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={daftar != null} onClose={() => setDaftar(null)} title="Pulihkan dari Google Drive" testId="modal-pulih-drive">
        {daftar && daftar.length === 0 ? (
          <p className="text-[12px] text-slate-400">Belum ada backup di folder DrillKit Backup.</p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[11px] text-slate-500">Pilih satu — isinya dibuka di pratinjau pemulihan dulu, belum langsung ditulis.</p>
            {(daftar ?? []).map((b) => (
              <button
                key={b.id}
                type="button"
                data-testid="pulih-drive-butir"
                onClick={() => void pulihkan(b)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2 text-left text-[12px] text-slate-200 hover:bg-slate-800"
              >
                <span className="truncate">{b.name}</span>
                <span className="shrink-0 text-[11px] text-slate-500">{b.modifiedTime ? new Date(b.modifiedTime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
