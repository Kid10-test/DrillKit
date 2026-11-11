import { useMemo, useState } from 'react'
import type { DrillPoint, FieldConfig, Member, Song } from '../../db/types'
import { M_TO_YD, PARADE_DEFAULT, YD_TO_M, apakahModeParade, paradeOf, patokOf, stepYd } from '../../lib/field'
import {
  LABEL_BLOK_DEFILE,
  URUTAN_BLOK_BAKU,
  buatSetPenghormatanVip,
  buatSetTikungan90,
  hitungRuteParade,
  saranJumlahBanjar,
  susunBarisanParade,
  type ArahBelokTikungan,
  type BlokDefileId,
  type ModePenghormatanVip,
  type SetParadeBaru,
} from '../../lib/parade'
import { cetakAtauUnduhLembarParade } from '../../lib/paradeCetak'
import { Badge, Button, Field, Input, Modal, useToast } from '../ui'

export interface ModalParadeProps {
  open: boolean
  onClose: () => void
  namaTim: string
  judulDrill: string
  namaSetAktif: string
  tempoDrill: number
  field: FieldConfig
  pointsAktif: Record<string, DrillPoint>
  members: Member[]
  laguTertaut?: Song | null
  onUbahField: (fieldBaru: FieldConfig) => Promise<void> | void
  onTerapkanPointsSetAktif: (pointsBaru: Record<string, DrillPoint>, catatanRingkas: string) => Promise<void> | void
  onTambahRangkaianSet: (setsBaru: SetParadeBaru[], fieldOpsional?: FieldConfig) => Promise<void> | void
}

type TabParade = 'banjar-saf' | 'tikungan-vip' | 'kalkulator-rute'

