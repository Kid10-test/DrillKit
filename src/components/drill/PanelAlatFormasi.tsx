/**
 * #12c & #16.2 — Panel Alat Gerak Massa + Generator Bentuk Cepat Berpratinjau.
 */
import {
  DAFTAR_BENTUK_CEPAT,
  type JenisBentukCepat,
  type OpsiBentukCepat,
} from '../../lib/bentukFormasi'
import { Button, Card, Input, Select } from '../ui'

export function PanelAlatFormasi({
  selectedCount,
  bisaPutarSkala,
  sudutPutar,
  setSudutPutar,
  ikutBusur,
  setIkutBusur,
  putarBlok,
  persenSkala,
  setPersenSkala,
  ubahUkuran,
  cerminBlok,
  jarakGeser,
  setJarakGeser,
  geserBlok,
  opsiBentuk,
  setOpsiBentuk,
  pratinjauAktif,
  setPratinjauAktif,
  onTerapkanBentuk,
}: {
  selectedCount: number
  bisaPutarSkala: boolean
  sudutPutar: number
  setSudutPutar: (v: number) => void
  ikutBusur: boolean
  setIkutBusur: (v: boolean) => void
  putarBlok: (deg: number) => void
  persenSkala: number
  setPersenSkala: (v: number) => void
  ubahUkuran: (f: number) => void
  cerminBlok: (sumbu: 'x' | 'y') => void
  jarakGeser: number
  setJarakGeser: (v: number) => void
  geserBlok: (sumbu: 'x' | 'y', arah: number) => void
  opsiBentuk: OpsiBentukCepat
  setOpsiBentuk: (patch: Partial<OpsiBentukCepat>) => void
  pratinjauAktif: boolean
  setPratinjauAktif: (v: boolean) => void
  onTerapkanBentuk: () => void
}) {
  const infoBentuk =
    DAFTAR_BENTUK_CEPAT.find((b) => b.id === opsiBentuk.jenis) ?? DAFTAR_BENTUK_CEPAT[0]

  return (
    <Card data-testid="kartu-alat-formasi">
      <h2 className="mb-2 text-sm font-semibold text-slate-200">Alat gerak massa &amp; bentuk</h2>
      <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
        {selectedCount
          ? `${selectedCount} titik dipilih — perubahan hanya berlaku pada titik itu.`
          : 'Tidak ada titik dipilih — perubahan berlaku untuk SEMUA pemain di set ini.'}
      </p>

      {/* #16.2 — Generator Bentuk Cepat dengan Pratinjau Langsung */}
      <div className="mb-3 rounded-xl border border-amber-700/35 bg-amber-950/15 p-2.5" data-testid="panel-bentuk-cepat">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-amber-200">Generator bentuk presisi</span>
          <label className="flex items-center gap-1 text-[10px] text-amber-300">
            <input
              type="checkbox"
              className="accent-amber-500"
              data-testid="toggle-pratinjau-bentuk"
              checked={pratinjauAktif}
              onChange={(e) => setPratinjauAktif(e.target.checked)}
            />
            Pratinjau di kanvas
          </label>
        </div>

        <Select
          data-testid="pilih-jenis-bentuk"
          value={opsiBentuk.jenis}
          onChange={(e) => setOpsiBentuk({ jenis: e.target.value as JenisBentukCepat })}
          className="py-1 text-xs"
        >
          {DAFTAR_BENTUK_CEPAT.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-[10px] leading-snug text-slate-400">{infoBentuk.ringkas}</p>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {opsiBentuk.jenis !== 'lingkaran' && (
            <div>
              <label className="mb-0.5 block text-[10px] text-slate-400" htmlFor="bentuk-interval">
                Interval (langkah)
              </label>
              <Input
                id="bentuk-interval"
                data-testid="input-bentuk-interval"
                type="number"
                min={0.5}
                max={16}
                step={0.5}
                value={opsiBentuk.intervalLangkah}
                onChange={(e) =>
                  setOpsiBentuk({ intervalLangkah: Math.max(0.5, Number(e.target.value) || 2) })
                }
                className="py-1 text-xs"
              />
            </div>
          )}

          {opsiBentuk.jenis === 'busur' && (
            <div>
              <label className="mb-0.5 block text-[10px] text-slate-400" htmlFor="bentuk-lengkungan">
                Kedalaman (lk)
              </label>
              <Input
                id="bentuk-lengkungan"
                data-testid="input-bentuk-lengkungan"
                type="number"
                min={-24}
                max={24}
                step={1}
                value={opsiBentuk.lengkunganLangkah}
                onChange={(e) => setOpsiBentuk({ lengkunganLangkah: Number(e.target.value) || 0 })}
                className="py-1 text-xs"
              />
            </div>
          )}

          {opsiBentuk.jenis === 'lingkaran' && (
            <div>
              <label className="mb-0.5 block text-[10px] text-slate-400" htmlFor="bentuk-jari">
                Jari-jari (langkah)
              </label>
              <Input
                id="bentuk-jari"
                data-testid="input-bentuk-jari"
                type="number"
                min={2}
                max={32}
                step={1}
                value={opsiBentuk.jariJariLangkah}
                onChange={(e) =>
                  setOpsiBentuk({ jariJariLangkah: Math.max(1, Number(e.target.value) || 8) })
                }
                className="py-1 text-xs"
              />
            </div>
          )}

          {opsiBentuk.jenis === 'blok' && (
            <>
              <div>
                <label className="mb-0.5 block text-[10px] text-slate-400" htmlFor="bentuk-kolom">
                  Kolom (banjar)
                </label>
                <Input
                  id="bentuk-kolom"
                  data-testid="input-bentuk-kolom"
                  type="number"
                  min={1}
                  max={24}
                  step={1}
                  value={opsiBentuk.kolomBlok}
                  onChange={(e) =>
                    setOpsiBentuk({ kolomBlok: Math.max(1, Number(e.target.value) || 4) })
                  }
                  className="py-1 text-xs"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] text-slate-400" htmlFor="bentuk-baris">
                  Jarak saf (lk)
                </label>
                <Input
                  id="bentuk-baris"
                  data-testid="input-bentuk-baris"
                  type="number"
                  min={1}
                  max={16}
                  step={0.5}
                  value={opsiBentuk.jarakBarisLangkah}
                  onChange={(e) =>
                    setOpsiBentuk({ jarakBarisLangkah: Math.max(0.5, Number(e.target.value) || 4) })
                  }
                  className="py-1 text-xs"
                />
              </div>
            </>
          )}

          {opsiBentuk.jenis === 'garis_diagonal' && (
            <div>
              <label className="mb-0.5 block text-[10px] text-slate-400" htmlFor="bentuk-sudut">
                Sudut (°)
              </label>
              <Input
                id="bentuk-sudut"
                data-testid="input-bentuk-sudut"
                type="number"
                min={-75}
                max={75}
                step={5}
                value={opsiBentuk.sudutDerajat}
                onChange={(e) => setOpsiBentuk({ sudutDerajat: Number(e.target.value) || 0 })}
                className="py-1 text-xs"
              />
            </div>
          )}
        </div>

        <div className="mt-2 flex gap-1.5">
          <Button
            size="sm"
            variant="primary"
            className="flex-1"
            data-testid="terapkan-bentuk-cepat"
            onClick={onTerapkanBentuk}
          >
            Terapkan {infoBentuk.label}
          </Button>
          {pratinjauAktif && (
            <Button size="sm" variant="ghost" onClick={() => setPratinjauAktif(false)}>
              Tutup
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        {/* Putar */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-400">Putar blok</label>
          <div className="grid grid-cols-3 gap-1.5">
            <Select
              value={String(sudutPutar)}
              onChange={(e) => setSudutPutar(Number(e.target.value))}
              className="py-1 text-xs"
              aria-label="Sudut putar blok"
            >
              {[15, 30, 45, 90].map((d) => (
                <option key={d} value={d}>
                  {d}°
                </option>
              ))}
            </Select>
            <Button size="sm" disabled={!bisaPutarSkala} onClick={() => putarBlok(-sudutPutar)}>
              ↺ Kiri
            </Button>
            <Button size="sm" disabled={!bisaPutarSkala} onClick={() => putarBlok(sudutPutar)}>
              Kanan ↻
            </Button>
          </div>
          <label className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-snug text-slate-400">
            <input
              type="checkbox"
              checked={ikutBusur}
              onChange={(e) => setIkutBusur(e.target.checked)}
              className="mt-0.5 accent-sky-500"
            />
            <span>
              Ikuti busur — pemain mengitari titik tengahnya, bukan memotong lewat
              tali busur (tanpa ini formasi mengkerut di tengah jalan)
            </span>
          </label>
          <p className="mt-1 text-[10px] leading-snug text-slate-500">
            {bisaPutarSkala
              ? 'Mengitari titik tengah blok. Putaran 90° ikut memutar arah hadap.'
              : 'Perlu minimal 2 titik — kosongkan pilihan supaya berlaku untuk seluruh formasi.'}
          </p>
        </div>

        {/* Kembang-kempis */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-400">
            Kembang-kempis
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <Select
              value={String(persenSkala)}
              onChange={(e) => setPersenSkala(Number(e.target.value))}
              className="py-1 text-xs"
              aria-label="Persentase skala blok"
            >
              {[5, 10, 25].map((d) => (
                <option key={d} value={d}>
                  {d}%
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              disabled={!bisaPutarSkala}
              onClick={() => ubahUkuran(1 - persenSkala / 100)}
            >
              Kecilkan
            </Button>
            <Button
              size="sm"
              disabled={!bisaPutarSkala}
              onClick={() => ubahUkuran(1 + persenSkala / 100)}
            >
              Besarkan
            </Button>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-slate-500">
            {bisaPutarSkala
              ? 'Mengembang atau mengempis dari titik tengah blok.'
              : 'Perlu minimal 2 titik — kosongkan pilihan supaya berlaku untuk seluruh formasi.'}
          </p>
        </div>

        {/* Cermin */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-400">Cermin</label>
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" data-testid="cermin-blok-x" onClick={() => cerminBlok('x')}>
              Kiri ⇄ Kanan
            </Button>
            <Button size="sm" data-testid="cermin-blok-y" onClick={() => cerminBlok('y')}>
              Depan ⇄ Belakang
            </Button>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-slate-500">
            Dicerminkan terhadap garis tengah lapangan; arah hadap ikut tercermin.
          </p>
        </div>

        {/* Geser */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-400">Geser blok</label>
          <div className="mb-1.5 flex items-center gap-1.5">
            <Select
              value={String(jarakGeser)}
              onChange={(e) => setJarakGeser(Number(e.target.value))}
              className="w-20 py-1 text-xs"
              aria-label="Jarak geser blok dalam langkah"
            >
              {[1, 2, 4, 8].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
            <span className="text-[11px] text-slate-500">langkah sekali tekan</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" onClick={() => geserBlok('y', -1)}>
              Ke depan
            </Button>
            <Button size="sm" onClick={() => geserBlok('y', 1)}>
              Ke belakang
            </Button>
            <Button size="sm" onClick={() => geserBlok('x', 1)}>
              Ke Side 1
            </Button>
            <Button size="sm" onClick={() => geserBlok('x', -1)}>
              Ke Side 2
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
