import { useState } from 'react'
import { useKiosk } from '../hooks/useKiosk'
import { checkPin, clearPin, getHint, setPin } from '../lib/kiosk'
import { Badge, Button, Card, Input, Modal, Select, useToast } from './ui'
import { IconLock } from './Icons'

/**
 * Antarmuka mode kios / kunci data (F2).
 *
 * Tiga bagian:
 * - `KioskButton`  → tombol kecil di sidebar/header untuk mengunci & membuka.
 * - `KioskBanner`  → penjelasan singkat yang tampil selama terkunci.
 * - `KioskPinCard` → pengaturan PIN di menu Pengaturan.
 *
 * Semua tombol di sini diberi penanda `data-kiosk-allow` supaya tetap bisa
 * diklik saat data sedang dikunci — kalau tidak, kita tidak akan bisa membuka
 * kunci lagi.
 */

export function KioskButton({ full = false }: { full?: boolean }) {
  const { locked, pinSet, lock, unlock } = useKiosk()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [pin, setPinInput] = useState('')
  const [hint, setHint] = useState(getHint())
  const [error, setError] = useState('')

  function tutup() {
    setOpen(false)
    setPinInput('')
    setError('')
  }

  function bukaKunci() {
    if (pinSet && !checkPin(pin)) {
      setError('PIN salah.')
      return
    }
    unlock()
    toast.push('Kunci dibuka — data bisa diubah lagi')
    tutup()
  }

  function kunci() {
    if (pinSet && !checkPin(pin)) {
      setError('PIN salah.')
      return
    }
    // Kalau belum ada PIN dan pelatih mengisi kolomnya, pasang sekarang.
    if (!pinSet && pin.trim()) setPin(pin.trim(), hint)
    lock()
    toast.push('Mode kios aktif — data tidak bisa diubah', 'info')
    tutup()
  }

  return (
    <>
      <button
        data-kiosk-allow
        data-testid="kiosk-toggle"
        onClick={() => {
          setHint(getHint())
          setOpen(true)
        }}
        className={
          full
            ? 'flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800'
            : 'flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800'
        }
        title={locked ? 'Buka kunci data' : 'Kunci data (mode kios)'}
      >
        <span className="flex items-center gap-1.5">
          <IconLock size={14} className={locked ? 'text-amber-400' : ''} />
          {locked ? 'Terkunci' : 'Kunci data'}
        </span>
        {!full && !locked && <span className="text-[10px] text-slate-500">kios</span>}
      </button>

      <Modal
        open={open}
        onClose={tutup}
        title={locked ? 'Buka kunci data' : 'Kunci data (mode kios)'}
      >
        {/* Penanda ini penting: isi dialog tetap bisa dipakai walau data terkunci. */}
        <div data-kiosk-allow className="space-y-3">
          {locked ? (
            <p className="text-sm text-slate-400">
              Mode kios sedang aktif: formasi, absensi, anggota, jadwal, dan pengaturan{' '}
              <b>tidak bisa diubah</b>. Menjelajah, melihat formasi, mode presenter, dan metronom
              tetap bisa dipakai.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-400">
                Setelah dikunci, aplikasi cuma bisa <b>dilihat</b>: aman dipinjamkan ke anggota.
                Tombol yang mengubah data akan menghasilkan pesan &ldquo;terkunci&rdquo;.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
                <li>Tetap bisa: pindah menu, lihat formasi, presenter, metronom.</li>
                <li>Terkunci: menggeser titik, mengisi absensi, mengubah anggota/jadwal, impor &amp; hapus data.</li>
              </ul>
            </>
          )}

          {pinSet ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">PIN</label>
              <Input
                value={pin}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (locked ? bukaKunci() : kunci())}
                type="password"
                inputMode="numeric"
                autoFocus
                placeholder="Masukkan PIN"
              />
              {getHint() && <p className="mt-1 text-[11px] text-slate-500">Petunjuk: {getHint()}</p>}
            </div>
          ) : (
            !locked && (
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">
                    PIN baru (opsional)
                  </label>
                  <Input
                    value={pin}
                    onChange={(e) => setPinInput(e.target.value)}
                    type="password"
                    inputMode="numeric"
                    placeholder="Kosongkan kalau tidak perlu PIN"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">
                    Petunjuk PIN (opsional)
                  </label>
                  <Input
                    value={hint}
                    onChange={(e) => setHint(e.target.value)}
                    placeholder="mis. tahun berdiri tim"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Kalau tidak memakai PIN, kunci bisa dibuka siapa saja lewat tombol ini — cukup
                  untuk mencegah perubahan tidak sengaja.
                </p>
              </div>
            )
          )}

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={tutup}>
              Batal
            </Button>
            {locked ? (
              <Button variant="primary" onClick={bukaKunci}>
                Buka kunci
              </Button>
            ) : (
              <Button variant="primary" onClick={kunci}>
                Aktifkan kunci
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}

/** Penjelasan singkat di bagian atas halaman selama mode kios aktif. */
export function KioskBanner() {
  const { locked } = useKiosk()
  if (!locked) return null
  return (
    <div
      data-testid="kiosk-banner"
      className="mx-auto mb-4 flex max-w-6xl items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200"
    >
      <IconLock size={16} className="mt-0.5 shrink-0" />
      <p className="flex-1 leading-relaxed">
        <b>Mode kios aktif</b> — data hanya bisa dilihat. Menjelajah, melihat formasi, mode
        presenter, dan metronom tetap bisa; tombol yang mengubah data dikunci.
      </p>
    </div>
  )
}

/** Kartu pengaturan PIN di menu Pengaturan. */
export function KioskPinCard() {
  const { locked, pinSet, refreshPin, menitOtomatis, aturOtomatis } = useKiosk()
  const toast = useToast()
  const [edit, setEdit] = useState(false)
  const [pin, setPinInput] = useState('')
  const [hint, setHint] = useState(getHint())

  return (
    <Card className="mt-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Mode kios / kunci data</h2>
        <Badge className={locked ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : ''}>
          {locked ? 'Terkunci' : 'Tidak terkunci'}
        </Badge>
      </div>

      <p className="mb-3 text-xs leading-relaxed text-slate-400">
        Kunci dipakai kalau HP-mu dipinjam anggota: mereka tetap bisa melihat jadwal, formasi, dan
        menjalankan presenter, tapi <b>tidak bisa mengubah apa pun</b>.
      </p>

      <div className="mb-3 space-y-1 text-xs text-slate-400">
        <p>
          Status kunci:{' '}
          <span className={locked ? 'font-semibold text-amber-300' : 'text-slate-200'}>
            {locked ? 'aktif' : 'nonaktif'}
          </span>
        </p>
        <p>
          PIN:{' '}
          <span className="text-slate-200">
            {pinSet ? `terpasang${getHint() ? ` (petunjuk: ${getHint()})` : ''}` : 'belum ada'}
          </span>
        </p>
      </div>

      {/*
        Kunci otomatis. Tanpa PIN ia tidak ada gunanya — siapa pun bisa
        membukanya lagi dengan satu tombol — jadi ditawarkan hanya setelah
        PIN terpasang, dan alasannya dikatakan terus terang.
      */}
      <div className="mb-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <label
          htmlFor="atur-kunci-otomatis"
          className="mb-1 block text-xs font-medium text-slate-300"
        >
          Kunci otomatis
        </label>
        {pinSet ? (
          <>
            <Select
              id="atur-kunci-otomatis"
              data-testid="kunci-otomatis"
              value={String(menitOtomatis)}
              onChange={(e) => aturOtomatis(Number(e.target.value))}
              className="w-full"
            >
              <option value="0">Mati — kunci hanya kalau kamu tekan sendiri</option>
              <option value="5">Setelah 5 menit tidak disentuh</option>
              <option value="10">Setelah 10 menit tidak disentuh</option>
              <option value="15">Setelah 15 menit tidak disentuh</option>
              <option value="30">Setelah 30 menit tidak disentuh</option>
            </Select>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Berguna kalau perangkat ini sering ditinggal — misalnya tablet di bangku
              cadangan. Tidak pernah menyala saat <b>presenter</b> sedang berjalan, supaya
              latihan tidak berhenti di tengah.
            </p>
          </>
        ) : (
          <p
            data-testid="kunci-otomatis-tanpa-pin"
            className="text-[11px] leading-relaxed text-slate-500"
          >
            Pasang PIN dulu. Tanpa PIN, kunci otomatis tidak melindungi apa pun — siapa
            pun bisa membukanya lagi dengan satu tombol.
          </p>
        )}
      </div>

      {edit ? (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">PIN baru</label>
            <Input
              value={pin}
              onChange={(e) => setPinInput(e.target.value)}
              type="password"
              inputMode="numeric"
              placeholder="Kosongkan untuk menghapus PIN"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Petunjuk</label>
            <Input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="mis. tahun berdiri tim"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                if (pin.trim()) {
                  setPin(pin.trim(), hint)
                  toast.push('PIN tersimpan')
                } else {
                  clearPin()
                  toast.push('PIN dihapus', 'info')
                }
                refreshPin()
                setEdit(false)
                setPinInput('')
              }}
            >
              Simpan
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>
              Batal
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => { setPinInput(''); setHint(getHint()); setEdit(true) }}>
            {pinSet ? 'Ubah PIN' : 'Pasang PIN'}
          </Button>
          <KioskButton />
        </div>
      )}
    </Card>
  )
}
