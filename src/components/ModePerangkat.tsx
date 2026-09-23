/**
 * Saklar mode perangkat — **pelatih** atau **anggota**.
 *
 * Permintaan yang memicunya: *"aku mau mode anggota tidak bisa masuk mode
 * pelatih."*
 *
 * Dua tombol, dua arah, dan keduanya sengaja tidak setara:
 *
 * - **Masuk** ke mode anggota bebas, karena arah ini tidak pernah
 *   membahayakan apa pun. Sebagai gantinya, kalau PIN **belum** terpasang,
 *   pelatih **dianjurkan** memasangnya lebih dulu — bukan dipaksa, karena
 *   memaksa akan menghalangi pelatih yang sekadar ingin mencoba.
 * - **Keluar** dari mode anggota memerlukan PIN. Inilah yang diminta.
 *
 * ### Mengapa tanpa PIN tidak dikunci
 *
 * Bila PIN belum terpasang, keluar tetap diizinkan. Sengaja: mengunci mode
 * anggota tanpa ada kuncinya berarti pelatih bisa **mengurung dirinya
 * sendiri**, dan satu-satunya jalan keluar tinggal membersihkan data
 * peramban. Mengunci pemilik yang sah lebih buruk daripada membiarkan
 * anggota melihat menu yang kosong. Keadaan ini tidak disembunyikan —
 * antarmukanya mengatakannya terus terang.
 *
 * ### Ini pagar antarmuka, bukan pengaman
 *
 * Mode tersimpan di `localStorage`, yang bisa disunting siapa pun lewat
 * perkakas pengembang peramban. Modul ini menghentikan anggota yang **tidak
 * sengaja** tersasar; ia tidak dimaksudkan menahan orang yang sengaja
 * membongkar, dan tidak pernah mengaku demikian.
 */
import { useState } from 'react'
import { checkPin, getHint, hasPin, setPin } from '../lib/kiosk'
import { bolehKePelatih, simpanMode, teksKunci, wajibPasangPin } from '../lib/modePerangkat'
import { Button, Input, Modal, useToast } from './ui'

/** Muat ulang diperlukan: mode dibaca saat komponen dipasang, bukan tiap render. */
function muatUlang() {
  window.location.reload()
}

/**
 * Tombol **masuk** ke mode anggota (sisi pelatih).
 *
 * Kalau PIN belum terpasang, tampil lebih dulu ajakan memasangnya —
 * karena tanpa PIN, mode anggota belum bisa dikunci.
 */
export function TombolMasukModeAnggota() {
  const toast = useToast()
  const [buka, setBuka] = useState(false)
  const [pin, setPinInput] = useState('')
  const [hint, setHint] = useState(getHint)

  function masuk(lewati = false) {
    if (wajibPasangPin(hasPin()) && pin.trim() && !lewati) {
      setPin(pin.trim(), hint)
      toast.push('PIN tersimpan — mode anggota terkunci', 'info')
    }
    simpanMode('member')
    muatUlang()
  }

  return (
    <>
      <button
        type="button"
        data-testid="masuk-mode-anggota"
        onClick={() => {
          setHint(getHint())
          setBuka(true)
        }}
        className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
      >
        Lihat mode anggota
      </button>

      <Modal
        open={buka}
        onClose={() => setBuka(false)}
        testId="modal-masuk-anggota"
        title="Masuk mode anggota"
        footer={
          <>
            <Button onClick={() => setBuka(false)}>Batal</Button>
            <Button variant="primary" data-testid="lanjut-masuk-anggota" onClick={() => masuk()}>
              Masuk mode anggota
            </Button>
          </>
        }
      >
        {wajibPasangPin(hasPin()) ? (
          <>
            <p className="text-sm leading-relaxed text-slate-300">
              Mode anggota sebaiknya <b>dikunci dengan PIN</b> supaya anggota tidak bisa keluar
              kembali ke mode pelatih. Tanpa PIN, tombol kembalinya tetap bisa dipakai siapa pun.
            </p>
            <div className="mt-3 space-y-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500" htmlFor="pin-baru-mode">
                  PIN (boleh dikosongkan)
                </label>
                <Input
                  id="pin-baru-mode"
                  data-testid="pin-baru-mode"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500" htmlFor="petunjuk-mode">
                  Petunjuk (untuk mengingatkan Anda)
                </label>
                <Input
                  id="petunjuk-mode"
                  data-testid="petunjuk-mode"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="mis. angka punggung"
                  className="w-full"
                />
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Ini <b>pagar antarmuka, bukan pengaman</b>: mode tersimpan di perangkat ini dan bisa
              disunting siapa pun yang membuka perkakas pengembang peramban. Gunanya menahan yang
              tersasar, bukan yang sengaja membongkar.
            </p>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-slate-300">
            PIN sudah terpasang, jadi mode anggota akan <b>terkunci</b>: keluar lagi memerlukan PIN.
          </p>
        )}
      </Modal>
    </>
  )
}

/**
 * Tombol **keluar** dari mode anggota (sisi anggota).
 *
 * Sengaja ditulis **sederhana**, bukan disembunyikan: pelatih harus bisa
 * menemukannya kalau perlu. Yang ditahan adalah **pemakaiannya**, bukan
 * penemuannya — menyembunyikan tombol hanya akan menyulitkan pemilik yang
 * sah pada saat ia paling membutuhkannya.
 */
export function TombolKeluarModeAnggota({ label = 'Mode pelatih' }: { label?: string }) {
  const [buka, setBuka] = useState(false)
  const [pin, setPinInput] = useState('')
  const [galat, setGalat] = useState('')
  const [petunjuk, setPetunjuk] = useState(getHint)
  const adaPin = hasPin()

  function coba() {
    if (!bolehKePelatih(adaPin, checkPin(pin))) {
      setGalat('PIN salah.')
      setPinInput('')
      return
    }
    setPinInput('')
    setGalat('')
    simpanMode('coach')
    muatUlang()
  }

  return (
    <>
      <button
        type="button"
        data-testid="keluar-mode-anggota"
        onClick={() => {
          setPetunjuk(getHint())
          setGalat('')
          setBuka(true)
        }}
        className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 active:scale-[.97]"
      >
        {label}
      </button>

      <Modal
        open={buka}
        onClose={() => setBuka(false)}
        testId="modal-keluar-anggota"
        title="Keluar dari mode anggota"
        footer={
          <>
            <Button onClick={() => setBuka(false)}>Batal</Button>
            <Button variant="primary" data-testid="lanjut-keluar-anggota" onClick={coba}>
              Lanjut
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-slate-300" data-testid="teks-kunci-mode">
          {teksKunci(adaPin)}
        </p>

        {adaPin && (
          <div className="mt-3">
            <label className="mb-1 block text-[11px] text-slate-500" htmlFor="pin-mode">
              PIN{petunjuk ? ` (petunjuk: ${petunjuk})` : ''}
            </label>
            <Input
              id="pin-mode"
              data-testid="pin-mode"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') coba()
              }}
              className="w-full"
            />
          </div>
        )}

        {galat && (
          <p className="mt-2 text-xs font-semibold text-rose-300" data-testid="galat-mode">
            {galat}
          </p>
        )}

        {!adaPin && (
          <p className="mt-3 text-[11px] leading-relaxed text-amber-300" data-testid="tanpa-pin-mode">
            Belum ada PIN, jadi mode ini <b>belum dikunci</b>. Pasang PIN di Pengaturan supaya
            anggota tidak bisa keluar dari mode anggota.
          </p>
        )}
      </Modal>
    </>
  )
}
