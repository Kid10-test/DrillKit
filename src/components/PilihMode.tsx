/**
 * Halaman pengantar (landing page) DrillKit.
 *
 * Mengapa halaman ini ada, dua alasan yang berbeda:
 *
 * 1. **Orang yang membuka tautan tidak boleh langsung dilempar ke dalam
 *    aplikasi.** Situsnya dipublikasikan, jadi siapa pun yang menerima
 *    tautannya membuka DrillKit tanpa tahu apa itu, tanpa tahu data
 *    mereka tersimpan di mana, dan tanpa diberitahu bahwa ia diminta
 *    memilih. Halaman ini menjelaskan dulu, baru mempersilakan masuk.
 * 2. **Perangkat baru tidak boleh langsung masuk mode pelatih.** Seorang
 *    anggota yang menerima berkasnya lalu melihat layar ekspor pelatih —
 *    "Unduh berkas grup", "Unduh per anggota (ZIP)", "Pratinjau isi" —
 *    dan harus menemukan tombol "Lihat mode anggota" yang namanya saja
 *    terdengar seperti milik pelatih.
 *
 * Keduanya diselesaikan satu halaman: halaman ini menjelaskan DrillKit
 * **sekaligus** menanyakan siapa yang memakai perangkat ini.
 *
 * Mengapa ia **bagian dari aplikasi**, bukan berkas terpisah di depannya:
 * DrillKit harus tetap jalan offline. Service worker mencakup aplikasi
 * ini; berkas pengantar yang terpisah di luar cakupannya akan gagal
 * dimuat tepat pada keadaan yang paling sering terjadi di lapangan — HP
 * tanpa kuota. Menyatukannya berarti halaman ini ikut tersimpan.
 *
 * Tiga aturan:
 *
 * 1. **Ditanyakan sekali, lalu diingat.** Menanyai berulang-ulang adalah
 *    gangguan, bukan bantuan. Pengunjung yang kembali langsung masuk.
 * 2. **Tidak pernah dikira-kira.** Menebak "pelatih" untuk semua orang
 *    berarti setiap anggota harus menemukan jalan keluar sendiri.
 *    Menebak "anggota" berarti pelatih dikurung tanpa PIN. Karena itu
 *    ditanya, bukan ditebak.
 * 3. **Tidak mengurung.** Pilihan ini bisa dibalik — dari mode anggota
 *    lewat tombol **Mode pelatih** (ber-PIN bila PIN terpasang).
 *
 * Yang **tidak** dilakukan di sini: memuat data contoh, meminta nama, atau
 * meminta apa pun selain satu pertanyaan ini.
 */
import { useState } from 'react'
import { simpanMode } from '../lib/modePerangkat'
import { adaPinTim } from '../lib/pinPelatih'
import { Button } from './ui'
import { KolomPinPelatih, cobaPinPelatih } from './PinPelatih'
import {
  IconCalendar,
  IconGrid,
  IconLock,
  IconMusic,
  IconUsers,
} from './Icons'

const PILIHAN = [
  {
    mode: 'coach' as const,
    ikon: IconGrid,
    judul: 'Saya pelatih',
    baris: [
      'Menyusun jadwal, formasi, dan absensi.',
      'Mencatat evaluasi & kemajuan anggota.',
      'Membagikan paket ke HP anggota.',
    ],
  },
  {
    mode: 'member' as const,
    ikon: IconUsers,
    judul: 'Saya anggota',
    baris: [
      'Melihat jadwal & materi latihan.',
      'Melihat posisi formasi saya sendiri.',
      'Membaca catatan dari pelatih.',
    ],
  },
]

/** Yang ada di dalam DrillKit — ditulis apa adanya, tanpa janji berlebih. */
const ISI = [
  { ikon: IconCalendar, judul: 'Jadwal & materi', baris: 'Rencana tiap sesi latihan.' },
  { ikon: IconGrid, judul: 'Formasi & drill', baris: 'Posisi, perpindahan, hitungan.' },
  { ikon: IconUsers, judul: 'Anggota & absensi', baris: 'Siapa hadir, siapa izin.' },
  { ikon: IconMusic, judul: 'Musik & metronom', baris: 'Tempo lagu dan latihan.' },
]

