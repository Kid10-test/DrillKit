import { capBuildTeks } from '../lib/capBuild'
import { cx } from '../lib/utils'
import {
  dariBerkas,
  periksaSitus,
  ringkasPeriksa,
  type Ambil,
  type HasilPeriksa,
} from '../lib/situs'
import { useEffect, useState } from 'react'
import { db } from '../db/db'
import type { TeamSettings } from '../db/types'
import { seedDemoData, wipeAllData } from '../db/seed'
import { useSettings } from '../hooks/useSettings'
import {
  Button,
  Card,
  ConfirmButton,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Toggle,
  useToast,
} from '../components/ui'
import { IconDownload, IconUpload } from '../components/Icons'
import { backupNotes, daysSince, downloadBackup, downloadBackupZip, formatBytes, lastBackup } from '../lib/backup'
import { KartuSimpanOtomatis } from '../components/SimpanOtomatis'
import { AMBANG, AMBANG_LANGKAH } from '../lib/analitik'
import type { AmbangTingkat } from '../db/types'
import { PREDIKAT_BAKU, rapikanPredikat, teksAmbangPredikat } from '../lib/laporan'
import { KioskPinCard } from '../components/KioskLock'
import KartuPanduan from '../components/Panduan'
import { bacaTampilan, langgananTampilan, ubahTampilan } from '../lib/tampilan'
import type { Tampilan } from '../lib/tampilan'
import { PilihModeNama } from '../components/PilihModeNama'
import { KartuTerbit } from '../components/KartuTerbit'
import {
  BUILTIN_SECTIONS,
  applySectionConfig,
  formatDateLong,
  readFileAsDataURL,
  uid,
} from '../lib/utils'
import { FieldConfigEditor } from '../components/FieldConfigEditor'
import { FIELD_PRESETS, activePreset } from '../lib/field'
import { kenaliBerkas } from '../lib/bukaBerkas'
import { mintaPratinjau } from '../components/BukaBerkas'
import {
  AlurPulihkanBackup,
  ekstrakAudioZip,
  ekstrakPartiturZip,
  type AudioPulih,
  type PartiturPulih,
} from '../components/PulihkanBackup'

