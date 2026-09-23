/**
 * G2b — kunci layar presenter.
 *
 * Menahan **sentuhan dan papan ketik** selama layar terkunci, supaya
 * senggolan di lapangan tidak mengubah set yang sedang tampil. Yang tetap
 * berjalan: animasi, metronom, dan hitung mundur — kunci hanya menahan
 * masukan, bukan pertunjukan.
 *
 * Tiga hal yang sengaja tidak dilakukan:
 *
 * - **Tidak menyimpan keadaan kunci.** Kunci dipakai untuk satu momen; bila
 *   ia bertahan setelah aplikasi dimuat ulang, pemakai yang lupa PIN-nya
 *   terkunci selamanya. Karena itu keadaannya hidup di komponen, dan
 *   menutup presenter selalu membukanya.
 * - **Tidak menahan Escape.** Menutup presenter tidak bisa mengubah urutan
 *   set, sedangkan menjebak pemakai di layar terkunci jauh lebih buruk.
 * - **Tidak memakai PIN sebagai pengaman sungguhan.** PIN tersimpan di
 *   `localStorage` (dari F2); gunanya menahan ketukan beruntun, bukan
 *   menahan orang. Bila belum ada PIN, membuka kunci cukup satu ketukan.
 */
import { useEffect, useState } from 'react'
import { getHint, hasPin, checkPin } from '../lib/kiosk'
import {
  BATAS_COBA,
  TUNGGU_COBA,
  keteranganKunci,
  masihTunggu,
} from '../lib/kunciLayar'
import { Button, Input } from './ui'
import { IconLock } from './Icons'

/**
 * Keadaan kunci layar.
 *
 * **Yang menahan sentuhan adalah `LayarTerkunci`; yang menahan papan ketik
 * adalah penangan tombol presenter sendiri**, melalui `kunciMenahan`.
 *
 * Mengapa tidak ada penangan `keydown` di sini? Karena ia tidak akan pernah
 * menang. Presenter memasang penangannya dengan tangkap (`capture`) di
 * `window`, dan dua penangan pada target yang sama berjalan **berurutan
 * sesuai urutan pendaftaran** — penangan kunci yang dipasang belakangan
 * baru berjalan setelah `goNext()` telanjur dipanggil, sedangkan
 * `preventDefault()` tidak bisa membatalkan apa yang sudah terjadi.
 * Menaruh penangan di sini akan memberi rasa aman palsu.
 */
export function pakaiKunciLayar() {
  const [terkunci, setTerkunci] = useState(false)
  return {
    terkunci,
    kunci: () => setTerkunci(true),
    buka: () => setTerkunci(false),
  }
}

/** Tombol kunci di baris atas presenter. */
export function TombolKunci({
  terkunci,
  onKunci,
}: {
  terkunci: boolean
  onKunci: () => void
}) {
  return (
    <button
      type="button"
      data-testid="kunci-presenter"
      data-terkunci={terkunci ? 'ya' : 'tidak'}
      onClick={onKunci}
      title="Kunci layar — sentuhan & papan ketik ditahan"
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
        terkunci
          ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
          : 'border-slate-700 text-slate-300 hover:bg-slate-800'
      }`}
    >
      <IconLock size={14} />
      {terkunci ? 'Terkunci' : 'Kunci layar'}
    </button>
  )
}

/**
 * Lapisan yang menutupi presenter selama terkunci.
 *
 * Ia menelan **sentuhan** dengan menutupi seluruh permukaan, sementara
 * papan ketik ditahan oleh `pakaiKunciLayar`. Keduanya diperlukan
 * — yang satu saja tidak cukup.
 */
export function LayarTerkunci({ onBuka }: { onBuka: () => void }) {
  const pinTerpasang = hasPin()
  const [pin, setPin] = useState('')
  const [salah, setSalah] = useState(0)
  const [sejak, setSejak] = useState<number | null>(null)
  const [galat, setGalat] = useState('')
  const [kini, setKini] = useState(() => Date.now())

  // Menghitung mundur sisa waktu tunggu — hanya bila sudah melewati batas.
  useEffect(() => {
    if (salah < BATAS_COBA || sejak == null) return
    const t = setInterval(() => setKini(Date.now()), 500)
    return () => clearInterval(t)
  }, [salah, sejak])

  const tertahan = masihTunggu(salah, sejak, kini)
  const sisa = tertahan && sejak != null
    ? Math.ceil((TUNGGU_COBA * 1000 - (kini - sejak)) / 1000)
    : 0

  function coba() {
    if (tertahan) return
    if (pinTerpasang && !checkPin(pin)) {
      const n = salah + 1
      setSalah(n)
      if (n >= BATAS_COBA) setSejak(Date.now())
      setGalat(
        n >= BATAS_COBA
          ? `Terlalu banyak percobaan. Tunggu ${TUNGGU_COBA} detik.`
          : 'PIN salah.',
      )
      setPin('')
      return
    }
    setPin('')
    setGalat('')
    setSalah(0)
    setSejak(null)
    onBuka()
  }

  return (
    <div
      data-testid="layar-terkunci"
      data-terkunci="ya"
      data-terima-kunci
      className="fixed inset-0 z-[210] grid place-items-center bg-slate-950/80 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-center shadow-xl">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-amber-500/50 bg-amber-500/10">
          <IconLock size={22} className="text-amber-300" />
        </div>
        <h2 className="mt-3 text-base font-semibold text-slate-100">Layar terkunci</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-400" data-testid="keterangan-kunci">
          {keteranganKunci(pinTerpasang)}
        </p>

        {pinTerpasang && (
          <div className="mt-4 text-left">
            <label className="mb-1 block text-[11px] text-slate-500" htmlFor="pin-presenter">
              PIN{getHint() ? ` (petunjuk: ${getHint()})` : ''}
            </label>
            <Input
              id="pin-presenter"
              data-testid="pin-presenter"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              disabled={tertahan}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') coba()
              }}
              className="w-full"
            />
          </div>
        )}

        {galat && (
          <p className="mt-2 text-xs font-semibold text-rose-300" data-testid="galat-kunci">
            {galat}
          </p>
        )}

        <Button
          variant="primary"
          data-testid="buka-kunci-presenter"
          disabled={tertahan}
          onClick={coba}
          className="mt-4 w-full"
        >
          {tertahan ? `Tunggu ${sisa} detik` : 'Buka kunci'}
        </Button>

        <p className="mt-3 text-[11px] text-slate-500">
          Escape tetap bisa menutup presenter — sengaja, supaya Anda tidak pernah terjebak.
        </p>
      </div>
    </div>
  )
}
