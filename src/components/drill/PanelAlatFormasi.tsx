/**
 * #12c, #16.2, & #22 — Panel Bentuk Parametrik Hidup & Inspektor Seleksi Terpadu.
 *
 * Melebur secara bersih (Matriks 3B #1 & #2):
 *  - tombol `applyShape` ("Bentuk cepat") lama di `DrillEditor.tsx`,
 *  - panel `Susun pilihan` lama di `DrillEditor.tsx`, dan
 *  - panel `Alat gerak massa` lama (serta menghapus 4 tombol `Geser blok` kembar).
 */
import type { BentukTerikat } from '../../db/types'
import {
  DAFTAR_BENTUK_CEPAT,
  LABEL_JENIS_PARAMETRIK,
  type JenisBentukCepat,
  type OpsiBentukCepat,
} from '../../lib/bentukFormasi'
import { Button, Card, Input, Select } from '../ui'

export type JenisSejajarkan = 'kiri' | 'tengahX' | 'kanan' | 'atas' | 'tengahY' | 'bawah'

export function PanelAlatFormasi({
  selectedCount,
  totalTampil,
  onPilihSemua,
  onKosongkanPilihan,
  bisaPutarSkala,
  bisaRatakan,
  sudutPutar,
  setSudutPutar,
  ikutBusur,
  setIkutBusur,
  putarBlok,
  persenSkala,
  setPersenSkala,
  ubahUkuran,
  porosCermin,
  setPorosCermin,
  cerminBlok,
  sejajarkan,
  ratakanJarak,
  opsiBentuk,
  setOpsiBentuk,
  ikatBentukHidup,
  setIkatBentukHidup,
  pratinjauAktif,
  setPratinjauAktif,
  onTerapkanBentuk,
  bentukTerikat,
  selectedIds,
  adaSetSebelum,
  adaSetBerikut,
  onPilihAnggotaBentuk,
  onBulatkanBentuk,
  onSalinBentukKeSet,
  onLepasBentuk,
}: {
  selectedCount: number
  totalTampil: number
  onPilihSemua: () => void
  onKosongkanPilihan: () => void
  bisaPutarSkala: boolean
  bisaRatakan: boolean
  sudutPutar: number
  setSudutPutar: (v: number) => void
  ikutBusur: boolean
  setIkutBusur: (v: boolean) => void
  putarBlok: (deg: number) => void
  persenSkala: number
  setPersenSkala: (v: number) => void
  ubahUkuran: (f: number) => void
  porosCermin: 'lapangan' | 'pilihan'
  setPorosCermin: (v: 'lapangan' | 'pilihan') => void
  cerminBlok: (sumbu: 'x' | 'y') => void
  sejajarkan: (jenis: JenisSejajarkan) => void
  ratakanJarak: (sumbu: 'x' | 'y') => void
  opsiBentuk: OpsiBentukCepat
  setOpsiBentuk: (patch: Partial<OpsiBentukCepat>) => void
  ikatBentukHidup: boolean
  setIkatBentukHidup: (v: boolean) => void
  pratinjauAktif: boolean
  setPratinjauAktif: (v: boolean) => void
  onTerapkanBentuk: () => void
  bentukTerikat: BentukTerikat[]
  selectedIds: string[]
  adaSetSebelum: boolean
  adaSetBerikut: boolean
  onPilihAnggotaBentuk: (ids: string[]) => void
  onBulatkanBentuk: (idBentuk: string) => void
  onSalinBentukKeSet: (idBentuk: string, arah: -1 | 1) => void
  onLepasBentuk: (idBentuk: string) => void
}) {
  const infoBentuk =
    DAFTAR_BENTUK_CEPAT.find((b) => b.id === opsiBentuk.jenis) ?? DAFTAR_BENTUK_CEPAT[0]
  const selSet = new Set(selectedIds)

  return (
    <Card data-testid="kartu-alat-formasi">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Bentuk &amp; inspektor seleksi</h2>
        <div className="flex items-center gap-2 text-[11px]">
          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={onKosongkanPilihan}
              className="text-slate-400 hover:text-slate-200 hover:underline"
            >
              Lepas
            </button>
          ) : null}
          <button
            type="button"
            data-testid="inspektor-pilih-semua"
            onClick={onPilihSemua}
            className="text-sky-400 hover:underline"
          >
            Pilih semua
          </button>
        </div>
      </div>

      {selectedCount > 0 ? (
        <p data-selcount className="mb-2.5 text-[11px] font-medium text-emerald-300">
          {selectedCount} titik dipilih — tarik gagang kotak biru di kanvas untuk rentang/putar bebas.
        </p>
      ) : (
        <p className="mb-2.5 text-[11px] leading-relaxed text-slate-500">
          Tidak ada titik dipilih — operasi berlaku untuk seluruh {totalTampil} titik tampil di set ini.
        </p>
      )}

      {/* #16.2 & #22.1 — Generator Bentuk Parametrik Hidup */}
      <div
        className="mb-3 rounded-xl border border-amber-700/35 bg-amber-950/15 p-2.5"
        data-testid="panel-bentuk-cepat"
      >
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
          <span className="text-xs font-semibold text-amber-200">Bentuk parametrik hidup</span>
          <div className="flex items-center gap-2.5">
            <label className="flex items-center gap-1 text-[10px] text-amber-200">
              <input
                type="checkbox"
                className="accent-amber-500"
                data-testid="toggle-ikat-bentuk"
                checked={ikatBentukHidup}
                onChange={(e) => setIkatBentukHidup(e.target.checked)}
              />
              Ikat hidup
            </label>
            <label className="flex items-center gap-1 text-[10px] text-amber-300">
              <input
                type="checkbox"
                className="accent-amber-500"
                data-testid="toggle-pratinjau-bentuk"
                checked={pratinjauAktif}
                onChange={(e) => setPratinjauAktif(e.target.checked)}
              />
              Pratinjau
            </label>
          </div>
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

          {(opsiBentuk.jenis === 'busur' || opsiBentuk.jenis === 'kurva_s') && (
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

      {/* #22.1 — Daftar Bentuk Hidup Aktif pada Set Ini */}
      {bentukTerikat.length > 0 && (
        <div
          className="mb-3 space-y-1.5 rounded-xl border border-amber-600/30 bg-slate-900/70 p-2"
          data-testid="panel-bentuk-terikat"
        >
          <p className="text-[11px] font-medium text-amber-300">
            Bentuk hidup di set ini ({bentukTerikat.length}) — tarik gagang oranye di kanvas
          </p>
          {bentukTerikat.map((b) => {
            const aktif = b.memberIds.some((id) => selSet.has(id))
            return (
              <div
                key={b.id}
                data-testid={`kartu-bentuk-terikat-${b.id}`}
                className={`rounded-lg border p-2 text-xs ${
                  aktif
                    ? 'border-amber-500/60 bg-amber-950/25'
                    : 'border-slate-800 bg-slate-950/50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    data-testid={`pilih-bentuk-terikat-${b.id}`}
                    onClick={() => onPilihAnggotaBentuk(b.memberIds)}
                    className="truncate text-left font-medium text-amber-100 hover:underline"
                    title="Pilih seluruh pemain dalam bentuk ini"
                  >
                    {b.nama || LABEL_JENIS_PARAMETRIK[b.jenis]}
                  </button>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {LABEL_JENIS_PARAMETRIK[b.jenis]} · {b.memberIds.length} ttk
                  </span>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1">
                  <Button
                    size="sm"
                    variant="soft"
                    className="px-1.5 text-[10px]"
                    data-testid={`bentuk-bulatkan-${b.id}`}
                    onClick={() => onBulatkanBentuk(b.id)}
                    title="Bulatkan koordinat pemain pada bentuk ini ke langkah terdekat"
                  >
                    ⌗ Bulatkan
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-1.5 text-[10px]"
                    data-testid={`bentuk-lepas-${b.id}`}
                    onClick={() => onLepasBentuk(b.id)}
                    title="Lepas ikatan bentuk (titik tetap berada di koordinatnya)"
                  >
                    Lepas ikatan
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-1.5 text-[10px]"
                    disabled={!adaSetSebelum}
                    data-testid={`bentuk-salin-sebelum-${b.id}`}
                    onClick={() => onSalinBentukKeSet(b.id, -1)}
                    title="Salin bentuk hidup ini ke set sebelumnya"
                  >
                    ← Set sblm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-1.5 text-[10px]"
                    disabled={!adaSetBerikut}
                    data-testid={`bentuk-salin-berikut-${b.id}`}
                    onClick={() => onSalinBentukKeSet(b.id, 1)}
                    title="Salin bentuk hidup ini ke set berikutnya"
                  >
                    Set brkt →
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* #22.3 — Satu Inspektor Transformasi Terpadu */}
      <div className="space-y-2.5" data-testid="panel-inspektor-transformasi">
        {/* Putar Terpadu */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-400">
            Putar (arah hadap ikut)
          </label>
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
            <Button
              size="sm"
              data-testid="putar-kiri"
              disabled={!bisaPutarSkala}
              onClick={() => putarBlok(-sudutPutar)}
            >
              ↺ Kiri
            </Button>
            <Button
              size="sm"
              data-testid="putar-kanan"
              disabled={!bisaPutarSkala}
              onClick={() => putarBlok(sudutPutar)}
            >
              Kanan ↻
            </Button>
          </div>
          <label className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-snug text-slate-400">
            <input
              type="checkbox"
              data-testid="toggle-ikut-busur"
              checked={ikutBusur}
              onChange={(e) => setIkutBusur(e.target.checked)}
              className="mt-0.5 accent-sky-500"
            />
            <span>
              Ikuti busur — pasang jalur melingkar pada set sebelumnya agar jarak antar pemain tidak
              mengkerut di tengah jalan
            </span>
          </label>
        </div>

        {/* Rentang / Kembang-kempis */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-400">
            Rentang / kembang-kempis
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
              data-testid="skala-kecilkan"
              disabled={!bisaPutarSkala}
              onClick={() => ubahUkuran(1 - persenSkala / 100)}
            >
              Kecilkan
            </Button>
            <Button
              size="sm"
              data-testid="skala-besarkan"
              disabled={!bisaPutarSkala}
              onClick={() => ubahUkuran(1 + persenSkala / 100)}
            >
              Besarkan
            </Button>
          </div>
        </div>

        {/* Cermin Terpadu (Poros Garis 50 vs Tengah Pilihan) */}
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-[11px] font-medium text-slate-400">Cermin</label>
            <Select
              data-testid="pilih-poros-cermin"
              value={porosCermin}
              onChange={(e) => setPorosCermin(e.target.value as 'lapangan' | 'pilihan')}
              className="w-40 py-0.5 text-[11px]"
              aria-label="Poros cermin"
            >
              <option value="lapangan">Poros: Garis 50 / Tengah</option>
              <option value="pilihan">Poros: Tengah Pilihan</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" data-testid="cermin-blok-x" onClick={() => cerminBlok('x')}>
              Kiri ⇄ Kanan
            </Button>
            <Button size="sm" data-testid="cermin-blok-y" onClick={() => cerminBlok('y')}>
              Depan ⇄ Belakang
            </Button>
          </div>
        </div>

        {/* Sejajarkan & Ratakan Jarak */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-400">
            Sejajarkan &amp; ratakan jarak
          </label>
          <div className="grid grid-cols-3 gap-1">
            <Button
              size="sm"
              className="px-1 text-[11px]"
              disabled={!bisaPutarSkala}
              data-testid="sejajar-kiri"
              title="Rapatkan ke sisi kiri (Side 1)"
              onClick={() => sejajarkan('kiri')}
            >
              Kiri
            </Button>
            <Button
              size="sm"
              className="px-1 text-[11px]"
              disabled={!bisaPutarSkala}
              data-testid="sejajar-tengahX"
              title="Rapatkan ke tengah mendatar"
              onClick={() => sejajarkan('tengahX')}
            >
              ↔ Tengah
            </Button>
            <Button
              size="sm"
              className="px-1 text-[11px]"
              disabled={!bisaPutarSkala}
              data-testid="sejajar-kanan"
              title="Rapatkan ke sisi kanan (Side 2)"
              onClick={() => sejajarkan('kanan')}
            >
              Kanan
            </Button>
            <Button
              size="sm"
              className="px-1 text-[11px]"
              disabled={!bisaPutarSkala}
              data-testid="sejajar-atas"
              title="Rapatkan ke sisi belakang (Back Sideline)"
              onClick={() => sejajarkan('atas')}
            >
              Atas
            </Button>
            <Button
              size="sm"
              className="px-1 text-[11px]"
              disabled={!bisaPutarSkala}
              data-testid="sejajar-tengahY"
              title="Rapatkan ke tengah depan–belakang"
              onClick={() => sejajarkan('tengahY')}
            >
              ↕ Tengah
            </Button>
            <Button
              size="sm"
              className="px-1 text-[11px]"
              disabled={!bisaPutarSkala}
              data-testid="sejajar-bawah"
              title="Rapatkan ke sisi depan (Penonton)"
              onClick={() => sejajarkan('bawah')}
            >
              Bawah
            </Button>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <Button
              size="sm"
              className="px-1 text-[11px]"
              disabled={!bisaRatakan}
              data-testid="rata-jarak-x"
              title="Ratakan jarak mendatar antar titik"
              onClick={() => ratakanJarak('x')}
            >
              ↔ Rata X
            </Button>
            <Button
              size="sm"
              className="px-1 text-[11px]"
              disabled={!bisaRatakan}
              data-testid="rata-jarak-y"
              title="Ratakan jarak depan–belakang antar titik"
              onClick={() => ratakanJarak('y')}
            >
              ↕ Rata Y
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