export default function ModalParade({
  open,
  onClose,
  namaTim,
  judulDrill,
  namaSetAktif,
  tempoDrill,
  field,
  pointsAktif,
  members,
  laguTertaut,
  onUbahField,
  onTerapkanPointsSetAktif,
  onTambahRangkaianSet,
}: ModalParadeProps) {
  const toast = useToast()
  const prd = paradeOf(field)
  const modeParade = apakahModeParade(field)
  const langkahBawaanCm = Math.round(stepYd(field) * YD_TO_M * 1000) / 10

  const [tab, setTab] = useState<TabParade>('banjar-saf')

  // --- State Tab 1: Banjar × Saf ---
  const [jumlahBanjar, setJumlahBanjar] = useState<number>(() => saranJumlahBanjar(field, 2))
  const [spasiBanjar, setSpasiBanjar] = useState<number>(2)
  const [spasiSaf, setSpasiSaf] = useState<number>(2)
  const [spasiSeksi, setSpasiSeksi] = useState<number>(4)
  const [jumlahSpanduk, setJumlahSpanduk] = useState<number>(0)
  const [urutanBlok, setUrutanBlok] = useState<BlokDefileId[]>(() => [...URUTAN_BLOK_BAKU])

  // --- State Tab 2: Tikungan 90° & Display VIP ---
  const [hitunganPutarManual, setHitunganPutarManual] = useState<string>('')
  const [perluasSimpang, setPerluasSimpang] = useState<boolean>(true)
  const [hitunganDisplayVip, setHitunganDisplayVip] = useState<number>(16)

  // --- State Tab 3: Kalkulator Rute ---
  const [panjangRuteM, setPanjangRuteM] = useState<number>(() => prd.panjangRuteM || 1500)
  const [bpmRute, setBpmRute] = useState<number>(() => tempoDrill || laguTertaut?.bpm || 116)
  const [langkahCm, setLangkahCm] = useState<number>(() => langkahBawaanCm || 60)
  const [durasiLaguDetik, setDurasiLaguDetik] = useState<number>(() => {
    if (laguTertaut?.tempoMap?.length) {
      const totalDtk = laguTertaut.tempoMap.reduce(
        (ak, seg) =>
          ak +
          (Math.max(1, seg.measure) * Math.max(1, seg.beats || laguTertaut.beats || 4) * 60) /
            Math.max(30, seg.bpm || laguTertaut.bpm || 116),
        0,
      )
      if (totalDtk >= 15) return Math.round(totalDtk)
    }
    return 150
  })
  const [ketukanStreetBeat, setKetukanStreetBeat] = useState<number>(32)
  const [durasiDisplayMenit, setDurasiDisplayMenit] = useState<number>(0)

  const pratinjauSusun = useMemo(
    () =>
      susunBarisanParade(members, field, {
        jumlahBanjar,
        jarakAntarBanjarLangkah: spasiBanjar,
        jarakAntarSafLangkah: spasiSaf,
        jarakAntarSeksiLangkah: spasiSeksi,
        jumlahSpanduk,
        urutanBlok,
      }),
    [members, field, jumlahBanjar, spasiBanjar, spasiSaf, spasiSeksi, jumlahSpanduk, urutanBlok],
  )

  const pratinjauTikungan = useMemo(() => {
    const angkaPutar = hitunganPutarManual.trim() === '' ? undefined : Math.max(4, Number(hitunganPutarManual) || 8)
    const sumberTitik =
      Object.keys(pointsAktif).length > 0 ? pointsAktif : pratinjauSusun.points
    return buatSetTikungan90(sumberTitik, field, 'kanan', { hitunganPutar: angkaPutar })
  }, [pointsAktif, pratinjauSusun.points, field, hitunganPutarManual])

  const hasilRute = useMemo(
    () =>
      hitungRuteParade({
        panjangRuteM,
        bpm: bpmRute,
        panjangLangkahCm: langkahCm,
        durasiLaguDetik,
        ketukanStreetBeat,
        durasiDisplayVipMenit: durasiDisplayMenit,
      }),
    [panjangRuteM, bpmRute, langkahCm, durasiLaguDetik, ketukanStreetBeat, durasiDisplayMenit],
  )

  async function aktifkanPresetJalan(lebarM: 6 | 8 | 12) {
    const panjangSegmenM = lebarM === 6 ? 50 : lebarM === 8 ? 60 : 75
    const bahuM = lebarM === 6 ? 0.4 : lebarM === 8 ? 0.5 : 0.75
    const vipM = lebarM === 6 ? 12 : lebarM === 8 ? 16 : 20
    const fieldBaru: FieldConfig = {
      ...field,
      widthYd: lebarM * M_TO_YD,
      lengthYd: panjangSegmenM * M_TO_YD,
      endZoneYd: 0,
      hash: 'none',
      showLabels: 0,
      satuan: 'm',
      warna: 'aspal',
      patok: { ...patokOf(field), aktif: 0 },
      parade: {
        ...PARADE_DEFAULT,
        ...prd,
        aktif: 1,
        bahuJalanM: bahuM,
        panjangPanggungM: vipM,
        panjangRuteM,
      },
    }
    await onUbahField(fieldBaru)
    const banjarIdeal = saranJumlahBanjar(fieldBaru, spasiBanjar)
    setJumlahBanjar(banjarIdeal)
    toast.push(`Kanvas Jalan Parade ${lebarM} m diaktifkan (saran otomatis: ${banjarIdeal} banjar).`, 'ok')
  }

  function geserBlok(idx: number, arah: -1 | 1) {
    const tujuan = idx + arah
    if (tujuan < 0 || tujuan >= urutanBlok.length) return
    const salinan = [...urutanBlok]
    const tmp = salinan[idx]
    salinan[idx] = salinan[tujuan]
    salinan[tujuan] = tmp
    setUrutanBlok(salinan)
  }

  async function terapkanBanjarSaf() {
    if (pratinjauSusun.jumlahPemain === 0) {
      toast.push('Belum ada anggota aktif untuk disusun ke dalam barisan.', 'err')
      return
    }
    if (!modeParade) {
      await aktifkanPresetJalan(8)
    }
    await onTerapkanPointsSetAktif(
      pratinjauSusun.points,
      `Barisan kirab ${jumlahBanjar} banjar × ${pratinjauSusun.jumlahSaf} saf (${pratinjauSusun.jumlahPemain} anggota)`,
    )
    toast.push(
      `Susunan ${jumlahBanjar} banjar × ${pratinjauSusun.jumlahSaf} saf diterapkan ke ${namaSetAktif}.`,
      'ok',
    )
  }

  async function tambahkanBelokTikungan(arah: ArahBelokTikungan) {
    const sumberTitik = Object.keys(pointsAktif).length > 0 ? pointsAktif : pratinjauSusun.points
    if (Object.keys(sumberTitik).length === 0) {
      toast.push('Susun barisan terlebih dahulu sebelum membuat simulasi tikungan.', 'err')
      return
    }
    const angkaPutar = hitunganPutarManual.trim() === '' ? undefined : Math.max(4, Number(hitunganPutarManual) || 8)
    const hasil = buatSetTikungan90(sumberTitik, field, arah, { hitunganPutar: angkaPutar })
    const fieldOpsional =
      perluasSimpang && hasil.lebarSimpangDisarankanYd > field.widthYd
        ? { ...field, widthYd: hasil.lebarSimpangDisarankanYd }
        : undefined
    await onTambahRangkaianSet(hasil.sets, fieldOpsional)
    toast.push(
      `2 set tikungan 90° ke ${arah === 'kanan' ? 'Kanan' : 'Kiri'} ditambahkan (${hasil.analisis.hitunganDipakaiPerSaf} hitungan/saf).`,
      'ok',
    )
  }

  async function tambahkanPenghormatanVip(mode: ModePenghormatanVip) {
    const sumberTitik = Object.keys(pointsAktif).length > 0 ? pointsAktif : pratinjauSusun.points
    if (Object.keys(sumberTitik).length === 0) {
      toast.push('Susun barisan terlebih dahulu sebelum membuat formasi Panggung VIP.', 'err')
      return
    }
    const setsBaru = buatSetPenghormatanVip(sumberTitik, field, mode, members, {
      hitunganDisplay: hitunganDisplayVip,
    })
    await onTambahRangkaianSet(setsBaru)
    toast.push(
      mode === 'hormat_jalan'
        ? 'Set Defile Hormat Jalan di Zona Panggung VIP berhasil ditambahkan.'
        : '3 set Display Panggung VIP → Kembali Defile berhasil ditambahkan tanpa mengacak saf!',
      'ok',
    )
  }

  async function simpanRuteKeDrill() {
    await onUbahField({
      ...field,
      parade: {
        ...prd,
        aktif: modeParade ? 1 : prd.aktif,
        panjangRuteM: Math.round(panjangRuteM),
      },
    })
    toast.push(`Panjang rute ${(panjangRuteM / 1000).toFixed(2).replace('.', ',')} km disimpan ke drill ini.`, 'ok')
  }

  function cetakKomando() {
    const sumberTitik = Object.keys(pointsAktif).length > 0 ? pointsAktif : pratinjauSusun.points
    const hasil = cetakAtauUnduhLembarParade({
      namaTim,
      judulDrill,
      namaSet: namaSetAktif,
      field: modeParade ? field : { ...field, parade: { ...prd, aktif: 1, panjangRuteM } },
      points: sumberTitik,
      members,
      rute: hasilRute,
      namaLagu: laguTertaut?.title,
    })
    if (hasil === 'unduh') {
      toast.push('Popup cetak diblokir browser — Lembar Komando Kirab diunduh sebagai HTML siap cetak.', 'ok')
    }
  }

  const lebarJalanSekarangM = (field.widthYd * YD_TO_M).toFixed(1).replace('.', ',')
  const k = pratinjauSusun.kesesuaianJalan

  return (
    <Modal open={open} onClose={onClose} title="Mode Kirab / Street Parade & Display Jalan Raya" wide>
      <div data-testid="modal-parade" className="space-y-4">
        {/* Pita status kanvas jalan raya */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/35 bg-slate-900/80 p-3">
          <div className="space-y-0.5 text-xs">
            {modeParade ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-200">Kanvas Jalan Parade Aktif</Badge>
                <span className="text-slate-200">
                  Lebar jalan <b>{lebarJalanSekarangM} m</b> · Arah{' '}
                  <b>{prd.arahDefile === 'kanan-ke-kiri' ? 'Kanan → Kiri' : 'Kiri → Kanan'}</b>
                  {prd.panggungAktif === 1 ? ` · VIP ${prd.panjangPanggungM} m` : ''}
                </span>
              </div>
            ) : (
              <div className="text-amber-200">
                Drill ini masih memakai kanvas lapangan biasa ({lebarJalanSekarangM} m). Pilih lebar jalan raya untuk menyalakan kanvas aspal &amp; Panggung Kehormatan:
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {([6, 8, 12] as const).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={modeParade && Math.abs(field.widthYd * YD_TO_M - m) < 0.25 ? 'primary' : 'soft'}
                data-testid={`parade-pilih-jalan-${m}m`}
                onClick={() => void aktifkanPresetJalan(m)}
              >
                Jalan {m} m
              </Button>
            ))}
          </div>
        </div>

        {/* Navigasi 3 Tab */}
        <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-950/80 p-1">
          <button
            type="button"
            data-testid="tab-parade-banjar"
            onClick={() => setTab('banjar-saf')}
            className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
              tab === 'banjar-saf'
                ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Banjar × Saf
          </button>
          <button
            type="button"
            data-testid="tab-parade-tikungan"
            onClick={() => setTab('tikungan-vip')}
            className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
              tab === 'tikungan-vip'
                ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Tikungan 90° &amp; VIP
          </button>
          <button
            type="button"
            data-testid="tab-parade-kalkulator"
            onClick={() => setTab('kalkulator-rute')}
            className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition ${
              tab === 'kalkulator-rute'
                ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Kalkulator Rute &amp; Cetak
          </button>
        </div>

        {/* ==================== TAB 1: PENYUSUN BANJAR × SAF ==================== */}
        {tab === 'banjar-saf' && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="Jumlah Banjar (kolom)"
                hint={`Saran jalan ini: ${saranJumlahBanjar(field, spasiBanjar)} banjar`}
              >
                <div className="flex gap-1.5">
                  <Input
                    data-testid="parade-input-banjar"
                    type="number"
                    min={1}
                    max={16}
                    value={jumlahBanjar}
                    onChange={(e) => setJumlahBanjar(Math.max(1, Math.min(16, Number(e.target.value) || 1)))}
                  />
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={() => setJumlahBanjar(saranJumlahBanjar(field, spasiBanjar))}
                    title="Sesuaikan otomatis dengan lebar jalan"
                  >
                    Auto
                  </Button>
                </div>
              </Field>
              <Field label="Jarak antar-banjar (langkah)" hint="lebar kiri–kanan">
                <Input
                  data-testid="parade-input-spasi-banjar"
                  type="number"
                  step="0.5"
                  min={1}
                  max={6}
                  value={spasiBanjar}
                  onChange={(e) => setSpasiBanjar(Math.max(0.5, Number(e.target.value) || 2))}
                />
              </Field>
              <Field label="Jarak antar-saf (langkah)" hint="depan–belakang">
                <Input
                  data-testid="parade-input-spasi-saf"
                  type="number"
                  step="0.5"
                  min={1}
                  max={8}
                  value={spasiSaf}
                  onChange={(e) => setSpasiSaf(Math.max(1, Number(e.target.value) || 2))}
                />
              </Field>
              <Field label="Jeda antar-seksi (langkah)" hint="pemisah Guard–Brass–Battery">
                <Input
                  data-testid="parade-input-spasi-seksi"
                  type="number"
                  step="1"
                  min={1}
                  max={12}
                  value={spasiSeksi}
                  onChange={(e) => setSpasiSeksi(Math.max(1, Number(e.target.value) || 4))}
                />
              </Field>
              <Field label="Personel Spanduk/Pataka" hint="0 = tanpa baris spanduk khusus">
                <Input
                  data-testid="parade-input-spanduk"
                  type="number"
                  min={0}
                  max={12}
                  value={jumlahSpanduk}
                  onChange={(e) => setJumlahSpanduk(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                />
              </Field>
              <div className="flex flex-col justify-end">
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-300">
                  <div>
                    Total: <b>{pratinjauSusun.jumlahPemain}</b> anggota →{' '}
                    <b>{pratinjauSusun.jumlahSaf} saf</b>
                  </div>
                  <div className="text-slate-400">
                    Panjang barisan: <b>{String(pratinjauSusun.panjangBarisanM).replace('.', ',')} m</b>
                  </div>
                </div>
              </div>
            </div>

            {/* Pemeriksa lebar jalan raya */}
            <div
              data-testid="parade-status-jalan"
              className={`rounded-xl border p-3 text-xs ${
                k.status === 'aman'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : k.status === 'mepet'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                    : 'border-rose-500/50 bg-rose-500/15 text-rose-200'
              }`}
            >
              <div className="font-semibold">
                Lebar barisan {String(k.lebarBarisanM).replace('.', ',')} m di dalam jalan efektif{' '}
                {String(k.lebarEfektifM).replace('.', ',')} m (total aspal {String(k.lebarJalanM).replace('.', ',')} m)
              </div>
              <div className="mt-0.5 opacity-90">{k.pesan}</div>
            </div>

            {/* Urutan blok defile */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="mb-2 text-xs font-medium text-slate-300">
                Urutan blok dari kepala barisan (depan) ke ekor barisan:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {urutanBlok.map((blok, i) => (
                  <div
                    key={blok}
                    className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200"
                  >
                    <span className="font-mono text-[10px] text-sky-400">{i + 1}.</span>
                    <span>{LABEL_BLOK_DEFILE[blok]}</span>
                    <button
                      type="button"
                      onClick={() => geserBlok(i, -1)}
                      disabled={i === 0}
                      className="ml-1 rounded px-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
                      title="Maju ke depan"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => geserBlok(i, 1)}
                      disabled={i === urutanBlok.length - 1}
                      className="rounded px-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
                      title="Mundur ke belakang"
                    >
                      →
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-400">
                Menyusun titik pada <b>{namaSetAktif}</b> (bisa dibatalkan kapan saja dengan Undo / Ctrl+Z).
              </span>
              <Button
                variant="primary"
                data-testid="parade-terapkan-banjar-saf"
                onClick={() => void terapkanBanjarSaf()}
              >
                Terapkan Banjar × Saf ke {namaSetAktif}
              </Button>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: TIKUNGAN 90° & DISPLAY VIP ==================== */}
        {tab === 'tikungan-vip' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Kartu Simulasi Tikungan 90° */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">Simulasi Tikungan 90° (Wheel Turn)</h3>
                  <Badge
                    className={
                      pratinjauTikungan.analisis.amanLangkahLuar
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                        : 'border-rose-500/40 bg-rose-500/15 text-rose-200'
                    }
                  >
                    {pratinjauTikungan.analisis.hitunganDipakaiPerSaf} hitungan/saf
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">
                  Membuat 2 set berurutan (<b>Poros Tikungan</b> → <b>Selesai Belok 90°</b>) memakai gerak sapuan poros banjar dalam tanpa mengacak urutan saf.
                </p>
                <Field
                  label="Hitungan putar per saf"
                  hint={`Saran busur luar: ${pratinjauTikungan.analisis.hitunganSaranPerSaf} ketukan`}
                >
                  <Input
                    data-testid="parade-input-hitungan-putar"
                    type="number"
                    min={4}
                    step={4}
                    placeholder={`Otomatis (${pratinjauTikungan.analisis.hitunganSaranPerSaf})`}
                    value={hitunganPutarManual}
                    onChange={(e) => setHitunganPutarManual(e.target.value)}
                  />
                </Field>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={perluasSimpang}
                    onChange={(e) => setPerluasSimpang(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-900"
                  />
                  Perluas ruang simpang kanvas otomatis bila ekor barisan panjang
                </label>
                <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5 text-[11px] text-slate-300">
                  {pratinjauTikungan.analisis.catatanTeknis}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  data-testid="parade-buat-belok-kanan"
                  onClick={() => void tambahkanBelokTikungan('kanan')}
                >
                  + Belok Kanan 90°
                </Button>
                <Button
                  size="sm"
                  variant="soft"
                  data-testid="parade-buat-belok-kiri"
                  onClick={() => void tambahkanBelokTikungan('kiri')}
                >
                  + Belok Kiri 90°
                </Button>
              </div>
            </div>

            {/* Kartu Penghormatan & Display Panggung Kehormatan */}
            <div className="flex flex-col justify-between rounded-xl border border-amber-500/30 bg-slate-950/60 p-3.5">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-amber-200">Penghormatan &amp; Display VIP</h3>
                  <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-200">VIP {prd.panjangPanggungM} m</Badge>
                </div>
                <p className="text-xs leading-relaxed text-slate-400">
                  Susun penghormatan sambil berjalan (<i>eyes right/left</i>) atau buka formasi <i>company front</i> singkat menghadap <b>{prd.labelPanggung}</b> lalu kembali ke susunan Banjar × Saf semula!
                </p>
                <Field label="Durasi set Display VIP (hitungan)">
                  <Input
                    data-testid="parade-input-hitungan-display"
                    type="number"
                    min={8}
                    step={4}
                    value={hitunganDisplayVip}
                    onChange={(e) => setHitunganDisplayVip(Math.max(8, Number(e.target.value) || 16))}
                  />
                </Field>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px] text-amber-100/90">
                  Posisi panggung: <b>{prd.sisiPanggung === 'belakang' ? 'Tepi Belakang (Atas)' : 'Tepi Depan (Penonton)'}</b> · Titik tengah <b>{prd.posisiPanggungM} m</b>. Urutan banjar &amp; saf dijamin pulih 100% seusai display.
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="soft"
                  data-testid="parade-buat-hormat-jalan"
                  onClick={() => void tambahkanPenghormatanVip('hormat_jalan')}
                >
                  + Set Defile Hormat Jalan (Tanpa Berhenti)
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  data-testid="parade-buat-display-vip"
                  onClick={() => void tambahkanPenghormatanVip('display_buka_tutup')}
                >
                  + 3 Set Display Panggung VIP → Kembali Defile
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: KALKULATOR RUTE & CETAK ==================== */}
        {tab === 'kalkulator-rute' && (
          <div className="space-y-3">
            {/* Tombol jarak cepat */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400">Preset jarak rute:</span>
              {[500, 1000, 1500, 2500, 4000].map((m) => (
                <button
                  key={m}
                  type="button"
                  data-testid={`parade-rute-cepat-${m}`}
                  onClick={() => setPanjangRuteM(m)}
                  className={`rounded-lg border px-2.5 py-1 font-medium transition ${
                    panjangRuteM === m
                      ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {m >= 1000 ? `${String(m / 1000).replace('.', ',')} km` : `${m} m`}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Panjang rute kirab (meter)">
                <Input
                  data-testid="parade-input-rute-m"
                  type="number"
                  min={50}
                  step={100}
                  value={panjangRuteM}
                  onChange={(e) => setPanjangRuteM(Math.max(50, Number(e.target.value) || 500))}
                />
              </Field>
              <Field label="Tempo langkah (BPM)">
                <Input
                  data-testid="parade-input-bpm"
                  type="number"
                  min={60}
                  max={220}
                  value={bpmRute}
                  onChange={(e) => setBpmRute(Math.max(60, Math.min(220, Number(e.target.value) || 116)))}
                />
              </Field>
              <Field label="Panjang langkah (cm)" hint="8-to-5 = 57,2 cm · PDBI = 60–65 cm">
                <Input
                  data-testid="parade-input-langkah-cm"
                  type="number"
                  step="0.5"
                  min={30}
                  max={100}
                  value={langkahCm}
                  onChange={(e) => setLangkahCm(Math.max(30, Math.min(100, Number(e.target.value) || 60)))}
                />
              </Field>
              <Field
                label="Durasi 1 putaran lagu (detik)"
                hint={laguTertaut ? `Lagu: ${laguTertaut.title}` : 'durasi medli / repertoar'}
              >
                <Input
                  data-testid="parade-input-durasi-lagu"
                  type="number"
                  min={20}
                  step={10}
                  value={durasiLaguDetik}
                  onChange={(e) => setDurasiLaguDetik(Math.max(20, Number(e.target.value) || 120))}
                />
              </Field>
              <Field label="Jeda street beat perkusi (ketukan)" hint="cadangan napas Brass antar-lagu">
                <Input
                  data-testid="parade-input-street-beat"
                  type="number"
                  min={0}
                  step={8}
                  value={ketukanStreetBeat}
                  onChange={(e) => setKetukanStreetBeat(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                />
              </Field>
              <Field label="Tambahan waktu display VIP (menit)">
                <Input
                  data-testid="parade-input-display-menit"
                  type="number"
                  min={0}
                  step="0.5"
                  value={durasiDisplayMenit}
                  onChange={(e) => setDurasiDisplayMenit(Math.max(0, Number(e.target.value) || 0))}
                />
              </Field>
            </div>

            {/* Ringkasan hasil kalkulasi */}
            <div data-testid="parade-hasil-rute" className="grid gap-2.5 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-[11px] text-slate-400">Total Waktu Tempuh</div>
                <div data-testid="parade-waktu-tempuh" className="mt-0.5 text-lg font-bold text-white">
                  {String(hasilRute.totalWaktuTempuhMenit).replace('.', ',')} mnt
                </div>
                <div className="text-[11px] text-slate-500">
                  Jalan murni {String(hasilRute.waktuJalanMenit).replace('.', ',')} mnt
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-[11px] text-slate-400">Kecepatan &amp; Langkah</div>
                <div className="mt-0.5 text-lg font-bold text-sky-300">
                  {String(hasilRute.kecepatanKmPerJam).replace('.', ',')} km/jam
                </div>
                <div className="text-[11px] text-slate-500">
                  {hasilRute.totalLangkah.toLocaleString('id-ID')} langkah ({String(hasilRute.kecepatanMPerMenit).replace('.', ',')} m/mnt)
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-[11px] text-slate-400">Pengulangan Lagu</div>
                <div data-testid="parade-ulang-lagu" className="mt-0.5 text-lg font-bold text-amber-300">
                  {hasilRute.jumlahPengulanganLagu}× siklus
                </div>
                <div className="text-[11px] text-slate-500">
                  Tiap siklus menempuh {Math.round(hasilRute.jarakSatuSiklusM)} m
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-[11px] text-slate-400">Cadangan Napas Tiup</div>
                <div className="mt-0.5 text-lg font-bold text-emerald-300">
                  {String(hasilRute.rasioCadanganNapasPersen).replace('.', ',')}%
                </div>
                <div className="text-[11px] text-slate-500">
                  Istirahat {Math.round(hasilRute.jarakStreetBeatM)} m per siklus
                </div>
              </div>
            </div>

            <div
              data-testid="parade-status-napas"
              className={`rounded-xl border p-3 text-xs ${
                hasilRute.statusKetahanan === 'nyaman'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : hasilRute.statusKetahanan === 'padat'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                    : 'border-rose-500/50 bg-rose-500/15 text-rose-200'
              }`}
            >
              {hasilRute.rekomendasiNapas}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button variant="soft" data-testid="parade-simpan-rute" onClick={() => void simpanRuteKeDrill()}>
                Simpan Rute ke Drill
              </Button>
              <Button variant="primary" data-testid="parade-cetak-komando" onClick={cetakKomando}>
                Cetak / Unduh Lembar Komando A4
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
