import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type {
  GolonganDarah,
  KartuMedisAnggota,
  KopSuratUnit,
  Member,
  TeamSettings,
} from '../../db/types'
import {
  bukaMedisTerenkripsi,
  eksporMedisTerenkripsi,
  evaluasiSiagaMedis,
  kelompokkanPesertaDispensasi,
} from '../../lib/administrasiUnit'
import {
  bangunHtmlLembarMedisDarurat,
  bangunHtmlSuratDispensasi,
} from '../../lib/administrasiUnitCetak'
import { downloadHtmlFile, printHtml } from '../../lib/print'
import { cx, downloadFile, slugify, todayISO } from '../../lib/utils'
import { IconDownload, IconPrinter, IconUpload } from '../Icons'
import { Button, Card, Field, Input, Modal, Select, useToast } from '../ui'

const DAFTAR_GOL_DARAH: GolonganDarah[] = [
  '-',
  'A',
  'B',
  'AB',
  'O',
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
]

export function PanelDispensasiMedis({
  members,
  settings,
}: {
  members: Member[]
  settings?: TeamSettings
}) {
  const [subTab, setSubTab] = useState<'dispensasi' | 'medis'>('dispensasi')

  return (
    <div className="space-y-4" data-testid="panel-dispensasi-medis">
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/70 p-1"
        data-testid="subtab-administrasi"
      >
        <button
          type="button"
          data-testid="subtab-dispensasi"
          onClick={() => setSubTab('dispensasi')}
          className={cx(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            subTab === 'dispensasi'
              ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200',
          )}
        >
          Generator Surat Izin / Dispensasi Resmi (A4)
        </button>
        <button
          type="button"
          data-testid="subtab-medis"
          onClick={() => setSubTab('medis')}
          className={cx(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            subTab === 'medis'
              ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200',
          )}
        >
          Kartu Medis &amp; Kontak Darurat (Khusus Staf)
        </button>
      </div>

      {subTab === 'dispensasi' ? (
        <BagianSuratDispensasi members={members} settings={settings} />
      ) : (
        <BagianKartuMedis members={members} namaTim={settings?.teamName || 'Unit Marching Band'} />
      )}
    </div>
  )
}

