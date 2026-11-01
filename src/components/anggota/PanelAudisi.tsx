import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type {
  CalonAudisi,
  Member,
  Section,
  SectionDef,
  StatusCalonAudisi,
} from '../../db/types'
import {
  LABEL_STATUS_AUDISI,
  hitungSkorAudisi,
  luluskanCalonKeAnggota,
  susunPeringkatAudisi,
} from '../../lib/administrasiUnit'
import { bangunHtmlRekapAudisi } from '../../lib/administrasiUnitCetak'
import { downloadHtmlFile, printHtml } from '../../lib/print'
import { cx, sectionLabel, slugify, uid, visibleSections } from '../../lib/utils'
import { IconDownload, IconPlus, IconPrinter, IconTrash } from '../Icons'
import { Button, Card, EmptyState, Field, Input, Modal, Select, useToast } from '../ui'

export function PanelAudisi({
  namaTim,
  members,
  sections,
}: {
  namaTim: string
  members: Member[]
  sections?: SectionDef[]
}) {
  const toast = useToast()
  const daftarCalon = useLiveQuery(() => db.audisi.toArray(), [], [])
  const daftarSeksi = useMemo(
    () => (sections?.length ? sections.filter((s) => !s.hidden) : visibleSections()),
    [sections],
  )

  const [saringSeksi, setSaringSeksi] = useState<Section | 'all'>('all')
  const [sunting, setSunting] = useState<CalonAudisi | null>(null)
  const [pratinjauOpen, setPratinjauOpen] = useState(false)

  const peringkat = useMemo(
    () => susunPeringkatAudisi(daftarCalon ?? [], { seksi: saringSeksi }),
    [daftarCalon, saringSeksi],
  )

  function buatCalonKosong(): CalonAudisi {
    const skrg = Date.now()
    const seksiAwal = daftarSeksi[0]?.id || 'brass'
    return {
      id: uid('aud_'),
      nama: '',
      minatSeksi1: seksiAwal,
      minatInstrumen1: '',
      tahunAngkatan: new Date().getFullYear(),
      status: 'terdaftar',
      createdAt: skrg,
      updatedAt: skrg,
    }
  }

  async function muatContohAudisi() {
    const skrg = Date.now()
    const thn = new Date().getFullYear()
    const contoh: CalonAudisi[] = [
      {
        id: uid('aud_'),
        nama: 'Raka Mahendra',
        panggilan: 'Raka',
        instansiAsal: 'SMA Negeri 3 Yogyakarta',
        kelasJurusan: 'X MIPA 1',
        nomorInduk: '261041',
        telepon: '08123450001',
        minatSeksi1: 'brass',
        minatInstrumen1: 'Trumpet',
        minatSeksi2: 'percussion',
        minatInstrumen2: 'Snare',
        tahunAngkatan: thn,
        nilai: { ritmik: 88, kepekaanNada: 91, posturLangkah: 84, koordinasiAlat: 87 },
        penguji: 'Kak Andra',
        catatanPenguji: 'Embouchure natural kuat dan cepat menangkap pola sinkopasi.',
        status: 'dinilai',
        createdAt: skrg - 300,
        updatedAt: skrg - 300,
      },
      {
        id: uid('aud_'),
        nama: 'Nadia Kusumawardani',
        panggilan: 'Nadia',
        instansiAsal: 'SMA Negeri 1 Yogyakarta',
        kelasJurusan: 'X IPS 2',
        nomorInduk: '262018',
        telepon: '08123450002',
        minatSeksi1: 'guard',
        minatInstrumen1: 'Flag',
        minatSeksi2: 'pit',
        minatInstrumen2: 'Marimba',
        tahunAngkatan: thn,
        nilai: { ritmik: 85, kepekaanNada: 80, posturLangkah: 92, koordinasiAlat: 90 },
        penguji: 'Kak Putri',
        catatanPenguji: 'Kelenturan gerak dan putaran drop-spin sangat rapi.',
        status: 'dinilai',
        createdAt: skrg - 200,
        updatedAt: skrg - 200,
      },
      {
        id: uid('aud_'),
        nama: 'Bagas Prasetyo',
        panggilan: 'Bagas',
        instansiAsal: 'SMA Negeri 3 Yogyakarta',
        kelasJurusan: 'X MIPA 4',
        nomorInduk: '261099',
        minatSeksi1: 'brass',
        minatInstrumen1: 'Baritone',
        tahunAngkatan: thn,
        nilai: { ritmik: 74, kepekaanNada: 70, posturLangkah: 78, koordinasiAlat: 72 },
        penguji: 'Kak Andra',
        catatanPenguji: 'Postur tegap, cocok untuk low brass.',
        status: 'dinilai',
        createdAt: skrg - 100,
        updatedAt: skrg - 100,
      },
    ]
    await db.audisi.bulkPut(contoh)
    toast.push('3 calon anggota contoh berhasil dimuat')
  }

  async function simpanCalon(c: CalonAudisi) {
    if (!c.nama.trim()) {
      toast.push('Nama calon wajib diisi', 'err')
      return
    }
    const statusOtomatis: StatusCalonAudisi =
      c.status === 'terdaftar' && c.nilai ? 'dinilai' : c.status
    await db.audisi.put({
      ...c,
      nama: c.nama.trim(),
      status: statusOtomatis,
      updatedAt: Date.now(),
    })
    setSunting(null)
    toast.push('Data calon audisi disimpan')
  }

  async function luluskanSatuKlik(calon: CalonAudisi) {
    const hasil = luluskanCalonKeAnggota(calon, members, {
      buatId: () => uid('m_'),
      buatToken: () => uid('t_'),
    })
    if (hasil.sudahAda) {
      toast.push(`${calon.nama} sudah terdaftar sebagai anggota aktif (${hasil.member.code})`, 'info')
      return
    }
    await db.transaction('rw', [db.members, db.audisi], async () => {
      await db.members.put(hasil.member)
      await db.audisi.put(hasil.calonDiperbarui)
    })
    toast.push(`${hasil.member.name} resmi diluluskan ke Anggota Aktif (${hasil.member.code})!`)
  }

  function susunHtmlCetak(): string {
    return bangunHtmlRekapAudisi({
      namaTim,
      daftarCalon: peringkat.map((p) => p.calon),
      labelSeksiFilter: saringSeksi === 'all' ? 'Semua Seksi' : sectionLabel(saringSeksi),
    })
  }

  function cetakRekap() {
    const html = susunHtmlCetak()
    if (!printHtml(html)) {
      downloadHtmlFile(html, `rekap-audisi-${slugify(namaTim)}.html`)
      toast.push('Pop-up diblokir — berkas HTML A4 diunduh')
    }
  }

  return (
    <div className="space-y-4" data-testid="panel-audisi-anggota">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Seleksi &amp; Audisi Anggota Baru (Open Recruitment)
            </h2>
            <p className="text-xs text-slate-400">
              Kelola pendaftar terpisah dari anggota aktif, nilai 4 aspek tes dasar, urutkan per peminatan seksi, lalu luluskan 1-klik ke roster aktif.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Saring peminatan seksi audisi"
              data-testid="filter-seksi-audisi"
              value={saringSeksi}
              onChange={(e) => setSaringSeksi(e.target.value as Section | 'all')}
            >
              <option value="all">Semua Peminatan ({daftarCalon?.length ?? 0})</option>
              {daftarSeksi.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            {(daftarCalon?.length ?? 0) > 0 && (
              <Button
                size="sm"
                variant="ghost"
                data-testid="pratinjau-cetak-audisi"
                onClick={() => setPratinjauOpen(true)}
              >
                <IconPrinter size={14} /> Cetak Rekap A4
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              data-testid="tambah-calon-audisi"
              onClick={() => setSunting(buatCalonKosong())}
            >
              <IconPlus size={14} /> Tambah Calon
            </Button>
          </div>
        </div>
      </Card>

      {peringkat.length === 0 ? (
        <EmptyState
          icon={<IconPlus size={30} />}
          title="Belum ada calon anggota pada tampilan ini"
          desc="Tambahkan pendaftar Open Recruitment untuk mencatat nilai tes ritmik, kepekaan nada, postur, dan koordinasi alat."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => setSunting(buatCalonKosong())}>
                <IconPlus size={15} /> Daftarkan Calon Baru
              </Button>
              <Button
                variant="soft"
                data-testid="muat-contoh-audisi"
                onClick={() => void muatContohAudisi()}
              >
                Muat 3 Calon Contoh
              </Button>
            </div>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-xs" data-testid="tabel-peringkat-audisi">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-3 py-2.5 text-center">#</th>
                <th className="px-3 py-2.5">Calon &amp; Instansi Asal</th>
                <th className="px-3 py-2.5">Minat 1 / Minat 2</th>
                <th className="px-3 py-2.5 text-right">Skor Tes (0–100)</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {peringkat.map(({ peringkat: no, calon, skor, pilihanKe }) => {
                const tertaut = calon.memberIdTertaut
                  ? members.find((m) => m.id === calon.memberIdTertaut)
                  : undefined
                return (
                  <tr key={calon.id} data-testid={`baris-audisi-${calon.id}`}>
                    <td className="px-3 py-2.5 text-center font-bold tabular-nums text-slate-300">
                      {no}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-100">
                        {calon.nama}
                        {calon.panggilan ? (
                          <span className="ml-1 font-normal text-slate-400">({calon.panggilan})</span>
                        ) : null}
                      </div>
                      {(calon.instansiAsal || calon.kelasJurusan) && (
                        <div className="text-[11px] text-slate-400">
                          {[calon.instansiAsal, calon.kelasJurusan].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      {calon.catatanPenguji && (
                        <div className="mt-0.5 text-[11px] italic text-slate-500">
                          “{calon.catatanPenguji}”
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-emerald-300">
                        1. {sectionLabel(calon.minatSeksi1)}
                        {calon.minatInstrumen1 ? ` · ${calon.minatInstrumen1}` : ''}
                      </div>
                      {calon.minatSeksi2 && (
                        <div className="text-[11px] text-slate-400">
                          2. {sectionLabel(calon.minatSeksi2)}
                          {calon.minatInstrumen2 ? ` · ${calon.minatInstrumen2}` : ''}
                        </div>
                      )}
                      {saringSeksi !== 'all' && (
                        <span className="mt-0.5 inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                          Pilihan ke-{pilihanKe}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {skor ? (
                        <>
                          <div className="text-sm font-extrabold text-slate-100">
                            {skor.rataRata.toFixed(1).replace('.', ',')}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            R:{skor.ritmik} · N:{skor.kepekaanNada} · P:{skor.posturLangkah} · A:{skor.koordinasiAlat}
                          </div>
                          <div className="text-[10px] text-emerald-400">{skor.predikat}</div>
                        </>
                      ) : (
                        <span className="text-slate-500">Belum dites</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cx(
                          'inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          calon.status === 'diterima'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : calon.status === 'dinilai'
                              ? 'bg-sky-500/20 text-sky-300'
                              : calon.status === 'cadangan'
                                ? 'bg-amber-500/20 text-amber-300'
                                : calon.status === 'ditolak'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-slate-800 text-slate-300',
                        )}
                      >
                        {LABEL_STATUS_AUDISI[calon.status]}
                      </span>
                      {tertaut && (
                        <div className="mt-1 text-[10px] font-semibold text-emerald-400">
                          ✓ Roster: {tertaut.code}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`nilai-calon-${calon.id}`}
                          onClick={() => setSunting(calon)}
                        >
                          Nilai / Edit
                        </Button>
                        {!tertaut && (
                          <Button
                            size="sm"
                            variant="primary"
                            data-testid={`luluskan-calon-${calon.id}`}
                            onClick={() => void luluskanSatuKlik(calon)}
                          >
                            ✓ Luluskan ke Anggota
                          </Button>
                        )}
                        <button
                          type="button"
                          title="Hapus calon audisi"
                          onClick={() => void db.audisi.delete(calon.id)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modal Form Calon & Lembar Penilaian Audisi */}
      <Modal
        open={!!sunting}
        onClose={() => setSunting(null)}
        title="Data Calon & Lembar Penilaian Audisi"
        wide
        testId="modal-calon-audisi"
        footer={
          sunting && (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSunting(null)}>
                Batal
              </Button>
              <Button
                variant="primary"
                data-testid="simpan-calon-audisi"
                onClick={() => void simpanCalon(sunting)}
              >
                Simpan Calon &amp; Nilai
              </Button>
            </div>
          )
        }
      >
        {sunting && (
          <div className="space-y-3 text-xs">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nama Lengkap">
                <Input
                  data-testid="input-nama-calon"
                  value={sunting.nama}
                  onChange={(e) => setSunting({ ...sunting, nama: e.target.value })}
                />
              </Field>
              <Field label="Nama Panggilan">
                <Input
                  value={sunting.panggilan ?? ''}
                  onChange={(e) => setSunting({ ...sunting, panggilan: e.target.value || undefined })}
                />
              </Field>
              <Field label="Nomor WhatsApp / HP">
                <Input
                  value={sunting.telepon ?? ''}
                  onChange={(e) => setSunting({ ...sunting, telepon: e.target.value || undefined })}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Sekolah / Fakultas / Instansi Asal">
                <Input
                  placeholder="Mis. SMA Negeri 3 / Fakultas Teknik"
                  data-testid="input-instansi-calon"
                  value={sunting.instansiAsal ?? ''}
                  onChange={(e) => setSunting({ ...sunting, instansiAsal: e.target.value || undefined })}
                />
              </Field>
              <Field label="Kelas / Jurusan">
                <Input
                  placeholder="Mis. X MIPA 2"
                  value={sunting.kelasJurusan ?? ''}
                  onChange={(e) => setSunting({ ...sunting, kelasJurusan: e.target.value || undefined })}
                />
              </Field>
              <Field label="NIS / NIM (Opsional)">
                <Input
                  value={sunting.nomorInduk ?? ''}
                  onChange={(e) => setSunting({ ...sunting, nomorInduk: e.target.value || undefined })}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Minat Seksi Ke-1">
                <Select
                  value={sunting.minatSeksi1}
                  onChange={(e) => setSunting({ ...sunting, minatSeksi1: e.target.value })}
                >
                  {daftarSeksi.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Instrumen Pilihan 1">
                <Input
                  placeholder="Mis. Trumpet / Flag"
                  data-testid="input-instrumen1-calon"
                  value={sunting.minatInstrumen1 ?? ''}
                  onChange={(e) => setSunting({ ...sunting, minatInstrumen1: e.target.value || undefined })}
                />
              </Field>
              <Field label="Minat Seksi Ke-2 (Opsional)">
                <Select
                  value={sunting.minatSeksi2 ?? ''}
                  onChange={(e) => setSunting({ ...sunting, minatSeksi2: e.target.value || undefined })}
                >
                  <option value="">— Tidak ada —</option>
                  {daftarSeksi.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Instrumen Pilihan 2">
                <Input
                  value={sunting.minatInstrumen2 ?? ''}
                  onChange={(e) => setSunting({ ...sunting, minatInstrumen2: e.target.value || undefined })}
                />
              </Field>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-slate-200">Lembar Skor Tes Audisi (0–100)</span>
                {sunting.nilai && (
                  <span className="font-bold text-emerald-300">
                    Rata-rata: {hitungSkorAudisi(sunting.nilai)?.rataRata.toFixed(1).replace('.', ',')}
                  </span>
                )}
              </div>
              <div className="grid gap-2.5 sm:grid-cols-4">
                {(
                  [
                    ['ritmik', 'Ketepatan Ritmik'],
                    ['kepekaanNada', 'Kepekaan Nada'],
                    ['posturLangkah', 'Postur & Langkah'],
                    ['koordinasiAlat', 'Koordinasi Alat'],
                  ] as const
                ).map(([kolom, lbl]) => (
                  <Field key={kolom} label={lbl}>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      data-testid={`input-skor-${kolom}`}
                      value={sunting.nilai?.[kolom] ?? ''}
                      placeholder="0–100"
                      onChange={(e) => {
                        const angka = Math.max(0, Math.min(100, Number(e.target.value) || 0))
                        const nilaiLama = sunting.nilai ?? {
                          ritmik: 75,
                          kepekaanNada: 75,
                          posturLangkah: 75,
                          koordinasiAlat: 75,
                        }
                        setSunting({
                          ...sunting,
                          nilai: { ...nilaiLama, [kolom]: angka },
                        })
                      }}
                    />
                  </Field>
                ))}
              </div>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
                <Field label="Nama Penguji">
                  <Input
                    value={sunting.penguji ?? ''}
                    onChange={(e) => setSunting({ ...sunting, penguji: e.target.value || undefined })}
                  />
                </Field>
                <Field label="Status Keputusan">
                  <Select
                    value={sunting.status}
                    onChange={(e) => setSunting({ ...sunting, status: e.target.value as StatusCalonAudisi })}
                  >
                    {(Object.keys(LABEL_STATUS_AUDISI) as StatusCalonAudisi[]).map((st) => (
                      <option key={st} value={st}>
                        {LABEL_STATUS_AUDISI[st]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Catatan Penguji">
                  <Input
                    value={sunting.catatanPenguji ?? ''}
                    onChange={(e) => setSunting({ ...sunting, catatanPenguji: e.target.value || undefined })}
                  />
                </Field>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Pratinjau Cetak Rekap Audisi A4 */}
      <Modal
        open={pratinjauOpen}
        onClose={() => setPratinjauOpen(false)}
        title="Pratinjau Cetak Rekapitulasi Audisi A4"
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPratinjauOpen(false)}>
              Tutup
            </Button>
            <Button
              variant="soft"
              onClick={() => downloadHtmlFile(susunHtmlCetak(), `rekap-audisi-${slugify(namaTim)}.html`)}
            >
              <IconDownload size={14} /> Unduh HTML
            </Button>
            <Button variant="primary" onClick={cetakRekap}>
              <IconPrinter size={14} /> Cetak A4
            </Button>
          </div>
        }
      >
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-white">
          <iframe
            title="Pratinjau Rekap Audisi"
            data-testid="iframe-pratinjau-audisi"
            srcDoc={susunHtmlCetak()}
            className="h-[65vh] w-full border-0"
          />
        </div>
      </Modal>
    </div>
  )
}
