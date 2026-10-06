/**
 * Permintaan PIN pelatih tim — halaman sambutan & perangkat lama.
 *
 * Ditanya sekali per perangkat (hash yang lolos diingat). PIN diganti
 * (hash berbeda) → ditanya lagi. Pagar, bukan brankas.
 */
import { useState } from 'react'
import { Button, Input } from './ui'
import { IconLock } from './Icons'
import {
  ANJURAN_PANJANG,
  adaPinTim,
  hashPinTersuntik,
  ingatPinTim,
  jedaSetelahSalah,
  pinPendek,
  pinTimCocok,
} from '../lib/pinPelatih'

export async function cobaPinPelatih(
  pin: string,
  opts: { kaliSalah: number },
): Promise<{ ok: boolean; galat: string; kaliSalah: number; jeda: number }> {
  const benar = await pinTimCocok(pin, hashPinTersuntik())
  if (benar) {
    ingatPinTim()
    return { ok: true, galat: '', kaliSalah: 0, jeda: 0 }
  }
  const kali = opts.kaliSalah + 1
  return {
    ok: false,
    galat: 'PIN salah.',
    kaliSalah: kali,
    jeda: jedaSetelahSalah(kali),
  }
}

export function KolomPinPelatih({
  pin,
  onPin,
  galat,
  disabled,
  onEnter,
}: {
  pin: string
  onPin: (v: string) => void
  galat: string
  disabled?: boolean
  onEnter?: () => void
}) {
  return (
    <div className="mt-3" data-testid="kolom-pin-pelatih">
      <label className="mb-1 block text-[11px] text-slate-500" htmlFor="pin-pelatih-tim">
        PIN pelatih tim
      </label>
      <Input
        id="pin-pelatih-tim"
        data-testid="pin-pelatih-tim"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={pin}
        onChange={(e) => onPin(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter?.()
        }}
        className="w-full"
      />
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        Anjuran minimal {ANJURAN_PANJANG} angka. PIN ini pagar, bukan brankas —
        data tetap di perangkat, tidak dikirim ke mana pun.
      </p>
      {pinPendek(pin) && (
        <p className="mt-1 text-[11px] text-amber-300" data-testid="anjuran-pin-pendek">
          Lebih aman memakai {ANJURAN_PANJANG} angka atau lebih.
        </p>
      )}
      {galat && (
        <p className="mt-2 text-xs font-semibold text-rose-300" data-testid="galat-pin-pelatih">
          {galat}
        </p>
      )}
    </div>
  )
}

/** Overlay untuk perangkat lama yang sudah di mode pelatih. */
export function PinPelatihLama({ onLolos }: { onLolos: () => void }) {
  const [pin, setPin] = useState('')
  const [galat, setGalat] = useState('')
  const [kali, setKali] = useState(0)
  const [tunggu, setTunggu] = useState(false)

  if (!adaPinTim()) return null

  async function kirim() {
    if (tunggu) return
    const r = await cobaPinPelatih(pin, { kaliSalah: kali })
    setKali(r.kaliSalah)
    setGalat(r.galat)
    if (r.ok) {
      onLolos()
      return
    }
    setPin('')
    if (r.jeda) {
      setTunggu(true)
      setTimeout(() => setTunggu(false), r.jeda)
    }
  }

  return (
    <div
      data-testid="pin-pelatih-lama"
      className="fixed inset-0 z-[280] grid place-items-center bg-slate-950/95 px-4"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center gap-2 text-slate-100">
          <IconLock size={18} className="text-emerald-300" />
          <h2 className="text-base font-semibold">PIN pelatih tim</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Perangkat ini sudah di mode pelatih. Masukkan PIN tim sekali —
          berikutnya diingat di perangkat ini. Kalau PIN diganti di hosting,
          Anda akan ditanya lagi.
        </p>
        <KolomPinPelatih
          pin={pin}
          onPin={setPin}
          galat={galat}
          disabled={tunggu}
          onEnter={() => void kirim()}
        />
        <div className="mt-4 flex justify-end">
          <Button
            variant="primary"
            data-testid="lanjut-pin-pelatih"
            disabled={tunggu || !pin}
            onClick={() => void kirim()}
          >
            {tunggu ? 'Tunggu sebentar…' : 'Masuk'}
          </Button>
        </div>
      </div>
    </div>
  )
}