function BagianSuratDispensasi({
  members,
  settings,
}: {
  members: Member[]
  settings?: TeamSettings
}) {
  const toast = useToast()
  const anggotaAktif = useMemo(() => members.filter((m) => m.active !== 0), [members])
  const [terpilih, setTerpilih] = useState<Set<string>>(() => new Set(anggotaAktif.map((m) => m.id)))

  const [perihal, setPerihal] = useState('Permohonan Izin / Dispensasi Pemusatan Latihan (TC) & Kejuaraan')
  const [namaKegiatan, setNamaKegiatan] = useState('Pemusatan Latihan (Training Camp) & Kejuaraan Marching Band')
  const [tanggalMulai, setTanggalMulai] = useState(todayISO())
  const [tanggalSelesai, setTanggalSelesai] = useState(todayISO())
  const [waktuKegiatan, setWaktuKegiatan] = useState('07.30 – 17.00 WIB')
  const [lokasiKegiatan, setLokasiKegiatan] = useState('Stadion / Arena Latihan Utama')
  const [nomorUrutAwal, setNomorUrutAwal] = useState('1')

  const [bukaKop, setBukaKop] = useState(false)
  const [kopDraf, setKopDraf] = useState<KopSuratUnit>(settings?.kopSurat ?? {})
  const [pratinjauOpen, setPratinjauOpen] = useState(false)

  const pesertaTerpilih = useMemo(
    () => anggotaAktif.filter((m) => terpilih.has(m.id)),
    [anggotaAktif, terpilih],
  )
  const kelompokInstansi = useMemo(
    () => kelompokkanPesertaDispensasi(pesertaTerpilih),
    [pesertaTerpilih],
  )

  async function simpanKopUnit() {
    if (!settings) return
    await db.settings.put({ ...settings, kopSurat: kopDraf })
    setBukaKop(false)
    toast.push('Kop surat & penandatangan resmi unit tersimpan')
  }

  async function ubahDataSekolahAnggota(id: string, ubah: Partial<Pick<Member, 'instansiAsal' | 'kelasJurusan' | 'nomorInduk'>>) {
    await db.members.update(id, ubah)
  }

  function susunHtmlSurat(): string {
    return bangunHtmlSuratDispensasi({
      namaTim: settings?.teamName || 'Unit Marching Band',
      kota: settings?.city,
      namaPelatih: settings?.coachName,
      logoDataUrl: settings?.logo,
      kop: settings?.kopSurat ?? kopDraf,
      perihal,
      namaKegiatan,
      tanggalMulai,
      tanggalSelesai,
      waktuKegiatan,
      lokasiKegiatan,
      nomorUrutAwal: Number(nomorUrutAwal) || 1,
      peserta: pesertaTerpilih,
    })
  }

  function cetakSurat() {
    const html = susunHtmlSurat()
    if (!printHtml(html)) {
      downloadHtmlFile(html, `surat-dispensasi-${slugify(namaKegiatan)}.html`)
      toast.push('Pop-up diblokir — berkas HTML A4 diunduh')
    }
  }

  return (
    <div className="space-y-4" data-testid="bagian-surat-dispensasi">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Generator Surat Izin / Dispensasi Kolektif (Otomatis per Sekolah / Fakultas)
            </h2>
            <p className="text-xs text-slate-400">
              Peserta otomatis dikelompokkan per asal sekolah/fakultas/instansi menjadi halaman surat resmi A4 terpisah lengkap kop &amp; daftar lampiran.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="soft" data-testid="atur-kop-surat" onClick={() => {
              setKopDraf(settings?.kopSurat ?? {})
              setBukaKop(true)
            }}>
              Atur Kop Surat &amp; Pembina
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={pesertaTerpilih.length === 0}
              data-testid="pratinjau-surat-dispensasi"
              onClick={() => setPratinjauOpen(true)}
            >
              <IconPrinter size={14} /> Pratinjau &amp; Cetak A4 ({kelompokInstansi.length} Surat)
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nama Kegiatan / Kejuaraan">
            <Input
              data-testid="input-kegiatan-dispensasi"
              value={namaKegiatan}
              onChange={(e) => setNamaKegiatan(e.target.value)}
            />
          </Field>
          <Field label="Perihal Surat">
            <Input value={perihal} onChange={(e) => setPerihal(e.target.value)} />
          </Field>
          <Field label="Lokasi / Tempat">
            <Input value={lokasiKegiatan} onChange={(e) => setLokasiKegiatan(e.target.value)} />
          </Field>
          <Field label="Tanggal Mulai">
            <Input type="date" value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} />
          </Field>
          <Field label="Tanggal Selesai">
            <Input type="date" value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Jam Kegiatan">
              <Input value={waktuKegiatan} onChange={(e) => setWaktuKegiatan(e.target.value)} />
            </Field>
            <Field label="No. Urut Awal">
              <Input
                type="number"
                min={1}
                value={nomorUrutAwal}
                onChange={(e) => setNomorUrutAwal(e.target.value)}
              />
            </Field>
          </div>
        </div>

        {/* Ringkasan pengelompokan otomatis per instansi tujuan */}
        <div
          className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-xs"
          data-testid="ringkasan-instansi-dispensasi"
        >
          <span className="font-semibold text-slate-300">Tujuan Surat Terbentuk:</span>
          {kelompokInstansi.map((k) => (
            <span
              key={k.kunci}
              className="rounded-full border border-emerald-700/40 bg-emerald-950/40 px-2.5 py-0.5 text-[11px] text-emerald-200"
            >
              {k.namaInstansiTujuan} ({k.peserta.length} orang)
            </span>
          ))}
        </div>
      </Card>

      {/* Tabel pemilihan peserta & pengisian cepat asal sekolah/fakultas/NIS */}
      <Card className="overflow-x-auto p-0">
        <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2.5 text-xs">
          <span className="font-semibold text-slate-200">
            Peserta Dispensasi ({pesertaTerpilih.length} / {anggotaAktif.length} anggota aktif)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTerpilih(new Set(anggotaAktif.map((m) => m.id)))}
              className="text-emerald-400 hover:underline"
            >
              Pilih Semua
            </button>
            <button
              type="button"
              onClick={() => setTerpilih(new Set())}
              className="text-slate-400 hover:underline"
            >
              Kosongkan
            </button>
          </div>
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/70 text-[11px] uppercase text-slate-400">
              <th className="w-10 px-3 py-2">Ikut</th>
              <th className="px-3 py-2">Nama Anggota</th>
              <th className="px-3 py-2">Asal Sekolah / Fakultas / Instansi</th>
              <th className="px-3 py-2">Kelas / Jurusan</th>
              <th className="px-3 py-2">NIS / NIM / ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {anggotaAktif.map((m) => {
              const centang = terpilih.has(m.id)
              return (
                <tr key={m.id}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={centang}
                      onChange={() => {
                        const s = new Set(terpilih)
                        if (s.has(m.id)) s.delete(m.id)
                        else s.add(m.id)
                        setTerpilih(s)
                      }}
                      className="h-4 w-4 accent-emerald-500"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-100">
                    {m.name} <span className="text-slate-500">({m.code})</span>
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      placeholder="Mis. SMA Negeri 3 / Fak. Teknik"
                      data-testid={`input-instansi-${m.id}`}
                      value={m.instansiAsal ?? ''}
                      onChange={(e) =>
                        void ubahDataSekolahAnggota(m.id, { instansiAsal: e.target.value || undefined })
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      placeholder="Mis. XI MIPA 2"
                      value={m.kelasJurusan ?? ''}
                      onChange={(e) =>
                        void ubahDataSekolahAnggota(m.id, { kelasJurusan: e.target.value || undefined })
                      }
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      placeholder="NIS / NIM"
                      value={m.nomorInduk ?? ''}
                      onChange={(e) =>
                        void ubahDataSekolahAnggota(m.id, { nomorInduk: e.target.value || undefined })
                      }
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      {/* Modal Kop Surat */}
      <Modal
        open={bukaKop}
        onClose={() => setBukaKop(false)}
        title="Pengaturan Kop Surat & Penandatangan Resmi Unit"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setBukaKop(false)}>
              Batal
            </Button>
            <Button variant="primary" data-testid="simpan-kop-surat" onClick={() => void simpanKopUnit()}>
              Simpan Kop Surat
            </Button>
          </div>
        }
      >
        <div className="space-y-2.5 text-xs">
          <Field label="Nama Instansi Induk / Yayasan / Universitas">
            <Input
              placeholder="Mis. UNIVERSITAS GADJAH MADA / SMA NEGERI 1"
              value={kopDraf.namaInstansiInduk ?? ''}
              onChange={(e) => setKopDraf({ ...kopDraf, namaInstansiInduk: e.target.value || undefined })}
            />
          </Field>
          <Field label="Alamat Sekretariat">
            <Input
              placeholder="Jl. Pendidikan No. 10, Telp. (0274) ..."
              value={kopDraf.alamatSekretariat ?? ''}
              onChange={(e) => setKopDraf({ ...kopDraf, alamatSekretariat: e.target.value || undefined })}
            />
          </Field>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Nama Pembina / Penanggung Jawab">
              <Input
                value={kopDraf.namaPembina ?? ''}
                onChange={(e) => setKopDraf({ ...kopDraf, namaPembina: e.target.value || undefined })}
              />
            </Field>
            <Field label="Jabatan Pembina">
              <Input
                placeholder="Mis. Wakil Kepala Sekolah Kesiswaan"
                value={kopDraf.jabatanPembina ?? ''}
                onChange={(e) => setKopDraf({ ...kopDraf, jabatanPembina: e.target.value || undefined })}
              />
            </Field>
            <Field label="NIP / NIDN Pembina (Opsional)">
              <Input
                value={kopDraf.nipPembina ?? ''}
                onChange={(e) => setKopDraf({ ...kopDraf, nipPembina: e.target.value || undefined })}
              />
            </Field>
            <Field label="Nama Ketua Unit / Manajer">
              <Input
                value={kopDraf.namaKetuaUnit ?? ''}
                onChange={(e) => setKopDraf({ ...kopDraf, namaKetuaUnit: e.target.value || undefined })}
              />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Modal Pratinjau Cetak Surat Dispensasi A4 */}
      <Modal
        open={pratinjauOpen}
        onClose={() => setPratinjauOpen(false)}
        title={`Pratinjau Surat Dispensasi Resmi (${kelompokInstansi.length} Instansi Tujuan)`}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPratinjauOpen(false)}>
              Tutup
            </Button>
            <Button
              variant="soft"
              data-testid="unduh-surat-dispensasi"
              onClick={() => downloadHtmlFile(susunHtmlSurat(), `surat-dispensasi-${slugify(namaKegiatan)}.html`)}
            >
              <IconDownload size={14} /> Unduh HTML
            </Button>
            <Button variant="primary" onClick={cetakSurat}>
              <IconPrinter size={14} /> Cetak A4 Sekarang
            </Button>
          </div>
        }
      >
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-white">
          <iframe
            title="Pratinjau Surat Dispensasi A4"
            data-testid="iframe-pratinjau-dispensasi"
            srcDoc={susunHtmlSurat()}
            className="h-[68vh] w-full border-0"
          />
        </div>
      </Modal>
    </div>
  )
}