export function PilihMode({ onPilih }: { onPilih: (m: 'coach' | 'member') => void }) {
  const [pilih, setPilih] = useState<'coach' | 'member' | null>(null)
  const [pin, setPin] = useState('')
  const [galat, setGalat] = useState('')
  const [kali, setKali] = useState(0)
  const [tunggu, setTunggu] = useState(false)
  const mintaPin = adaPinTim()

  async function lanjut() {
    if (!pilih) return
    if (pilih === 'coach' && mintaPin) {
      if (tunggu) return
      const r = await cobaPinPelatih(pin, { kaliSalah: kali })
      setKali(r.kaliSalah)
      setGalat(r.galat)
      if (!r.ok) {
        setPin('')
        if (r.jeda) {
          setTunggu(true)
          setTimeout(() => setTunggu(false), r.jeda)
        }
        return
      }
    }
    simpanMode(pilih)
    onPilih(pilih)
  }

  return (
    <div
      data-testid="sambutan-mode"
      className="fixed inset-0 z-[300] overflow-y-auto bg-slate-950"
    >
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-4 py-10">
        {/* ---------------------------------------------------------- kepala */}
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
            <IconGrid size={26} className="text-emerald-300" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-100">DrillKit</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
            Catatan latihan marching band. Tersimpan di perangkat ini sendiri,
            dan tetap jalan tanpa sinyal.
          </p>
        </div>

        {/* ------------------------------------------- apa yang ada di dalam */}
        <div className="mt-8">
          <p className="text-center text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Yang ada di dalamnya
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ISI.map((o) => {
              const Ikon = o.ikon
              return (
                <div
                  key={o.judul}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-center"
                >
                  <Ikon size={18} className="mx-auto text-slate-400" />
                  <p className="mt-2 text-xs font-medium text-slate-200">{o.judul}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{o.baris}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ------------------------------- dua hal yang sering ditanyakan orang */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <IconLock size={15} className="mt-0.5 shrink-0 text-slate-500" />
            <p className="text-[11px] leading-relaxed text-slate-400">
              <b className="text-slate-300">Tanpa akun, tanpa server.</b> Data latihan tidak
              dikirim ke mana pun — ia tinggal di perangkat ini.
            </p>
          </div>
          <div className="flex flex-1 items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <IconUsers size={15} className="mt-0.5 shrink-0 text-slate-500" />
            <p className="text-[11px] leading-relaxed text-slate-400">
              <b className="text-slate-300">Dipakai bersama.</b> Pelatih membagikan paket,
              anggota membukanya di HP masing-masing.
            </p>
          </div>
        </div>

        {/* --------------------------------------------- pertanyaannya sendiri */}
        <h2 className="mt-8 text-center text-base font-semibold text-slate-100">
          Siapa yang akan memakai perangkat ini?
        </h2>
        <p className="mt-1 text-center text-[11px] text-slate-500">
          Pilih salah satu untuk masuk.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PILIHAN.map((o) => {
            const Ikon = o.ikon
            const aktif = pilih === o.mode
            return (
              <button
                key={o.mode}
                type="button"
                data-testid={`pilih-${o.mode}`}
                data-aktif={aktif ? 'ya' : 'tidak'}
                onClick={() => setPilih(o.mode)}
                aria-pressed={aktif}
                className={`rounded-2xl border p-5 text-left transition ${
                  aktif
                    ? 'border-emerald-500/60 bg-emerald-500/10'
                    : 'border-slate-700 bg-slate-900/60 hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Ikon size={20} className={aktif ? 'text-emerald-300' : 'text-slate-400'} />
                  <span className="text-base font-semibold text-slate-100">{o.judul}</span>
                </span>
                <ul className="mt-3 space-y-1.5">
                  {o.baris.map((b) => (
                    <li key={b} className="flex gap-2 text-xs leading-relaxed text-slate-400">
                      <span className={aktif ? 'text-emerald-400' : 'text-slate-600'}>•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        {pilih === 'coach' && mintaPin && (
          <div className="mx-auto mt-4 w-full max-w-sm">
            <KolomPinPelatih
              pin={pin}
              onPin={setPin}
              galat={galat}
              disabled={tunggu}
              onEnter={() => void lanjut()}
            />
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-3">
          <Button
            variant="primary"
            data-testid="lanjut-pilih-mode"
            disabled={!pilih || tunggu || (pilih === 'coach' && mintaPin && !pin)}
            onClick={() => void lanjut()}
            className="min-w-[16rem] justify-center"
          >
            {tunggu ? 'Tunggu sebentar…' : 'Masuk'}
          </Button>
          <p className="max-w-md text-center text-[11px] leading-relaxed text-slate-500">
            Hanya ditanyakan sekali. Pilihannya disimpan di perangkat ini dan bisa diubah
            nanti — pelatih lewat menu <b>Berbagi</b>, anggota lewat tombol{' '}
            <b>Mode pelatih</b>.
          </p>
        </div>
      </div>
    </div>
  )
}