export default function Settings() {
  const toast = useToast()
  const settings = useSettings()
  const [form, setForm] = useState<TeamSettings | null>(null)
  /**
   * N12 — pengambil untuk pemeriksaan situs.
   *
   * `HEAD` dipakai bila yang dibutuhkan hanya "ada atau tidak" —
   * mengunduh bundel hampir 1 MB sekadar untuk mengecek keberadaannya
   * jelas berlebihan. `GET` dipakai hanya untuk `index.html`, yang
   * isinya memang perlu dibaca untuk mengetahui berkas mana yang akan
   * diminta perambah.
   */
  const ambilSitus: Ambil = async (alamat, metode = 'GET') => {
    const url = new URL(alamat, document.baseURI).href
    const res = await fetch(url, { cache: 'no-store', method: metode })
    return {
      status: res.status,
      jenis: (res.headers.get('content-type') ?? '').toLowerCase(),
      teks: metode === 'GET' ? await res.text().catch(() => '') : '',
      cacheKontrol: (res.headers.get('cache-control') ?? '').toLowerCase(),
    }
  }

  const [hasilSitus, setHasilSitus] = useState<HasilPeriksa[] | null>(null)
  const [sedangPeriksa, setSedangPeriksa] = useState(false)

  /*
   * Pemeriksaan situs sengaja TIDAK dijalankan otomatis saat halaman
   * dibuka: setiap pemeriksaan memicu permintaan jaringan, dan halaman
   * ini dibuka juga oleh perangkat yang sedang hemat kuota. Pemakai
   * yang menekan tombolnya sedang mencari jawaban; pemakai yang
   * sekadar membuka pengaturan belum tentu.
   */
  async function jalankanPeriksaSitus() {
    setSedangPeriksa(true)
    try {
      setHasilSitus(await periksaSitus(ambilSitus))
    } catch {
      // `periksaSitus` tidak pernah melempar; ini hanya pengaman.
      setHasilSitus([])
    } finally {
      setSedangPeriksa(false)
    }
  }

  const [confirmWipe, setConfirmWipe] = useState(false)
  /** B4 — pengaturan kontras tinggi & huruf besar. */
  const [tampilan, setTampilan] = useState<Tampilan>(bacaTampilan)
  useEffect(() => langgananTampilan(setTampilan), [])
  // #7 — berkas yang menunggu dipulihkan (selalu lewat pratinjau dulu).
  const [pulihBackup, setPulihBackup] = useState<{
    data: Record<string, any>
    audio: AudioPulih[]
    partitur: PartiturPulih[]
    nama: string
  } | null>(null)

  /** Riwayat backup — diisi saat halaman dibuka & setelah mengunduh backup. */
  const [catatanBackup, setCatatanBackup] = useState(() => backupNotes())
  useEffect(() => setCatatanBackup(backupNotes()), [])
  const backupTerakhir = lastBackup()
  const hariSejakBackup = daysSince(backupTerakhir?.at)

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  if (!form) return null

  const patch = (p: Partial<TeamSettings>) => setForm({ ...form, ...p })

  async function save() {
    // J1 — ambang predikat dirapikan saat disimpan (jepit 0–100, urutan
    // terbalik ditukar), jadi yang tersimpan selalu sama dengan pratinjaunya.
    const simpan: TeamSettings = form!.ambangPredikat
      ? { ...form!, ambangPredikat: rapikanPredikat(form!.ambangPredikat) }
      : form!
    await db.settings.put(simpan)
    setForm(simpan)
    applySectionConfig(form!.sections)
    toast.push('Pengaturan disimpan')
  }

  /**
   * Mengunduh backup lewat modul `lib/backup.ts` supaya otomatis tercatat di
   * riwayat — catatan itu yang dipakai pengingat di Dashboard.
   */
  async function exportBackup() {
    await downloadBackup()
    setCatatanBackup(backupNotes())
    toast.push('Backup diunduh — simpan di tempat aman')
  }

  /** #6/#11a — Unduh ZIP bersama data, audio, dan berkas partitur biner. */
  async function exportBackupZip() {
    await downloadBackupZip()
    setCatatanBackup(backupNotes())
    toast.push('Backup lengkap + rekaman dan partitur (ZIP) diunduh')
  }

  /**
   * #7 — pulihkan backup: kenali dari isi, selalu pratinjau, tolak paket.
   *
   * - Backup (JSON/ZIP) → dibuka di pratinjau pemulihan (tidak langsung ditulis).
   * - Paket anggota → DITOLAK dengan jelas (dulu ikut diterima!).
   * - Jenis lain → dialihkan ke pratinjau yang benar, bukan ditolak.
   */
  async function importBackup(file: File) {
    try {
      const bita = new Uint8Array(await file.arrayBuffer())
      const hasil = kenaliBerkas(file.name, bita)
      if (hasil.jenis === 'backup' || hasil.jenis === 'zip-backup') {
        const audio = hasil.jenis === 'zip-backup' ? ekstrakAudioZip(bita) : []
        const partitur = hasil.jenis === 'zip-backup' ? ekstrakPartiturZip(bita) : []
        setPulihBackup({ data: (hasil.data ?? {}) as Record<string, any>, audio, partitur, nama: file.name })
        return
      }
      if (hasil.jenis === 'paket' || hasil.jenis === 'zip-anggota') {
        toast.push(
          'Ini paket untuk anggota — tidak bisa dipulihkan sebagai backup. ' +
            'Paket hanya berisi salinan baca-saja; memulihkannya akan mencampur data pelatih.',
          'err',
        )
        return
      }
      mintaPratinjau(hasil, bita)
    } catch {
      toast.push('Gagal membaca berkas', 'err')
    }
  }

  return (
    <div>
      <PageHeader
        title="Pengaturan"
        subtitle="Profil tim, standar lapangan, dan kelola data"
        actions={
          <Button variant="primary" onClick={save}>
            Simpan
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <KartuTerbit />
        {/* Profil */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Profil tim</h2>
          <div className="space-y-3">
            <Field label="Nama tim">
              <Input value={form.teamName} onChange={(e) => patch({ teamName: e.target.value })} />
            </Field>
            <Field label="Nama pelatih">
              <Input value={form.coachName} onChange={(e) => patch({ coachName: e.target.value })} />
            </Field>
            <Field label="Kota / asal" hint="opsional">
              <Input value={form.city ?? ''} onChange={(e) => patch({ city: e.target.value })} />
            </Field>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Logo tim (opsional)</label>
              <div className="flex items-center gap-3">
                {form.logo && <img src={form.logo} alt="logo" className="h-12 w-12 rounded-lg object-cover" />}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const url = await readFileAsDataURL(f)
                    patch({ logo: url })
                  }}
                  className="text-xs text-slate-400"
                />
                {form.logo && (
                  <Button size="sm" variant="ghost" onClick={() => patch({ logo: undefined })}>
                    Hapus logo
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Lapangan */}
        {/* B4 — Tampilan */}
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-slate-200">Tampilan layar</h2>
          <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
            Untuk HP yang kena matahari saat latihan di luar ruangan.
          </p>
          <div className="space-y-2" data-testid="kartu-tampilan">
            <Toggle
              checked={tampilan.kontras}
              onChange={(v) => setTampilan(ubahTampilan({ kontras: v }))}
              label="Kontras tinggi"
            />
            <Toggle
              checked={tampilan.besar}
              onChange={(v) => setTampilan(ubahTampilan({ besar: v }))}
              label="Huruf besar"
            />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            <b className="text-slate-400">Kontras tinggi</b> menjadikan latar lebih
            hitam, teks kecil lebih terang, batas kartu lebih tegas, dan lapangan
            lebih pekat. <b className="text-slate-400">Huruf besar</b> memperbesar
            seluruh antarmuka sekitar 20%. Keduanya tetap diingat setelah aplikasi
            ditutup, dan bisa dinyalakan cepat lewat chip <b>Kontras</b> dan
            <b> Huruf</b> di presenter.
          </p>
          <div className="mt-3 border-t border-slate-800 pt-3">
            <p className="mb-1 text-xs font-medium text-slate-300">Nama anggota</p>
            <PilihModeNama />
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-200">Standar lapangan (bawaan drill baru)</h2>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {FIELD_PRESETS.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={activePreset(form.defaultField) === p.id ? 'primary' : 'soft'}
                onClick={() =>
                  patch({
                    defaultField: {
                      ...form.defaultField,
                      showLabels: 1,
                      gridTampil: 1,
                      subgridTampil: 0,
                      subgridYd: undefined,
                      hashTampil: p.config.hash && p.config.hash !== 'none' ? 1 : 0,
                      ...p.config,
                    },
                  })
                }
                title={p.hint}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <FieldConfigEditor value={form.defaultField} onChange={(f) => patch({ defaultField: f })} />
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-1 text-sm font-semibold text-slate-200">Ambang kesulitan gerak</h2>
          <p className="mb-3 text-[11px] leading-snug text-slate-500">
            Dipakai <b>bersama</b> oleh panel <b>Analitik gerakan</b> di editor dan{' '}
            <b>buku saku</b> yang dicetak, supaya keduanya tidak pernah memberi jawaban
            berbeda. Gerakan dinilai dari dua hal: seberapa <b>cepat</b> kaki bergerak, dan
            seberapa <b>jauh</b> satu langkah harus menjangkau — yang dipakai adalah yang lebih
            berat dari keduanya. Angka bawaan mengikuti kebiasaan marching band pada umumnya;
            ubah bila timmu punya patokan sendiri.
          </p>
          <div className="grid gap-3 sm:grid-cols-2" data-testid="kartu-ambang-gerak">
            <AmbangBaris
              judul="Kecepatan (langkah/menit)"
              nama="perMenit"
              nilai={form.ambangGerak?.perMenit}
              bawaan={AMBANG}
              onChange={(v) => patch({ ambangGerak: { ...form.ambangGerak, perMenit: v } })}
            />
            <AmbangBaris
              judul="Ukuran langkah (inci)"
              nama="inci"
              nilai={form.ambangGerak?.inci}
              bawaan={AMBANG_LANGKAH}
              onChange={(v) => patch({ ambangGerak: { ...form.ambangGerak, inci: v } })}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[10px] leading-snug text-slate-500">
              Tingkat ditentukan dengan <b>di atas</b> ambang: misal 22,5 inci masih{' '}
              <i>nyaman</i>, sedangkan 22,6 inci sudah <i>padat</i>. Urutan yang salah ketik
              akan dirapikan sendiri.
            </p>
            <Button
              type="button"
              variant="ghost"
              className="shrink-0 px-2 py-1 text-[11px]"
              onClick={() => patch({ ambangGerak: undefined })}
              data-testid="ambang-kembali-bawaan"
            >
              Kembalikan ke bawaan
            </Button>
          </div>
        </Card>

        {/* J1 — Ambang predikat laporan */}
        <Card className="lg:col-span-2" data-testid="kartu-ambang-predikat">
          <h2 className="mb-1 text-sm font-semibold text-slate-200">Predikat kartu kehadiran</h2>
          <p className="mb-3 text-[11px] leading-snug text-slate-500">
            Menentukan kata di kolom <b>Predikat</b> pada <b>kartu kehadiran</b> dan <b>CSV ringkas</b>{' '}
            (menu Absensi → Rekap → Paket laporan admin). Isi persen hadir <b>minimum</b> untuk tiap
            predikat; di bawah ambang <i>Cukup</i> tertulis <i>Perlu perhatian</i>. Ambangnya ikut
            tercetak di setiap kartu, jadi pembina tahu arti kata itu di tim ini.
          </p>
          <div className="grid max-w-md grid-cols-2 gap-3">
            <KolomPersen
              label="Baik — mulai dari"
              testId="predikat-baik"
              nilai={(form.ambangPredikat ?? PREDIKAT_BAKU).baik}
              onChange={(v) => patch({ ambangPredikat: { ...(form.ambangPredikat ?? PREDIKAT_BAKU), baik: v } })}
            />
            <KolomPersen
              label="Cukup — mulai dari"
              testId="predikat-cukup"
              nilai={(form.ambangPredikat ?? PREDIKAT_BAKU).cukup}
              onChange={(v) => patch({ ambangPredikat: { ...(form.ambangPredikat ?? PREDIKAT_BAKU), cukup: v } })}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] leading-snug text-slate-400">
              Tercetak: <b className="text-slate-200" data-testid="pratinjau-predikat">{teksAmbangPredikat(form.ambangPredikat)}</b>
              {!form.ambangPredikat && <span className="text-slate-500"> (bawaan)</span>}
            </p>
            <Button
              type="button"
              variant="ghost"
              className="shrink-0 px-2 py-1 text-[11px]"
              onClick={() => patch({ ambangPredikat: undefined })}
              data-testid="predikat-kembali-bawaan"
            >
              Kembalikan ke bawaan
            </Button>
          </div>
          <p className="mt-2 text-[10px] leading-snug text-slate-500">
            Ambang <b>Cukup</b> juga menjadi ambang <b>“Perlu perhatian”</b> di tab Rekap — daftar
            anggota yang disorot di layar dan di laporan — jadi kartu dan daftar itu selalu sepakat.
            Tekan <b>Simpan</b> di atas setelah mengubah angka.
          </p>
        </Card>

        {/* Section */}
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Section / kelompok instrumen</h2>
            <Button
              size="sm"
              onClick={() =>
                patch({
                  sections: [
                    ...(form.sections ?? []),
                    { id: uid('sec_'), label: 'Section baru', short: 'SB', dot: '#38bdf8', hidden: 0 },
                  ],
                })
              }
            >
              + Tambah section
            </Button>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            Nama & warna section dipakai di seluruh aplikasi: daftar anggota, warna titik di chart
            formasi, filter, dan statistik. Urutan di bawah juga menjadi urutan di pilihan section.
          </p>
          <div className="space-y-2">
            {(form.sections ?? []).map((sec, i) => (
              <div key={sec.id} className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  value={sec.dot}
                  onChange={(e) => {
                    const sections = [...(form.sections ?? [])]
                    sections[i] = { ...sec, dot: e.target.value }
                    patch({ sections })
                  }}
                  className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-700 bg-slate-950 p-0.5"
                  title="Warna titik di chart"
                />
                <Input
                  value={sec.label}
                  onChange={(e) => {
                    const sections = [...(form.sections ?? [])]
                    sections[i] = { ...sec, label: e.target.value }
                    patch({ sections })
                  }}
                  className="min-w-[140px] flex-1"
                  placeholder="Nama section"
                />
                <Input
                  value={sec.short}
                  onChange={(e) => {
                    const sections = [...(form.sections ?? [])]
                    sections[i] = { ...sec, short: e.target.value.slice(0, 4) }
                    patch({ sections })
                  }}
                  className="w-20"
                  placeholder="Singk."
                  title="Singkatan (maks 4 huruf)"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const sections = [...(form.sections ?? [])]
                    sections[i] = { ...sec, hidden: sec.hidden ? 0 : 1 }
                    patch({ sections })
                  }}
                  title={sec.hidden ? 'Munculkan di pilihan' : 'Sembunyikan dari pilihan'}
                  className={sec.hidden ? 'text-slate-500' : ''}
                >
                  {sec.hidden ? 'Disembunyikan' : 'Ditampilkan'}
                </Button>
                <button
                  onClick={() => patch({ sections: (form.sections ?? []).filter((x) => x.id !== sec.id) })}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-rose-300"
                  title="Hapus section"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const have = new Set((form.sections ?? []).map((x) => x.id))
                const missing = BUILTIN_SECTIONS.filter((b) => !have.has(b.id)).map((b) => ({ ...b, hidden: 0 }))
                if (!missing.length) return
                patch({ sections: [...(form.sections ?? []), ...missing] })
              }}
            >
              Pulihkan section bawaan
            </Button>
            <span className="self-center text-[11px] text-slate-500">
              Menyembunyikan section tidak menghapus data anggotanya.
            </span>
          </div>
        </Card>

        {/* Data */}
        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Kelola data</h2>
          <p className="mb-4 text-xs leading-relaxed text-slate-500">
            Semua data tersimpan <b>hanya di perangkat ini</b> (browser). Tidak ada server, jadi gratis dan tetap
            bisa dipakai offline. Konsekuensinya: <b>backup adalah tanggung jawab kamu</b> — ekspor berkala, simpan
            di Google Drive/email, dan pulihkan kalau ganti HP atau hapus data browser.
          </p>
          {/* 1b — simpan otomatis: sekali pilih berkas, aplikasi menulis sendiri. */}
          <KartuSimpanOtomatis />

          {/* Status & pengingat backup */}
          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200">Backup terakhir</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {backupTerakhir ? (
                    <>
                      {formatDateLong(new Date(backupTerakhir.at).toISOString().slice(0, 10))} ·{' '}
                      {formatBytes(backupTerakhir.bytes)} · {backupTerakhir.members} anggota ·{' '}
                      {backupTerakhir.drills} drill
                      {hariSejakBackup !== null &&
                        (hariSejakBackup === 0
                          ? ' · hari ini'
                          : ` · ${hariSejakBackup} hari lalu`)}
                    </>
                  ) : (
                    'Belum pernah backup'
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-500">Ingatkan tiap</label>
                <Select
                  value={String(form.backupIntervalDays ?? 7)}
                  onChange={(e) => patch({ backupIntervalDays: Number(e.target.value) })}
                  className="w-24 py-1 text-xs"
                >
                  <option value="0">Mati</option>
                  <option value="3">3 hari</option>
                  <option value="7">7 hari</option>
                  <option value="14">14 hari</option>
                  <option value="30">30 hari</option>
                </Select>
              </div>
            </div>
            {catatanBackup.length > 0 && (
              <div className="mt-3 border-t border-slate-800 pt-2">
                <p className="mb-1 text-[11px] text-slate-500">Riwayat backup</p>
                <ul className="space-y-1">
                  {catatanBackup.slice(0, 5).map((n) => (
                    <li key={n.at} className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-400">
                      <span>{new Date(n.at).toLocaleString('id-ID')}</span>
                      <span className="text-slate-500">
                        {formatBytes(n.bytes)} · {n.members} anggota · {n.drills} drill · {n.sets} set
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={exportBackup}>
              <IconDownload size={16} /> Ekspor backup (JSON)
            </Button>
            <Button onClick={exportBackupZip} variant="outline" title="Ekspor data tim beserta rekaman audio dan berkas partitur MusicXML/PDF">
              <IconDownload size={16} /> Backup + rekaman (ZIP)
            </Button>
            <Button
              onClick={() => document.getElementById('restore-input')?.click()}
            >
              <IconUpload size={16} /> Pulihkan backup (JSON / ZIP)
            </Button>
            <input
              id="restore-input"
              type="file"
              accept=".json,.csv,.zip,application/json,text/csv,application/zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importBackup(f)
                e.target.value = ''
              }}
            />
            <Button
              onClick={async () => {
                const n = await seedDemoData()
                toast.push(n ? `Data contoh dimuat (${n} anggota)` : 'Data contoh sudah ada', n ? 'ok' : 'info')
              }}
            >
              Muat data contoh
            </Button>
            <ConfirmButton
              size="md"
              label="Kosongkan semua data"
              message="Yakin? Semua data akan hilang"
              onConfirm={async () => {
                await wipeAllData()
                setConfirmWipe(false)
                toast.push('Semua data dikosongkan', 'info')
              }}
            />
          </div>
        </Card>

        <div className="lg:col-span-2">
          <KioskPinCard />
        </div>

        {/* F4 — Panduan 1 halaman */}
        <KartuPanduan />

        {/* Tentang */}
        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Cara pakai di HP (mode offline)</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-400">
            <li>Buka aplikasi ini di browser HP (Chrome/Android atau Safari/iOS).</li>
            <li>
              Android: menu ⋮ → <b>“Install aplikasi”</b> / “Tambahkan ke layar utama”. iOS: tombol Bagikan →{' '}
              <b>“Add to Home Screen”</b>.
            </li>
            <li>Setelah terpasang, aplikasi terbuka seperti aplikasi biasa dan tetap jalan tanpa sinyal.</li>
            <li>Absensi QR butuh kamera; kalau gagal, gunakan kolom ketik kode/nama.</li>
          </ol>
        </Card>

        {/* N5 — cap rilis: satu-satunya penanda jujur tentang versi yang
            sedang berjalan. Sengaja diletakkan di halaman yang bisa
            dibuka di HP, karena bilah sisinya tidak tampil di layar
            sempit — padahal HP-lah yang paling sering menyimpan versi
            lama lewat service worker. */}
        <Card className="lg:col-span-2" data-testid="kartu-rilis">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Rilis yang sedang berjalan</h2>
          <p className="text-xs leading-relaxed text-slate-400">
            Dibangun{' '}
            <b className="font-semibold text-slate-200 tabular-nums" data-testid="cap-build">
              {capBuildTeks()}
            </b>
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Kalau tanggalnya <b>tidak</b> berubah padahal Anda baru saja mengunggah rilis baru ke
            hosting, berarti perangkat ini masih memakai simpanan lama. <b>Tutup aplikasinya
            sampai benar-benar berhenti, lalu buka kembali</b> — atau buka di jendela penyamaran.
            Berkas latihan Anda tidak akan hilang karenanya.
          </p>
        </Card>

        {/* N12 — pemeriksaan kesehatan situs, dijalankan dari HP sendiri.
            Sengaja ada dua jalur: skrip `periksa-situs.sh` untuk yang
            punya terminal, dan kartu ini untuk yang tidak. Alat
            diagnosis yang tidak bisa dijangkau tidak menolong siapa
            pun — dan keadaan yang paling perlu diperiksa justru muncul
            saat pelatih hanya memegang HP. */}
        <Card className="lg:col-span-2" data-testid="kartu-situs">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Kesehatan situs</h2>
          <p className="text-xs leading-relaxed text-slate-400">
            Memeriksa apakah berkas yang diminta perambah benar-benar ada di situs ini.
            Hasilnya berlaku untuk <b>semua</b> perangkat yang membuka alamat yang sama —
            jadi pemeriksaan dari HP Anda bisa menjelaskan mengapa HP anggota yang gagal.
          </p>

          {dariBerkas() ? (
            <p
              className="mt-3 text-[11px] leading-relaxed text-slate-500"
              data-testid="situs-dari-berkas"
            >
              Aplikasi dibuka langsung dari berkas, bukan dari situs — pemeriksaan ini tidak
              berlaku.
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  data-testid="tombol-periksa-situs"
                  onClick={jalankanPeriksaSitus}
                  disabled={sedangPeriksa}
                >
                  {sedangPeriksa ? 'Memeriksa…' : 'Periksa sekarang'}
                </Button>
                {hasilSitus && (
                  <span className="text-xs text-slate-400" data-testid="ringkasan-periksa-situs">
                    {ringkasPeriksa(hasilSitus)}
                  </span>
                )}
              </div>

              {hasilSitus && hasilSitus.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {hasilSitus.map((h) => (
                    <li
                      key={h.id}
                      data-testid={`hasil-periksa-${h.id}`}
                      className={cx(
                        'rounded-lg border px-3 py-2 text-[11px] leading-relaxed',
                        h.keadaan === 'baik'
                          ? 'border-emerald-600/30 bg-emerald-600/5 text-slate-300'
                          : h.keadaan === 'peringatan'
                            ? 'border-amber-500/30 bg-amber-500/5 text-slate-300'
                            : 'border-rose-500/40 bg-rose-500/5 text-slate-300',
                      )}
                    >
                      <b
                        className={
                          h.keadaan === 'baik'
                            ? 'text-emerald-300'
                            : h.keadaan === 'peringatan'
                              ? 'text-amber-300'
                              : 'text-rose-300'
                        }
                      >
                        {h.keadaan === 'baik' ? '✓ ' : h.keadaan === 'peringatan' ? '! ' : '✗ '}
                        {h.judul}
                      </b>
                      {' — '}
                      {h.rincian}
                      {h.saran && <span className="mt-1 block text-slate-400">{h.saran}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>
      </div>

      <Modal open={confirmWipe} onClose={() => setConfirmWipe(false)} title="Konfirmasi">
        <p className="text-sm text-slate-300">Tindakan ini tidak bisa dibatalkan.</p>
      </Modal>
      <Modal
        open={!!pulihBackup}
        onClose={() => setPulihBackup(null)}
        title="Pulihkan backup"
        wide
        testId="modal-pulih-backup"
        footer={
          <Button variant="ghost" onClick={() => setPulihBackup(null)}>
            Batal
          </Button>
        }
      >
        {pulihBackup && (
          <AlurPulihkanBackup
            data={pulihBackup.data}
            audio={pulihBackup.audio}
            partitur={pulihBackup.partitur}
            namaBerkas={pulihBackup.nama}
            testId="pulih-backup"
            onSelesai={() => setPulihBackup(null)}
          />
        )}
      </Modal>
    </div>
  )
}

/* ========================================================================== */
/*  Ambang kesulitan gerak                                                    */
/* ========================================================================== */

const TANDA_AMBANG: { kunci: keyof AmbangTingkat; label: string }[] = [
  { kunci: 'padat', label: 'padat' },
  { kunci: 'berat', label: 'berat' },
  { kunci: 'mustahil', label: 'mustahil' },
]

/**
 * Tiga ambang untuk satu dimensi kesulitan.
 *
 * Yang ditampilkan selalu yang **berlaku** — punya tim kalau diatur, bila tidak
 * yang bawaan — jadi kolom tidak pernah kosong dan pengguna langsung melihat
 * angka yang sedang dipakai. Mengetik angka yang belum valid tidak langsung
 * disimpan; nilainya dipertahankan dulu, karena kalau tidak, menghapus angka
 * untuk menulis ulang akan membuat ambangnya berubah sendiri.
 */
function AmbangBaris({
  judul,
  nama,
  nilai,
  bawaan,
  onChange,
}: {
  judul: string
  nama: string
  nilai?: AmbangTingkat
  bawaan: { padat: number; berat: number; mustahil: number }
  onChange: (v: AmbangTingkat) => void
}) {
  const berlaku = nilai ?? bawaan
  const ubah = (kunci: keyof AmbangTingkat, teks: string) => {
    const n = Number(teks)
    if (!Number.isFinite(n)) return
    onChange({ ...berlaku, [kunci]: n })
  }
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-slate-400">{judul}</label>
      <div className="grid grid-cols-3 gap-1.5">
        {TANDA_AMBANG.map(({ kunci, label }) => (
          <div key={kunci}>
            <Input
              type="number"
              step={nama === 'inci' ? 0.5 : 5}
              value={berlaku[kunci]}
              onChange={(e) => ubah(kunci, e.target.value)}
              aria-label={`${judul} — ambang ${label}`}
              data-testid={`ambang-${nama}-${kunci}`}
            />
            <div className="mt-0.5 text-[10px] text-slate-500">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ========================================================================== */
/*  J1 — kolom persen untuk ambang predikat                                   */
/* ========================================================================== */

/**
 * Kolom persen 0–100.
 *
 * Mengosongkan kolom **tidak** menyimpan nol: `Number('')` adalah `0`, dan
 * nol di sini sah (Cukup 0% = tidak ada yang "Perlu perhatian"), jadi kolom
 * kosong yang diam-diam menjadi nol akan mengubah laporan tanpa disadari.
 * Teks yang sedang diketik dipegang sendiri; yang diteruskan hanya angka
 * yang benar-benar terbaca.
 */
function KolomPersen({
  label,
  testId,
  nilai,
  onChange,
}: {
  label: string
  testId: string
  nilai: number
  onChange: (v: number) => void
}) {
  const [teks, setTeks] = useState(String(nilai))
  // Ikut berubah bila nilainya diganti dari luar (mis. "Kembalikan ke bawaan").
  useEffect(() => {
    setTeks((t) => (t.trim() !== '' && Number(t) === nilai ? t : String(nilai)))
  }, [nilai])
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-slate-400">{label}</label>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={0}
          max={100}
          step={1}
          value={teks}
          onChange={(e) => {
            const t = e.target.value
            setTeks(t)
            if (t.trim() === '') return
            const n = Number(t)
            if (Number.isFinite(n)) onChange(n)
          }}
          aria-label={label}
          data-testid={testId}
        />
        <span className="text-xs text-slate-500">%</span>
      </div>
    </div>
  )
}