function BagianKartuMedis({
  members,
  namaTim,
}: {
  members: Member[]
  namaTim: string
}) {
  const toast = useToast()
  const daftarMedis = useLiveQuery(() => db.medisAnggota.toArray(), [], [])
  const petaMedis = useMemo(
    () => new Map((daftarMedis ?? []).map((k) => [k.memberId, k])),
    [daftarMedis],
  )

  const [cari, setCari] = useState('')
  const [filterSiaga, setFilterSiaga] = useState<'semua' | 'perhatian' | 'belum'>('semua')
  const [suntingMedis, setSuntingMedis] = useState<{ member: Member; kartu: KartuMedisAnggota } | null>(null)
  const [modalSandi, setModalSandi] = useState<{ mode: 'ekspor' | 'impor'; berkasTeks?: string } | null>(null)
  const [sandiInput, setSandiInput] = useState('')
  const [pratinjauOpen, setPratinjauOpen] = useState(false)
  const fileMedisRef = useRef<HTMLInputElement>(null)

  const barisAnggota = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return members
      .filter((m) => m.active !== 0)
      .filter((m) => (!q ? true : m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q)))
      .map((m) => {
        const kartu = petaMedis.get(m.id)
        const siaga = evaluasiSiagaMedis(kartu)
        return { m, kartu, siaga }
      })
      .filter((x) => {
        if (filterSiaga === 'perhatian') return x.siaga.tingkatSiaga === 'perhatian_khusus'
        if (filterSiaga === 'belum') return !x.siaga.kontakDaruratLengkap
        return true
      })
  }, [members, petaMedis, cari, filterSiaga])

  function bukaEditorMedis(m: Member) {
    const ada = petaMedis.get(m.id)
    setSuntingMedis({
      member: m,
      kartu: ada ?? {
        id: m.id,
        memberId: m.id,
        golonganDarah: '-',
        kontakDaruratNama: '',
        kontakDaruratTelepon: '',
        updatedAt: Date.now(),
      },
    })
  }

  async function simpanKartuMedis() {
    if (!suntingMedis) return
    await db.medisAnggota.put({
      ...suntingMedis.kartu,
      id: suntingMedis.member.id,
      memberId: suntingMedis.member.id,
      updatedAt: Date.now(),
    })
    setSuntingMedis(null)
    toast.push(`Kartu medis ${suntingMedis.member.name} tersimpan`)
  }

  async function prosesEksporAtauImporSandi() {
    if (!modalSandi) return
    try {
      if (modalSandi.mode === 'ekspor') {
        const json = await eksporMedisTerenkripsi(daftarMedis ?? [], sandiInput, namaTim)
        downloadFile(
          `medis-terenkripsi-${slugify(namaTim)}-${todayISO()}.json`,
          json,
          'application/json',
        )
        toast.push('Arsip medis terenkripsi AES-256-GCM berhasil diunduh')
      } else if (modalSandi.berkasTeks) {
        const kartuMasuk = await bukaMedisTerenkripsi(modalSandi.berkasTeks, sandiInput)
        if (kartuMasuk.length > 0) {
          await db.medisAnggota.bulkPut(kartuMasuk)
        }
        toast.push(`${kartuMasuk.length} kartu medis berhasil didekripsi & dipulihkan`)
      }
      setModalSandi(null)
      setSandiInput('')
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal memproses enkripsi medis', 'err')
    }
  }

  function susunHtmlMedis(): string {
    return bangunHtmlLembarMedisDarurat({
      namaTim,
      anggota: members,
      petaMedis,
      hanyaPerhatianKhusus: filterSiaga === 'perhatian',
    })
  }

  return (
    <div className="space-y-4" data-testid="bagian-kartu-medis">
      <div className="rounded-xl border border-rose-800/50 bg-rose-950/30 px-3.5 py-2.5 text-xs text-rose-100">
        <strong>PAGAR PRIVASI KERAS (KHUSUS PELATIH &amp; TIM MEDIS):</strong> Data golongan darah, alergi, riwayat asma/cedera, dan nomor darurat wali disimpan luring di perangkat ini dan <strong>dijamin tidak pernah</strong> disertakan ke dalam Paket Anggota (<code>.dkp</code> / grup) maupun Situs Terbitan.
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Cari cepat nama / kode saat darurat…"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              className="w-60"
            />
            <Select
              aria-label="Saring status siaga medis"
              value={filterSiaga}
              onChange={(e) => setFilterSiaga(e.target.value as 'semua' | 'perhatian' | 'belum')}
            >
              <option value="semua">Semua Anggota Aktif</option>
              <option value="perhatian">Perhatian Khusus (Alergi / Asma / Obat)</option>
              <option value="belum">Kontak Darurat Belum Lengkap</option>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="soft"
              data-testid="ekspor-medis-sandi"
              onClick={() => {
                setSandiInput('')
                setModalSandi({ mode: 'ekspor' })
              }}
            >
              <IconDownload size={14} /> Ekspor Medis Bersandi (AES-256)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              data-testid="impor-medis-sandi"
              onClick={() => fileMedisRef.current?.click()}
            >
              <IconUpload size={14} /> Buka Arsip Bersandi
            </Button>
            <input
              ref={fileMedisRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.currentTarget.value = ''
                if (!f) return
                const teks = await f.text()
                setSandiInput('')
                setModalSandi({ mode: 'impor', berkasTeks: teks })
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              data-testid="pratinjau-cetak-medis"
              onClick={() => setPratinjauOpen(true)}
            >
              <IconPrinter size={14} /> Cetak Lembar Medis A4
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-xs" data-testid="tabel-kartu-medis">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase text-slate-400">
              <th className="px-3 py-2.5">Anggota</th>
              <th className="px-3 py-2.5 text-center">Gol. Darah</th>
              <th className="px-3 py-2.5">Alergi &amp; Riwayat Kesehatan</th>
              <th className="px-3 py-2.5">Obat Pribadi</th>
              <th className="px-3 py-2.5">Kontak Darurat Wali</th>
              <th className="px-3 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {barisAnggota.map(({ m, kartu, siaga }) => (
              <tr
                key={m.id}
                data-testid={`baris-medis-${m.id}`}
                className={siaga.tingkatSiaga === 'perhatian_khusus' ? 'bg-rose-950/20' : ''}
              >
                <td className="px-3 py-2.5 font-semibold text-slate-100">
                  {m.name} <span className="font-normal text-slate-400">({m.code})</span>
                </td>
                <td className="px-3 py-2.5 text-center font-bold text-slate-200">
                  {kartu?.golonganDarah || '-'}
                </td>
                <td className="px-3 py-2.5">
                  {kartu?.alergiObat && (
                    <div className="text-rose-300">
                      <strong>Alergi Obat:</strong> {kartu.alergiObat}
                    </div>
                  )}
                  {kartu?.alergiMakanan && (
                    <div className="text-amber-300">
                      <strong>Alergi Makanan:</strong> {kartu.alergiMakanan}
                    </div>
                  )}
                  {kartu?.riwayatMedis && (
                    <div className="text-slate-200">{kartu.riwayatMedis}</div>
                  )}
                  {!kartu?.alergiObat && !kartu?.alergiMakanan && !kartu?.riwayatMedis && (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-slate-300">{kartu?.obatPribadi || '—'}</td>
                <td className="px-3 py-2.5">
                  {kartu?.kontakDaruratNama ? (
                    <div>
                      <div className="font-medium text-slate-200">
                        {kartu.kontakDaruratNama}
                        {kartu.kontakDaruratHubungan ? ` (${kartu.kontakDaruratHubungan})` : ''}
                      </div>
                      <a
                        href={`tel:${kartu.kontakDaruratTelepon}`}
                        className="font-mono font-bold text-emerald-400 hover:underline"
                      >
                        {kartu.kontakDaruratTelepon}
                      </a>
                    </div>
                  ) : (
                    <span className="text-amber-400/90">Belum diisi</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid={`isi-medis-${m.id}`}
                    onClick={() => bukaEditorMedis(m)}
                  >
                    {kartu ? 'Edit Medis' : '+ Isi Medis'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Modal Editor Kartu Medis */}
      <Modal
        open={!!suntingMedis}
        onClose={() => setSuntingMedis(null)}
        title={suntingMedis ? `Kartu Medis & Darurat — ${suntingMedis.member.name}` : 'Kartu Medis'}
        wide
        testId="modal-kartu-medis"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSuntingMedis(null)}>
              Batal
            </Button>
            <Button
              variant="primary"
              data-testid="simpan-kartu-medis"
              onClick={() => void simpanKartuMedis()}
            >
              Simpan Kartu Medis
            </Button>
          </div>
        }
      >
        {suntingMedis && (
          <div className="space-y-3 text-xs">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Golongan Darah">
                <Select
                  data-testid="select-goldarah-medis"
                  value={suntingMedis.kartu.golonganDarah}
                  onChange={(e) =>
                    setSuntingMedis({
                      ...suntingMedis,
                      kartu: { ...suntingMedis.kartu, golonganDarah: e.target.value as GolonganDarah },
                    })
                  }
                >
                  {DAFTAR_GOL_DARAH.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Alergi Obat">
                <Input
                  placeholder="Mis. Amoxicillin / Tidak ada"
                  data-testid="input-alergi-obat"
                  value={suntingMedis.kartu.alergiObat ?? ''}
                  onChange={(e) =>
                    setSuntingMedis({
                      ...suntingMedis,
                      kartu: { ...suntingMedis.kartu, alergiObat: e.target.value || undefined },
                    })
                  }
                />
              </Field>
              <Field label="Alergi Makanan">
                <Input
                  placeholder="Mis. Udang / Kacang"
                  value={suntingMedis.kartu.alergiMakanan ?? ''}
                  onChange={(e) =>
                    setSuntingMedis({
                      ...suntingMedis,
                      kartu: { ...suntingMedis.kartu, alergiMakanan: e.target.value || undefined },
                    })
                  }
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Riwayat Asma / Cedera / Kondisi Khusus">
                <Input
                  placeholder="Mis. Asma ringan saat udara dingin"
                  data-testid="input-riwayat-medis"
                  value={suntingMedis.kartu.riwayatMedis ?? ''}
                  onChange={(e) =>
                    setSuntingMedis({
                      ...suntingMedis,
                      kartu: { ...suntingMedis.kartu, riwayatMedis: e.target.value || undefined },
                    })
                  }
                />
              </Field>
              <Field label="Obat Pribadi & Lokasi Penyimpanan">
                <Input
                  placeholder="Mis. Inhaler di kantong depan tas"
                  value={suntingMedis.kartu.obatPribadi ?? ''}
                  onChange={(e) =>
                    setSuntingMedis({
                      ...suntingMedis,
                      kartu: { ...suntingMedis.kartu, obatPribadi: e.target.value || undefined },
                    })
                  }
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nama Kontak Darurat (Orang Tua / Wali)">
                <Input
                  data-testid="input-wali-medis"
                  value={suntingMedis.kartu.kontakDaruratNama}
                  onChange={(e) =>
                    setSuntingMedis({
                      ...suntingMedis,
                      kartu: { ...suntingMedis.kartu, kontakDaruratNama: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Hubungan">
                <Input
                  placeholder="Ayah / Ibu / Wali"
                  value={suntingMedis.kartu.kontakDaruratHubungan ?? ''}
                  onChange={(e) =>
                    setSuntingMedis({
                      ...suntingMedis,
                      kartu: { ...suntingMedis.kartu, kontakDaruratHubungan: e.target.value || undefined },
                    })
                  }
                />
              </Field>
              <Field label="Nomor Telepon Darurat Aktif">
                <Input
                  data-testid="input-telp-wali-medis"
                  value={suntingMedis.kartu.kontakDaruratTelepon}
                  onChange={(e) =>
                    setSuntingMedis({
                      ...suntingMedis,
                      kartu: { ...suntingMedis.kartu, kontakDaruratTelepon: e.target.value },
                    })
                  }
                />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Kata Sandi AES-256-GCM */}
      <Modal
        open={!!modalSandi}
        onClose={() => setModalSandi(null)}
        title={
          modalSandi?.mode === 'ekspor'
            ? 'Ekspor Arsip Medis Terenkripsi (AES-256-GCM)'
            : 'Buka Arsip Medis Terenkripsi'
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalSandi(null)}>
              Batal
            </Button>
            <Button
              variant="primary"
              data-testid="konfirmasi-sandi-medis"
              onClick={() => void prosesEksporAtauImporSandi()}
            >
              {modalSandi?.mode === 'ekspor' ? 'Enkripsi & Unduh' : 'Dekripsi & Pulihkan'}
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-xs">
          <p className="text-slate-300">
            {modalSandi?.mode === 'ekspor'
              ? 'Buat kata sandi (minimal 4 karakter) untuk mengenkripsi seluruh kartu medis dengan standar PBKDF2 + AES-256-GCM sebelum dikirim ke koordinator medis.'
              : 'Masukkan kata sandi pembuka berkas arsip medis terenkripsi.'}
          </p>
          <Field label="Kata Sandi Medis">
            <Input
              type="password"
              data-testid="input-sandi-medis"
              value={sandiInput}
              onChange={(e) => setSandiInput(e.target.value)}
            />
          </Field>
        </div>
      </Modal>

      {/* Modal Pratinjau Cetak Lembar Medis */}
      <Modal
        open={pratinjauOpen}
        onClose={() => setPratinjauOpen(false)}
        title="Pratinjau Lembar Siaga Medis Darurat A4"
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPratinjauOpen(false)}>
              Tutup
            </Button>
            <Button
              variant="soft"
              onClick={() => downloadHtmlFile(susunHtmlMedis(), `siaga-medis-${slugify(namaTim)}.html`)}
            >
              <IconDownload size={14} /> Unduh HTML
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const html = susunHtmlMedis()
                if (!printHtml(html)) downloadHtmlFile(html, `siaga-medis-${slugify(namaTim)}.html`)
              }}
            >
              <IconPrinter size={14} /> Cetak A4
            </Button>
          </div>
        }
      >
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-white">
          <iframe
            title="Pratinjau Lembar Medis"
            data-testid="iframe-pratinjau-medis"
            srcDoc={susunHtmlMedis()}
            className="h-[65vh] w-full border-0"
          />
        </div>
      </Modal>
    </div>
  )
}
