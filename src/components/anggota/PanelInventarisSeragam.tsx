import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type {
  CatatanServisInventaris,
  ItemInventaris,
  KategoriInventaris,
  KondisiInventaris,
  Member,
  ProfilUkuranSeragam,
  StatusPinjamSeragam,
} from '../../db/types'
import {
  DAFTAR_KATEGORI_INVENTARIS,
  DAFTAR_KONDISI_INVENTARIS,
  DAFTAR_STATUS_SERAGAM,
  LABEL_KATEGORI_INVENTARIS,
  LABEL_KONDISI_INVENTARIS,
  LABEL_PENDEK_KATEGORI,
  LABEL_STATUS_SERAGAM,
  buatKodeAsetOtomatis,
  eksporCsvUkuranSeragam,
  ringkasInventaris,
  ringkasSeragamTim,
} from '../../lib/inventarisLogistik'
import {
  bangunHtmlBeritaAcaraPinjam,
  bangunHtmlBukuInventaris,
  bangunHtmlDistribusiSeragam,
} from '../../lib/inventarisLogistikCetak'
import { namaTampil } from '../../lib/namaAnggota'
import { downloadHtmlFile, printHtml } from '../../lib/print'
import { cx, downloadFile, sectionLabel, slugify, uid, visibleSections } from '../../lib/utils'
import { IconDownload, IconEye, IconPlus, IconPrinter, IconSearch } from '../Icons'
import {
  Badge,
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  Toggle,
  useToast,
} from '../ui'

function hariIniIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ========================================================================== */
/*  1. BUKU INDUK INVENTARIS ALAT & BERITA ACARA PEMINJAMAN                   */
/* ========================================================================== */

export function PanelBukuInventaris({
  members,
  namaTim,
  namaPelatih,
  kota,
}: {
  members: Member[]
  namaTim: string
  namaPelatih?: string
  kota?: string
}) {
  const toast = useToast()
  const inventaris = useLiveQuery(() => db.inventaris.toArray(), [], [])
  const [cari, setCari] = useState('')
  const [filterKategori, setFilterKategori] = useState<KategoriInventaris | 'semua'>('semua')
  const [filterKondisi, setFilterKondisi] = useState<KondisiInventaris | 'semua' | 'dipinjam'>('semua')
  const [asetSunting, setAsetSunting] = useState<ItemInventaris | null>(null)
  const [modalAsetOpen, setModalAsetOpen] = useState(false)

  // Modal Pratinjau Cetak (Berita Acara vs Buku Induk)
  const [pratinjauOpen, setPratinjauOpen] = useState(false)
  const [jenisDokumenCetak, setJenisDokumenCetak] = useState<'berita-acara' | 'buku-induk'>('berita-acara')
  const [peminjamCetakId, setPeminjamCetakId] = useState<string>('semua')

  const petaAnggota = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const ringkas = useMemo(() => ringkasInventaris(inventaris ?? []), [inventaris])

  const daftarTampil = useMemo(() => {
    const kueri = cari.trim().toLowerCase()
    return [...(inventaris ?? [])]
      .filter((it) => (filterKategori === 'semua' ? true : it.kategori === filterKategori))
      .filter((it) => {
        if (filterKondisi === 'semua') return true
        if (filterKondisi === 'dipinjam') return Boolean(it.pemegangId?.trim())
        return it.kondisi === filterKondisi
      })
      .filter((it) => {
        if (!kueri) return true
        const peminjam = it.pemegangId ? petaAnggota.get(it.pemegangId) : undefined
        const gabung = [
          it.kodeAset,
          it.nomorSeri,
          it.nama,
          it.merekTipe,
          it.lokasiSimpan,
          peminjam?.name,
          peminjam?.code,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return gabung.includes(kueri)
      })
      .sort((a, b) => a.kategori.localeCompare(b.kategori) || a.kodeAset.localeCompare(b.kodeAset))
  }, [inventaris, cari, filterKategori, filterKondisi, petaAnggota])

  const daftarPeminjamAktif = useMemo(() => {
    const ids = new Set(
      (inventaris ?? [])
        .map((it) => it.pemegangId)
        .filter((id): id is string => Boolean(id && petaAnggota.has(id))),
    )
    return Array.from(ids)
      .map((id) => petaAnggota.get(id)!)
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [inventaris, petaAnggota])

  function bukaTambahAset() {
    const skrg = Date.now()
    const baru: ItemInventaris = {
      id: uid('inv_'),
      kodeAset: buatKodeAsetOtomatis('brass', inventaris ?? []),
      nama: '',
      kategori: 'brass',
      kondisi: 'siap_pakai',
      wajibBawaLomba: 1,
      riwayatServis: [],
      createdAt: skrg,
      updatedAt: skrg,
    }
    setAsetSunting(baru)
    setModalAsetOpen(true)
  }

  function bukaSuntingAset(item: ItemInventaris) {
    setAsetSunting({
      ...item,
      riwayatServis: [...(item.riwayatServis ?? [])],
    })
    setModalAsetOpen(true)
  }

  function bukaPratinjauBeritaAcara(memberId = 'semua') {
    setJenisDokumenCetak('berita-acara')
    setPeminjamCetakId(memberId)
    setPratinjauOpen(true)
  }

  function bukaPratinjauBukuInduk() {
    setJenisDokumenCetak('buku-induk')
    setPratinjauOpen(true)
  }

  const htmlCetakAktif = useMemo(() => {
    if (!pratinjauOpen) return ''
    if (jenisDokumenCetak === 'buku-induk') {
      return bangunHtmlBukuInventaris({
        namaTim,
        inventaris: inventaris ?? [],
        members,
      })
    }
    const target = peminjamCetakId === 'semua' ? null : petaAnggota.get(peminjamCetakId) ?? null
    return bangunHtmlBeritaAcaraPinjam({
      namaTim,
      namaPelatih,
      kota,
      inventaris: inventaris ?? [],
      members,
      anggotaTarget: target,
      labelSeksi: sectionLabel,
    })
  }, [pratinjauOpen, jenisDokumenCetak, peminjamCetakId, namaTim, namaPelatih, kota, inventaris, members, petaAnggota])

  return (
    <div data-testid="panel-buku-inventaris" className="space-y-4">
      {/* Ringkasan Statistik Inventaris */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3">
          <div className="text-lg font-bold tabular-nums text-slate-100" data-testid="inv-total-aset">
            {ringkas.total}
          </div>
          <div className="text-[11px] text-slate-400">Total aset tercatat</div>
        </Card>
        <Card className="p-3">
          <div className="text-lg font-bold tabular-nums text-emerald-300" data-testid="inv-siap-pakai">
            {ringkas.siapPakai}
          </div>
          <div className="text-[11px] text-slate-400">Siap pakai</div>
        </Card>
        <Card className="p-3">
          <div
            className={cx(
              'text-lg font-bold tabular-nums',
              ringkas.perluServis + ringkas.rusak > 0 ? 'text-amber-300' : 'text-slate-300',
            )}
            data-testid="inv-butuh-servis"
          >
            {ringkas.perluServis + ringkas.rusak}
          </div>
          <div className="text-[11px] text-slate-400">
            Perlu servis ({ringkas.perluServis}) / Rusak ({ringkas.rusak})
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-lg font-bold tabular-nums text-sky-300" data-testid="inv-dipinjam">
            {ringkas.sedangDipinjam}
          </div>
          <div className="text-[11px] text-slate-400">
            Dipinjam anggota · {ringkas.diGudang} di gudang
          </div>
        </Card>
      </div>

      {/* Bilah Saringan & Aksi */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              data-testid="tambah-aset-inventaris"
              onClick={bukaTambahAset}
            >
              <IconPlus size={15} /> Tambah Aset
            </Button>
            <Button
              size="sm"
              data-testid="buka-berita-acara"
              onClick={() => bukaPratinjauBeritaAcara('semua')}
            >
              <IconPrinter size={14} /> Berita Acara Pinjam
            </Button>
            <Button
              size="sm"
              variant="ghost"
              data-testid="pratinjau-buku-inventaris"
              onClick={bukaPratinjauBukuInduk}
            >
              <IconEye size={14} /> Cetak Buku Induk
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            data-testid="pintasan-manifes-lomba"
            onClick={() => {
              location.hash = '#/lomba?tab=logistik'
            }}
          >
            Ke Manifes Truk Lomba →
          </Button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="relative">
            <IconSearch size={15} className="pointer-events-none absolute top-2.5 left-3 text-slate-500" />
            <Input
              data-testid="cari-inventaris"
              aria-label="Cari aset inventaris"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari kode aset, seri, merek, atau peminjam…"
              className="pl-9 text-xs"
            />
          </div>
          <Select
            data-testid="filter-kategori-inv"
            aria-label="Filter kategori inventaris"
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value as KategoriInventaris | 'semua')}
            className="text-xs"
          >
            <option value="semua">Semua Kategori</option>
            {DAFTAR_KATEGORI_INVENTARIS.map((k) => (
              <option key={k} value={k}>
                {LABEL_KATEGORI_INVENTARIS[k]}
              </option>
            ))}
          </Select>
          <Select
            data-testid="filter-kondisi-inv"
            aria-label="Filter kondisi inventaris"
            value={filterKondisi}
            onChange={(e) => setFilterKondisi(e.target.value as KondisiInventaris | 'semua' | 'dipinjam')}
            className="text-xs"
          >
            <option value="semua">Semua Status Kondisi</option>
            <option value="siap_pakai">Siap Pakai</option>
            <option value="perlu_servis">Perlu Servis</option>
            <option value="rusak">Rusak / Karantina</option>
            <option value="dipinjam">Sedang Dipinjam Anggota</option>
          </Select>
        </div>
      </Card>

      {/* Daftar Aset */}
      {daftarTampil.length === 0 ? (
        <EmptyState
          title={inventaris.length === 0 ? 'Buku Induk Inventaris masih kosong' : 'Tidak ada aset yang cocok'}
          desc="Catat instrumen, boks pit, sound, peralatan Color Guard, dan properti panggung agar peminjaman dan riwayat perawatan tercatat rapi."
          action={
            inventaris.length === 0 ? (
              <Button variant="primary" onClick={bukaTambahAset}>
                <IconPlus size={15} /> Catat Aset Pertama
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2" data-testid="daftar-aset-inventaris">
          {daftarTampil.map((it) => {
            const pemegang = it.pemegangId ? petaAnggota.get(it.pemegangId) : undefined
            const warnaKondisi =
              it.kondisi === 'siap_pakai'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : it.kondisi === 'perlu_servis'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
            return (
              <Card
                key={it.id}
                data-testid={`baris-aset-${it.kodeAset}`}
                className="p-3 transition hover:border-slate-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-200">
                        {it.kodeAset}
                      </span>
                      <span className={cx('rounded-full border px-2 py-0.5 text-[10px] font-semibold', warnaKondisi)}>
                        {LABEL_KONDISI_INVENTARIS[it.kondisi]}
                      </span>
                      <Badge className="bg-slate-800/80 text-slate-300">
                        {LABEL_PENDEK_KATEGORI[it.kategori]}
                      </Badge>
                      {it.wajibBawaLomba === 1 && (
                        <span className="rounded border border-sky-700/40 bg-sky-950/40 px-1.5 py-0.5 text-[10px] text-sky-300">
                          Ikut Truk Lomba
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-100">
                      {it.nama}
                      {it.merekTipe ? (
                        <span className="font-normal text-slate-400"> · {it.merekTipe}</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {it.nomorSeri ? `No. Seri: ${it.nomorSeri} · ` : ''}
                      {pemegang ? (
                        <span className="text-emerald-300">
                          Dipinjam: <b>{pemegang.code}</b> — {namaTampil(pemegang)}
                          {it.tanggalPinjam ? ` (sejak ${it.tanggalPinjam})` : ''}
                        </span>
                      ) : (
                        <span>Gudang: {it.lokasiSimpan || 'Markas utama'}</span>
                      )}
                      {it.riwayatServis?.length
                        ? ` · ${it.riwayatServis.length} riwayat servis`
                        : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {pemegang && (
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid={`cetak-ba-${it.kodeAset}`}
                        onClick={() => bukaPratinjauBeritaAcara(pemegang.id)}
                        title="Cetak Berita Acara Peminjaman untuk anggota ini"
                      >
                        <IconPrinter size={13} /> BA Pinjam
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`sunting-aset-${it.kodeAset}`}
                      onClick={() => bukaSuntingAset(it)}
                    >
                      Sunting / Servis
                    </Button>
                    <ConfirmButton
                      size="sm"
                      label="Hapus"
                      message={`Hapus aset ${it.kodeAset} (${it.nama}) dari inventaris?`}
                      onConfirm={async () => {
                        await db.inventaris.delete(it.id)
                        toast.push(`Aset ${it.kodeAset} dihapus`, 'info')
                      }}
                    />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal Tambah / Sunting Aset & Riwayat Servis */}
      <ModalAsetInventaris
        open={modalAsetOpen}
        item={asetSunting}
        semuaAset={inventaris ?? []}
        members={members}
        onClose={() => setModalAsetOpen(false)}
      />

      {/* Modal Pratinjau Cetak Berita Acara / Buku Induk (#hex murni) */}
      <Modal
        open={pratinjauOpen}
        onClose={() => setPratinjauOpen(false)}
        title={
          jenisDokumenCetak === 'berita-acara'
            ? 'Pratinjau Berita Acara Peminjaman Alat (A4)'
            : 'Pratinjau Buku Induk Inventaris (A4)'
        }
        testId="modal-pratinjau-inventaris"
        wide
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                data-testid="pilih-dokumen-cetak-inv"
                value={jenisDokumenCetak}
                onChange={(e) => setJenisDokumenCetak(e.target.value as 'berita-acara' | 'buku-induk')}
                className="text-xs"
              >
                <option value="berita-acara">Berita Acara Peminjaman</option>
                <option value="buku-induk">Buku Induk Inventaris</option>
              </Select>
              {jenisDokumenCetak === 'berita-acara' && (
                <Select
                  data-testid="pilih-peminjam-ba"
                  value={peminjamCetakId}
                  onChange={(e) => setPeminjamCetakId(e.target.value)}
                  className="text-xs"
                >
                  <option value="semua">Semua Peminjam Aktif ({daftarPeminjamAktif.length})</option>
                  {daftarPeminjamAktif.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} — {m.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setPratinjauOpen(false)}>
                Tutup
              </Button>
              <Button
                variant="ghost"
                data-testid="unduh-html-inventaris"
                onClick={() => {
                  const nama =
                    jenisDokumenCetak === 'berita-acara'
                      ? `berita-acara-pinjam-${slugify(namaTim)}.html`
                      : `buku-induk-inventaris-${slugify(namaTim)}.html`
                  downloadHtmlFile(htmlCetakAktif, nama)
                  toast.push('Dokumen HTML A4 diunduh')
                }}
              >
                <IconDownload size={14} /> Unduh HTML
              </Button>
              <Button
                variant="primary"
                data-testid="cetak-dokumen-inventaris"
                onClick={() => {
                  if (!printHtml(htmlCetakAktif)) {
                    toast.push('Jendela cetak diblokir — gunakan tombol Unduh HTML', 'err')
                  }
                }}
              >
                <IconPrinter size={14} /> Cetak / PDF
              </Button>
            </div>
          </div>
        }
      >
        <iframe
          data-testid="iframe-pratinjau-inventaris"
          title="Pratinjau Cetak Inventaris"
          srcDoc={htmlCetakAktif}
          className="h-[68vh] w-full rounded-lg border border-slate-700 bg-white"
        />
      </Modal>
    </div>
  )
}

function ModalAsetInventaris({
  open,
  item,
  semuaAset,
  members,
  onClose,
}: {
  open: boolean
  item: ItemInventaris | null
  semuaAset: ItemInventaris[]
  members: Member[]
  onClose: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState<ItemInventaris | null>(item)
  const [servisTgl, setServisTgl] = useState(hariIniIso())
  const [servisJenis, setServisJenis] = useState('')
  const [servisBiaya, setServisBiaya] = useState('')
  const [servisPelaksana, setServisPelaksana] = useState('')
  const [servisKondisiBaru, setServisKondisiBaru] = useState<KondisiInventaris>('siap_pakai')

  useEffect(() => {
    setForm(item ? { ...item, riwayatServis: [...(item.riwayatServis ?? [])] } : null)
    setServisJenis('')
    setServisBiaya('')
    setServisPelaksana('')
  }, [item, open])

  if (!open || !form) return null

  const sudahAdaKodeSama = semuaAset.some(
    (x) => x.id !== form.id && x.kodeAset.trim().toLowerCase() === form.kodeAset.trim().toLowerCase(),
  )

  function tambahCatatanServis() {
    if (!form || !servisJenis.trim()) return
    const entri: CatatanServisInventaris = {
      id: uid('srv_'),
      tanggal: servisTgl || hariIniIso(),
      jenis: servisJenis.trim(),
      biaya: servisBiaya ? Math.max(0, Number(servisBiaya) || 0) : undefined,
      pelaksana: servisPelaksana.trim() || undefined,
      kondisiSetelah: servisKondisiBaru,
    }
    setForm({
      ...form,
      kondisi: servisKondisiBaru,
      riwayatServis: [entri, ...(form.riwayatServis ?? [])],
    })
    setServisJenis('')
    setServisBiaya('')
    setServisPelaksana('')
  }

  async function simpanAset() {
    if (!form) return
    if (!form.nama.trim() || !form.kodeAset.trim()) {
      toast.push('Kode aset dan nama barang wajib diisi', 'err')
      return
    }
    await db.inventaris.put({
      ...form,
      kodeAset: form.kodeAset.trim(),
      nama: form.nama.trim(),
      nomorSeri: form.nomorSeri?.trim() || undefined,
      merekTipe: form.merekTipe?.trim() || undefined,
      lokasiSimpan: form.lokasiSimpan?.trim() || undefined,
      pemegangId: form.pemegangId || undefined,
      tanggalPinjam: form.pemegangId ? form.tanggalPinjam || hariIniIso() : undefined,
      targetKembali: form.pemegangId ? form.targetKembali || undefined : undefined,
      kelengkapanPinjam: form.kelengkapanPinjam?.trim() || undefined,
      catatan: form.catatan?.trim() || undefined,
      updatedAt: Date.now(),
    })
    toast.push(`Aset ${form.kodeAset.trim()} tersimpan`)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Data Aset Inventaris & Riwayat Servis"
      testId="modal-aset-inventaris"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" data-testid="simpan-aset-inventaris" onClick={() => void simpanAset()}>
            Simpan Aset
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Kategori">
          <Select
            data-testid="input-kategori-aset"
            value={form.kategori}
            onChange={(e) => {
              const katBaru = e.target.value as KategoriInventaris
              const apakahBaru = !semuaAset.some((x) => x.id === form.id)
              setForm({
                ...form,
                kategori: katBaru,
                kodeAset: apakahBaru ? buatKodeAsetOtomatis(katBaru, semuaAset) : form.kodeAset,
              })
            }}
          >
            {DAFTAR_KATEGORI_INVENTARIS.map((k) => (
              <option key={k} value={k}>
                {LABEL_KATEGORI_INVENTARIS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kode Aset Unit" hint={sudahAdaKodeSama ? 'kode sudah dipakai' : undefined}>
          <Input
            data-testid="input-kode-aset"
            value={form.kodeAset}
            onChange={(e) => setForm({ ...form, kodeAset: e.target.value })}
            placeholder="Mis. BRS-01"
          />
        </Field>
        <Field label="Nomor Seri Pabrikan" hint="opsional">
          <Input
            data-testid="input-seri-aset"
            value={form.nomorSeri ?? ''}
            onChange={(e) => setForm({ ...form, nomorSeri: e.target.value })}
            placeholder="Mis. YTR-8335-44109"
          />
        </Field>
        <Field label="Nama Instrumen / Barang">
          <Input
            data-testid="input-nama-aset"
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
            placeholder="Mis. Trumpet Bb Utama 1"
          />
        </Field>
        <Field label="Merek & Tipe">
          <Input
            data-testid="input-merek-aset"
            value={form.merekTipe ?? ''}
            onChange={(e) => setForm({ ...form, merekTipe: e.target.value })}
            placeholder="Mis. Yamaha Xeno YTR-8335"
          />
        </Field>
        <Field label="Status Kondisi">
          <Select
            data-testid="input-kondisi-aset"
            value={form.kondisi}
            onChange={(e) => setForm({ ...form, kondisi: e.target.value as KondisiInventaris })}
          >
            {DAFTAR_KONDISI_INVENTARIS.map((kd) => (
              <option key={kd} value={kd}>
                {LABEL_KONDISI_INVENTARIS[kd]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lokasi Simpan di Gudang">
          <Input
            data-testid="input-lokasi-aset"
            value={form.lokasiSimpan ?? ''}
            onChange={(e) => setForm({ ...form, lokasiSimpan: e.target.value })}
            placeholder="Mis. Rak Brass A1"
          />
        </Field>
        <div className="flex items-end sm:col-span-2">
          <Toggle
            testId="toggle-wajib-lomba-aset"
            checked={form.wajibBawaLomba === 1}
            onChange={(aktif) => setForm({ ...form, wajibBawaLomba: aktif ? 1 : 0 })}
            label="Otomatis masukkan ke Manifes Loading Truk saat hari lomba"
          />
        </div>
      </div>

      {/* Bagian Peminjaman ke Anggota */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-200">Peminjaman kepada Anggota</p>
          {form.pemegangId && (
            <button
              type="button"
              data-testid="kembalikan-ke-gudang"
              onClick={() =>
                setForm({
                  ...form,
                  pemegangId: undefined,
                  tanggalPinjam: undefined,
                  targetKembali: undefined,
                })
              }
              className="text-[11px] text-emerald-400 hover:underline"
            >
              Tandai sudah kembali ke gudang
            </button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Pemegang / Peminjam Saat Ini">
            <Select
              data-testid="pilih-peminjam-aset"
              value={form.pemegangId ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  pemegangId: e.target.value || undefined,
                  tanggalPinjam: e.target.value ? form.tanggalPinjam || hariIniIso() : undefined,
                })
              }
            >
              <option value="">— Tersimpan di Gudang —</option>
              {members
                .filter((m) => m.active === 1 || m.id === form.pemegangId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.name} ({sectionLabel(m.section)})
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Tanggal Pinjam">
            <Input
              type="date"
              data-testid="input-tgl-pinjam-aset"
              value={form.tanggalPinjam ?? ''}
              disabled={!form.pemegangId}
              onChange={(e) => setForm({ ...form, tanggalPinjam: e.target.value })}
            />
          </Field>
          <Field label="Target Kembali" hint="opsional">
            <Input
              type="date"
              data-testid="input-target-kembali-aset"
              value={form.targetKembali ?? ''}
              disabled={!form.pemegangId}
              onChange={(e) => setForm({ ...form, targetKembali: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-3">
            <Field label="Kelengkapan Diserahkan (tercantum di Berita Acara & HP Anggota)">
              <Input
                data-testid="input-kelengkapan-aset"
                value={form.kelengkapanPinjam ?? ''}
                onChange={(e) => setForm({ ...form, kelengkapanPinjam: e.target.value })}
                placeholder="Mis. Hardcase asli, mouthpiece Bach 3C, kain lap, valve oil"
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Bagian Riwayat Servis & Perawatan */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <p className="mb-2 text-xs font-semibold text-slate-200">
          Riwayat Perawatan &amp; Perbaikan ({form.riwayatServis?.length ?? 0})
        </p>
        <div className="grid gap-2 sm:grid-cols-4">
          <Input
            type="date"
            data-testid="input-tgl-servis"
            value={servisTgl}
            onChange={(e) => setServisTgl(e.target.value)}
            className="text-xs"
          />
          <Input
            data-testid="input-jenis-servis"
            value={servisJenis}
            onChange={(e) => setServisJenis(e.target.value)}
            placeholder="Tindakan (mis. Ganti head / Servis valve)"
            className="text-xs sm:col-span-2"
          />
          <Input
            type="number"
            min={0}
            data-testid="input-biaya-servis"
            value={servisBiaya}
            onChange={(e) => setServisBiaya(e.target.value)}
            placeholder="Biaya Rp (opsional)"
            className="text-xs"
          />
          <Input
            data-testid="input-pelaksana-servis"
            value={servisPelaksana}
            onChange={(e) => setServisPelaksana(e.target.value)}
            placeholder="Teknisi / Bengkel"
            className="text-xs sm:col-span-2"
          />
          <Select
            data-testid="pilih-kondisi-setelah-servis"
            value={servisKondisiBaru}
            onChange={(e) => setServisKondisiBaru(e.target.value as KondisiInventaris)}
            className="text-xs"
          >
            {DAFTAR_KONDISI_INVENTARIS.map((kd) => (
              <option key={kd} value={kd}>
                Setelahnya: {LABEL_KONDISI_INVENTARIS[kd]}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="ghost"
            data-testid="tambah-catatan-servis"
            disabled={!servisJenis.trim()}
            onClick={tambahCatatanServis}
          >
            + Catat Servis
          </Button>
        </div>

        {(form.riwayatServis?.length ?? 0) > 0 && (
          <ul className="mt-2.5 max-h-36 space-y-1 overflow-y-auto" data-testid="daftar-riwayat-servis">
            {form.riwayatServis.map((sv) => (
              <li
                key={sv.id}
                className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-xs"
              >
                <div>
                  <span className="font-mono text-[11px] text-slate-400">{sv.tanggal}</span> ·{' '}
                  <b className="text-slate-200">{sv.jenis}</b>
                  {sv.pelaksana ? <span className="text-slate-400"> ({sv.pelaksana})</span> : null}
                  {typeof sv.biaya === 'number' && sv.biaya > 0 ? (
                    <span className="text-emerald-300">
                      {' '}
                      · Rp{sv.biaya.toLocaleString('id-ID')}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      riwayatServis: form.riwayatServis.filter((x) => x.id !== sv.id),
                    })
                  }
                  className="text-[11px] text-rose-400 hover:underline"
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Field label="Catatan Internal Gudang" hint="tidak dibagikan ke anggota">
        <Textarea
          value={form.catatan ?? ''}
          onChange={(e) => setForm({ ...form, catatan: e.target.value })}
          placeholder="Catatan kondisi penyok ringan, nomor gembok loker, dsb."
          className="min-h-[60px]"
        />
      </Field>
    </Modal>
  )
}

/* ========================================================================== */
/*  2. UKURAN & DISTRIBUSI SERAGAM (UNIFORM FITTING & CEKLIS KEMBALI/CUCI)    */
/* ========================================================================== */

export function PanelSeragamFitting({
  members,
  namaTim,
}: {
  members: Member[]
  namaTim: string
}) {
  const toast = useToast()
  const [filterSeksi, setFilterSeksi] = useState<string>('semua')
  const [filterStatus, setFilterStatus] = useState<string>('semua')
  const [anggotaFitting, setAnggotaFitting] = useState<Member | null>(null)
  const [pratinjauOpen, setPratinjauOpen] = useState(false)

  const anggotaAktif = useMemo(
    () =>
      [...members]
        .filter((m) => m.active === 1)
        .sort((a, b) => a.section.localeCompare(b.section) || a.code.localeCompare(b.code)),
    [members],
  )

  const ringkas = useMemo(() => ringkasSeragamTim(anggotaAktif), [anggotaAktif])

  const daftarTampil = useMemo(
    () =>
      anggotaAktif
        .filter((m) => (filterSeksi === 'semua' ? true : m.section === filterSeksi))
        .filter((m) => {
          if (filterStatus === 'semua') return true
          const st = m.ukuranSeragam?.statusPinjam ?? 'belum'
          if (filterStatus === 'belum_kembali') return st === 'dipinjam'
          if (filterStatus === 'belum_cuci') return st === 'dipinjam' || (st === 'dikembalikan' && m.ukuranSeragam?.sudahDicuci !== 1)
          return st === filterStatus
        }),
    [anggotaAktif, filterSeksi, filterStatus],
  )

  async function ubahStatusCepat(m: Member, statusBaru: StatusPinjamSeragam) {
    const lama = m.ukuranSeragam ?? {}
    const tgl = hariIniIso()
    const ukuranBaru: ProfilUkuranSeragam = {
      ...lama,
      statusPinjam: statusBaru,
      tanggalAmbil: statusBaru === 'dipinjam' ? lama.tanggalAmbil || tgl : lama.tanggalAmbil,
      tanggalKembali:
        statusBaru === 'dikembalikan' || statusBaru === 'dicuci'
          ? lama.tanggalKembali || tgl
          : statusBaru === 'dipinjam'
            ? undefined
            : lama.tanggalKembali,
      sudahDicuci: statusBaru === 'dicuci' ? 1 : statusBaru === 'belum' || statusBaru === 'dipinjam' ? 0 : lama.sudahDicuci,
    }
    await db.members.update(m.id, { ukuranSeragam: ukuranBaru })
  }

  async function tandaiSemuaDipinjam() {
    const tgl = hariIniIso()
    await db.transaction('rw', db.members, async () => {
      for (const m of daftarTampil) {
        const lama = m.ukuranSeragam ?? {}
        await db.members.update(m.id, {
          ukuranSeragam: {
            ...lama,
            statusPinjam: 'dipinjam',
            tanggalAmbil: lama.tanggalAmbil || tgl,
            tanggalKembali: undefined,
            sudahDicuci: 0,
          },
        })
      }
    })
    toast.push(`${daftarTampil.length} anggota ditandai sedang meminjam seragam`)
  }

  const htmlSeragam = useMemo(
    () =>
      pratinjauOpen
        ? bangunHtmlDistribusiSeragam({
            namaTim,
            members: anggotaAktif,
            labelSeksi: sectionLabel,
          })
        : '',
    [pratinjauOpen, namaTim, anggotaAktif],
  )

  return (
    <div data-testid="panel-seragam-fitting" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3">
          <div className="text-lg font-bold tabular-nums text-slate-100" data-testid="srg-sudah-fitting">
            {ringkas.sudahFitting}/{ringkas.totalAnggotaAktif}
          </div>
          <div className="text-[11px] text-slate-400">Anggota sudah ukur fitting</div>
        </Card>
        <Card className="p-3">
          <div
            className={cx(
              'text-lg font-bold tabular-nums',
              ringkas.sedangDipinjam > 0 ? 'text-amber-300' : 'text-slate-200',
            )}
            data-testid="srg-dipinjam"
          >
            {ringkas.sedangDipinjam}
          </div>
          <div className="text-[11px] text-slate-400">Stel sedang dipinjam (belum kembali)</div>
        </Card>
        <Card className="p-3">
          <div className="text-lg font-bold tabular-nums text-sky-300">
            {ringkas.sudahKembaliBelumCuci}
          </div>
          <div className="text-[11px] text-slate-400">Sudah kembali (antre cuci)</div>
        </Card>
        <Card className="p-3">
          <div className="text-lg font-bold tabular-nums text-emerald-300" data-testid="srg-dicuci">
            {ringkas.sudahDicuci}
          </div>
          <div className="text-[11px] text-slate-400">Kembali &amp; selesai dicuci</div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              data-testid="ekspor-csv-seragam"
              onClick={() => {
                downloadFile(
                  `ukuran-seragam-${slugify(namaTim)}.csv`,
                  eksporCsvUkuranSeragam(anggotaAktif, sectionLabel),
                  'text/csv',
                )
                toast.push('CSV ukuran seragam diunduh (siap dikirim ke penjahit)')
              }}
            >
              <IconDownload size={14} /> CSV Penjahit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              data-testid="bagikan-massal-seragam"
              onClick={() => void tandaiSemuaDipinjam()}
              disabled={daftarTampil.length === 0}
            >
              Tandai Semua Dipinjam
            </Button>
            <Button
              size="sm"
              variant="primary"
              data-testid="pratinjau-cetak-seragam"
              onClick={() => setPratinjauOpen(true)}
            >
              <IconPrinter size={14} /> Cetak Lembar Seragam
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              data-testid="filter-seksi-seragam"
              value={filterSeksi}
              onChange={(e) => setFilterSeksi(e.target.value)}
              className="text-xs"
            >
              <option value="semua">Semua Seksi</option>
              {visibleSections().map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Select
              data-testid="filter-status-seragam"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs"
            >
              <option value="semua">Semua Status Kembali</option>
              <option value="belum_kembali">Belum Kembali (Sedang Dipinjam)</option>
              <option value="belum_cuci">Belum Dicuci</option>
              <option value="dicuci">Sudah Kembali &amp; Dicuci</option>
            </Select>
          </div>
        </div>
      </Card>

      {daftarTampil.length === 0 ? (
        <EmptyState
          title="Tidak ada anggota pada saringan ini"
          desc="Tambahkan anggota aktif terlebih dahulu atau ubah saringan status seragam."
        />
      ) : (
        <div className="space-y-2" data-testid="daftar-fitting-seragam">
          {daftarTampil.map((m) => {
            const u = m.ukuranSeragam
            const st = u?.statusPinjam ?? 'belum'
            return (
              <Card key={m.id} data-testid={`baris-seragam-${m.code}`} className="p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-emerald-300">{m.code}</span>
                      <span className="text-sm font-semibold text-slate-100">{namaTampil(m)}</span>
                      <span className="text-xs text-slate-400">
                        · {sectionLabel(m.section)} ({m.instrument || '—'})
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">
                      Sepatu: <b>{u?.sepatu || '—'}</b> · Jaket: <b>{u?.jaketTunic || '—'}</b> · Bibber:{' '}
                      <b>{u?.bibber || '—'}</b> · Shako: <b>{u?.shakoTopi || '—'}</b>
                      {u?.kostumGuard ? (
                        <>
                          {' '}
                          · Guard: <b>{u.kostumGuard}</b>
                        </>
                      ) : null}
                      {u?.nomorSeriSeragam ? (
                        <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-amber-200">
                          Seri: {u.nomorSeriSeragam}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  {/* Pil Ceklis Pengembalian & Cuci 1-Ketuk + Tombol Ukur */}
                  <div className="flex flex-wrap items-center gap-1">
                    {DAFTAR_STATUS_SERAGAM.map((opsiSt) => {
                      const aktif = st === opsiSt
                      const labelPendek: Record<StatusPinjamSeragam, string> = {
                        belum: 'Belum',
                        dipinjam: 'Dipinjam',
                        dikembalikan: 'Kembali',
                        dicuci: 'Dicuci ✓',
                      }
                      return (
                        <button
                          key={opsiSt}
                          type="button"
                          data-testid={`status-seragam-${m.code}-${opsiSt}`}
                          onClick={() => void ubahStatusCepat(m, opsiSt)}
                          className={cx(
                            'rounded-md border px-2 py-1 text-[11px] font-medium transition',
                            aktif
                              ? opsiSt === 'dipinjam'
                                ? 'border-amber-500/60 bg-amber-500/20 text-amber-200'
                                : opsiSt === 'dicuci'
                                  ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200'
                                  : opsiSt === 'dikembalikan'
                                    ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                                    : 'border-slate-600 bg-slate-800 text-slate-200'
                              : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700',
                          )}
                        >
                          {labelPendek[opsiSt]}
                        </button>
                      )
                    })}
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`ukur-seragam-${m.code}`}
                      onClick={() => setAnggotaFitting(m)}
                    >
                      Ukur / Seri
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal Ukur Fitting & Nomor Seri Seragam */}
      <ModalFittingAnggota
        member={anggotaFitting}
        onClose={() => setAnggotaFitting(null)}
      />

      {/* Modal Pratinjau Cetak Lembar Seragam */}
      <Modal
        open={pratinjauOpen}
        onClose={() => setPratinjauOpen(false)}
        title="Pratinjau Daftar Ukuran Fitting & Distribusi Seragam (A4)"
        testId="modal-pratinjau-seragam"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setPratinjauOpen(false)}>
              Tutup
            </Button>
            <Button
              variant="ghost"
              data-testid="unduh-html-seragam"
              onClick={() => {
                downloadHtmlFile(htmlSeragam, `distribusi-seragam-${slugify(namaTim)}.html`)
                toast.push('Lembar HTML seragam diunduh')
              }}
            >
              <IconDownload size={14} /> Unduh HTML
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!printHtml(htmlSeragam)) {
                  toast.push('Jendela cetak diblokir — gunakan tombol Unduh HTML', 'err')
                }
              }}
            >
              <IconPrinter size={14} /> Cetak / PDF
            </Button>
          </>
        }
      >
        <iframe
          data-testid="iframe-pratinjau-seragam"
          title="Pratinjau Cetak Seragam"
          srcDoc={htmlSeragam}
          className="h-[68vh] w-full rounded-lg border border-slate-700 bg-white"
        />
      </Modal>
    </div>
  )
}

function ModalFittingAnggota({
  member,
  onClose,
}: {
  member: Member | null
  onClose: () => void
}) {
  const toast = useToast()
  const [u, setU] = useState<ProfilUkuranSeragam>({})

  useEffect(() => {
    setU(member?.ukuranSeragam ? { ...member.ukuranSeragam } : {})
  }, [member])

  if (!member) return null

  async function simpan() {
    if (!member) return
    await db.members.update(member.id, {
      ukuranSeragam: {
        ...u,
        sepatu: u.sepatu?.trim() || undefined,
        jaketTunic: u.jaketTunic?.trim() || undefined,
        bibber: u.bibber?.trim() || undefined,
        shakoTopi: u.shakoTopi?.trim() || undefined,
        sarungTangan: u.sarungTangan?.trim() || undefined,
        kostumGuard: u.kostumGuard?.trim() || undefined,
        nomorSeriSeragam: u.nomorSeriSeragam?.trim() || undefined,
        nomorShako: u.nomorShako?.trim() || undefined,
        catatanFitting: u.catatanFitting?.trim() || undefined,
      },
    })
    toast.push(`Ukuran & seragam ${member.name} disimpan`)
    onClose()
  }

  return (
    <Modal
      open={!!member}
      onClose={onClose}
      title={`Ukuran Fitting & Seragam — ${member.code} · ${member.name}`}
      testId="modal-fitting-seragam"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" data-testid="simpan-fitting-seragam" onClick={() => void simpan()}>
            Simpan Ukuran
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Ukuran Sepatu Baris">
          <Input
            data-testid="input-fitting-sepatu"
            value={u.sepatu ?? ''}
            onChange={(e) => setU({ ...u, sepatu: e.target.value })}
            placeholder="Mis. 41"
          />
        </Field>
        <Field label="Ukuran Jaket / Tunic">
          <Input
            data-testid="input-fitting-jaket"
            value={u.jaketTunic ?? ''}
            onChange={(e) => setU({ ...u, jaketTunic: e.target.value })}
            placeholder="Mis. L"
          />
        </Field>
        <Field label="Lingkar Dada (cm)">
          <Input
            type="number"
            min={40}
            max={180}
            value={u.lingkarDadaCm ?? ''}
            onChange={(e) =>
              setU({ ...u, lingkarDadaCm: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="Mis. 96"
          />
        </Field>
        <Field label="Ukuran Bibber / Celana">
          <Input
            data-testid="input-fitting-bibber"
            value={u.bibber ?? ''}
            onChange={(e) => setU({ ...u, bibber: e.target.value })}
            placeholder="Mis. L / 32"
          />
        </Field>
        <Field label="Panjang Celana (cm)">
          <Input
            type="number"
            min={50}
            max={140}
            value={u.panjangCelanaCm ?? ''}
            onChange={(e) =>
              setU({ ...u, panjangCelanaCm: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="Mis. 98"
          />
        </Field>
        <Field label="Ukuran Shako / Topi">
          <Input
            data-testid="input-fitting-shako"
            value={u.shakoTopi ?? ''}
            onChange={(e) => setU({ ...u, shakoTopi: e.target.value })}
            placeholder="Mis. 57 cm / M"
          />
        </Field>
        <Field label="Sarung Tangan">
          <Input
            value={u.sarungTangan ?? ''}
            onChange={(e) => setU({ ...u, sarungTangan: e.target.value })}
            placeholder="Mis. M"
          />
        </Field>
        <Field label="Kostum Color Guard" hint="khusus seksi Guard">
          <Input
            value={u.kostumGuard ?? ''}
            onChange={(e) => setU({ ...u, kostumGuard: e.target.value })}
            placeholder="Mis. Custom M"
          />
        </Field>
        <Field label="Status Peminjaman">
          <Select
            data-testid="pilih-status-fitting"
            value={u.statusPinjam ?? 'belum'}
            onChange={(e) => setU({ ...u, statusPinjam: e.target.value as StatusPinjamSeragam })}
          >
            {DAFTAR_STATUS_SERAGAM.map((st) => (
              <option key={st} value={st}>
                {LABEL_STATUS_SERAGAM[st]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="No. Seri Seragam Pinjaman">
          <Input
            data-testid="input-seri-seragam"
            value={u.nomorSeriSeragam ?? ''}
            onChange={(e) => setU({ ...u, nomorSeriSeragam: e.target.value })}
            placeholder="Mis. SRG-014"
          />
        </Field>
        <Field label="No. Seri Shako / Plume">
          <Input
            value={u.nomorShako ?? ''}
            onChange={(e) => setU({ ...u, nomorShako: e.target.value })}
            placeholder="Mis. SHK-014"
          />
        </Field>
        <Field label="Catatan Jahit / Kelim">
          <Input
            value={u.catatanFitting ?? ''}
            onChange={(e) => setU({ ...u, catatanFitting: e.target.value })}
            placeholder="Mis. Kelim bawah celana +3 cm"
          />
        </Field>
      </div>
    </Modal>
  )
}
