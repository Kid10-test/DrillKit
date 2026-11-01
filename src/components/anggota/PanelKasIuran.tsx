import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type {
  JenisTransaksiKas,
  Member,
  TransaksiKasIuran,
} from '../../db/types'
import {
  buatNomorKwitansiKas,
  formatRupiah,
  hitungRekapKasIuran,
  hitungStatusIuranAnggota,
} from '../../lib/administrasiUnit'
import {
  bangunHtmlKwitansiIuran,
  bangunHtmlRekapKasIuran,
} from '../../lib/administrasiUnitCetak'
import { downloadHtmlFile, printHtml } from '../../lib/print'
import { cx, slugify, todayISO, uid } from '../../lib/utils'
import { IconDownload, IconPlus, IconPrinter, IconTrash } from '../Icons'
import { Button, Card, EmptyState, Field, Input, Modal, Select, useToast } from '../ui'

const PROGRAM_BAWAAN = [
  'Iuran TC Kejuaraan',
  'Kas Rutin Bulanan',
  'Iuran Transportasi & Konsumsi Lomba',
]

export function PanelKasIuran({
  namaTim,
  members,
}: {
  namaTim: string
  members: Member[]
}) {
  const toast = useToast()
  const transaksi = useLiveQuery(() => db.kasIuran.toArray(), [], [])
  const anggotaAktif = useMemo(() => members.filter((m) => m.active !== 0), [members])

  const [programAktif, setProgramAktif] = useState(PROGRAM_BAWAAN[0])
  const [targetNominalStr, setTargetNominalStr] = useState('350000')
  const [formOpen, setFormOpen] = useState(false)
  const [kwitansiTerpilih, setKwitansiTerpilih] = useState<TransaksiKasIuran | null>(null)
  const [pratinjauRekapOpen, setPratinjauRekapOpen] = useState(false)

  // State form transaksi baru
  const [jenis, setJenis] = useState<JenisTransaksiKas>('iuran_anggota')
  const [memberId, setMemberId] = useState('')
  const [nominalStr, setNominalStr] = useState('150000')
  const [tanggal, setTanggal] = useState(todayISO())
  const [metodeBayar, setMetodeBayar] = useState<'tunai' | 'transfer'>('tunai')
  const [penerima, setPenerima] = useState('Bendahara Unit')
  const [keterangan, setKeterangan] = useState('')

  const daftarProgram = useMemo(() => {
    const set = new Set<string>(PROGRAM_BAWAAN)
    for (const t of transaksi ?? []) {
      if (t.kategoriProgram?.trim()) set.add(t.kategoriProgram.trim())
    }
    return [...set]
  }, [transaksi])

  const targetEfektif = useMemo(() => {
    const angkaInput = Math.max(0, Math.round(Number(targetNominalStr) || 0))
    if (angkaInput > 0) return angkaInput
    const dariTx = (transaksi ?? []).find(
      (t) => t.kategoriProgram === programAktif && (t.targetPerAnggota ?? 0) > 0,
    )
    return dariTx?.targetPerAnggota ?? 0
  }, [targetNominalStr, transaksi, programAktif])

  const ringkasan = useMemo(() => hitungRekapKasIuran(transaksi ?? []), [transaksi])

  const rekapAnggota = useMemo(
    () =>
      hitungStatusIuranAnggota(
        anggotaAktif,
        transaksi ?? [],
        programAktif,
        targetEfektif,
      ),
    [anggotaAktif, transaksi, programAktif, targetEfektif],
  )

  function bukaCatatIuranAnggota(m?: Member, sisa?: number) {
    setJenis('iuran_anggota')
    setMemberId(m?.id || anggotaAktif[0]?.id || '')
    setNominalStr(String(sisa && sisa > 0 ? sisa : Math.max(50000, targetEfektif || 150000)))
    setTanggal(todayISO())
    setKeterangan(m ? `Pembayaran ${programAktif} — ${m.name}` : '')
    setFormOpen(true)
  }

  async function simpanTransaksi() {
    const nominal = Math.round(Number(nominalStr) || 0)
    if (nominal <= 0) {
      toast.push('Nominal rupiah harus lebih dari 0', 'err')
      return
    }
    if (jenis === 'iuran_anggota' && !memberId) {
      toast.push('Pilih anggota pembayar terlebih dahulu', 'err')
      return
    }
    const skrg = Date.now()
    const urut = (transaksi?.length ?? 0) + 1
    const txBaru: TransaksiKasIuran = {
      id: uid('kas_'),
      tanggal,
      jenis,
      kategoriProgram: programAktif.trim() || 'Kas Umum',
      targetPerAnggota: jenis === 'iuran_anggota' ? targetEfektif : undefined,
      memberId: jenis === 'iuran_anggota' ? memberId : undefined,
      nominal,
      keterangan:
        keterangan.trim() ||
        (jenis === 'iuran_anggota'
          ? `Setoran ${programAktif}`
          : jenis === 'pemasukan_umum'
            ? 'Pemasukan kas umum'
            : 'Pengeluaran operasional'),
      nomorKwitansi: buatNomorKwitansiKas(urut, tanggal),
      penerimaOleh: penerima.trim() || undefined,
      metode: metodeBayar,
      createdAt: skrg,
      updatedAt: skrg,
    }
    await db.kasIuran.put(txBaru)
    setFormOpen(false)
    toast.push(`Transaksi ${txBaru.nomorKwitansi} berhasil dicatat`)
  }

  function susunHtmlKwitansi(tx: TransaksiKasIuran): string {
    const anggota = tx.memberId ? members.find((m) => m.id === tx.memberId) : undefined
    const barisRekap = anggota ? rekapAnggota.find((r) => r.member.id === anggota.id) : undefined
    return bangunHtmlKwitansiIuran({
      namaTim,
      transaksi: tx,
      namaAnggota: anggota?.name,
      kodeAnggota: anggota?.code,
      sisaTunggakan: barisRekap?.sisaTunggakan,
    })
  }

  function susunHtmlRekapKas(): string {
    return bangunHtmlRekapKasIuran({
      namaTim,
      anggotaAktif,
      transaksi: [...(transaksi ?? [])].sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
      kategoriProgramFokus: programAktif,
    })
  }

  return (
    <div className="space-y-4" data-testid="panel-kas-iuran">
      {/* Kartu Ringkasan Saldo */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-slate-400">
            Total Pemasukan (Iuran + Umum)
          </div>
          <div
            className="mt-1 text-lg font-extrabold tabular-nums text-emerald-400"
            data-testid="total-pemasukan-kas"
          >
            {formatRupiah(ringkasan.totalPemasukan)}
          </div>
          <div className="text-[11px] text-slate-500">
            Iuran anggota: {formatRupiah(ringkasan.totalIuranAnggota)}
          </div>
        </Card>
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-slate-400">
            Total Pengeluaran Kegiatan
          </div>
          <div
            className="mt-1 text-lg font-extrabold tabular-nums text-rose-400"
            data-testid="total-pengeluaran-kas"
          >
            {formatRupiah(ringkasan.totalPengeluaran)}
          </div>
          <div className="text-[11px] text-slate-500">
            {(transaksi?.length ?? 0)} transaksi tercatat
          </div>
        </Card>
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-slate-400">
            Saldo Akhir Kas Unit
          </div>
          <div
            className="mt-1 text-lg font-extrabold tabular-nums text-slate-100"
            data-testid="saldo-akhir-kas"
          >
            {formatRupiah(ringkasan.saldoAkhir)}
          </div>
          <div className="text-[11px] text-slate-500">Luring 100% · Bebas server</div>
        </Card>
      </div>

      {/* Pengaturan Program Iuran & Tombol Aksi */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Program Iuran / Kas">
              <Input
                list="daftar-program-kas"
                data-testid="input-program-kas"
                value={programAktif}
                onChange={(e) => setProgramAktif(e.target.value)}
                className="w-60"
              />
              <datalist id="daftar-program-kas">
                {daftarProgram.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field label="Target Lunas per Anggota (Rp)">
              <Input
                type="number"
                min={0}
                step={10000}
                data-testid="input-target-iuran"
                value={targetNominalStr}
                onChange={(e) => setTargetNominalStr(e.target.value)}
                className="w-40"
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              data-testid="pratinjau-cetak-kas"
              onClick={() => setPratinjauRekapOpen(true)}
            >
              <IconPrinter size={14} /> Rekap Kas A4
            </Button>
            <Button
              size="sm"
              variant="soft"
              data-testid="catat-pengeluaran-kas"
              onClick={() => {
                setJenis('pengeluaran')
                setNominalStr('100000')
                setTanggal(todayISO())
                setKeterangan('')
                setFormOpen(true)
              }}
            >
              <IconPlus size={14} /> Catat Pemasukan / Pengeluaran
            </Button>
            <Button
              size="sm"
              variant="primary"
              data-testid="catat-setoran-iuran"
              onClick={() => bukaCatatIuranAnggota()}
            >
              <IconPlus size={14} /> Catat Setoran Iuran
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabel Status Lunas / Cicilan / Tunggakan per Anggota */}
      <Card className="overflow-x-auto p-0">
        <div className="border-b border-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-200">
          Status Pembayaran Anggota — {programAktif} (Target {formatRupiah(targetEfektif)})
        </div>
        {anggotaAktif.length === 0 ? (
          <EmptyState
            icon={<IconPlus size={26} />}
            title="Belum ada anggota aktif"
            desc="Tambahkan anggota aktif terlebih dahulu untuk memantau iuran TC & cicilan."
          />
        ) : (
          <table className="w-full text-left text-xs" data-testid="tabel-iuran-anggota">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/70 text-[11px] uppercase text-slate-400">
                <th className="px-3 py-2">Anggota</th>
                <th className="px-3 py-2 text-right">Terbayar</th>
                <th className="px-3 py-2 text-right">Sisa Tunggakan</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-right">Aksi &amp; Kwitansi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rekapAnggota.map((r) => {
                const m = r.member
                const txTerakhir = r.transaksiTerakhir
                return (
                  <tr key={m.id} data-testid={`baris-iuran-${m.id}`}>
                    <td className="px-3 py-2 font-medium text-slate-100">
                      {m.name} <span className="text-slate-500">({m.code})</span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-300">
                      {formatRupiah(r.terbayar)}
                      {r.jumlahCicilan > 0 && (
                        <span className="ml-1 text-[10px] text-slate-500">({r.jumlahCicilan}x)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                      {formatRupiah(r.sisaTunggakan)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={cx(
                          'inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                          r.status === 'lunas'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : r.status === 'cicilan'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300',
                        )}
                      >
                        {r.status === 'lunas' ? 'LUNAS' : r.status === 'cicilan' ? 'CICILAN' : 'BELUM'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        {txTerakhir && (
                          <Button
                            size="sm"
                            variant="ghost"
                            data-testid={`cetak-kwitansi-${m.id}`}
                            onClick={() => setKwitansiTerpilih(txTerakhir)}
                          >
                            <IconPrinter size={13} /> Kwitansi
                          </Button>
                        )}
                        {r.status !== 'lunas' && (
                          <Button
                            size="sm"
                            variant="soft"
                            data-testid={`bayar-cepat-${m.id}`}
                            onClick={() => bukaCatatIuranAnggota(m, r.sisaTunggakan)}
                          >
                            + Setor
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Riwayat Jurnal Transaksi */}
      {(transaksi?.length ?? 0) > 0 && (
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-200">
            Jurnal Riwayat Kas ({transaksi?.length ?? 0} Transaksi)
          </div>
          <table className="w-full text-left text-xs" data-testid="tabel-jurnal-kas">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/70 text-[11px] uppercase text-slate-400">
                <th className="px-3 py-2">Tanggal &amp; Kwitansi</th>
                <th className="px-3 py-2">Program &amp; Keterangan</th>
                <th className="px-3 py-2 text-right">Nominal</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {[...(transaksi ?? [])]
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2">
                      <div className="font-mono text-[11px] text-slate-200">{t.nomorKwitansi}</div>
                      <div className="text-[10px] text-slate-500">{t.tanggal}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-200">{t.kategoriProgram}</div>
                      {t.keterangan && (
                        <div className="text-[11px] text-slate-400">{t.keterangan}</div>
                      )}
                    </td>
                    <td
                      className={cx(
                        'px-3 py-2 text-right font-bold tabular-nums',
                        t.jenis === 'pengeluaran' ? 'text-rose-400' : 'text-emerald-300',
                      )}
                    >
                      {t.jenis === 'pengeluaran' ? '−' : '+'}
                      {formatRupiah(t.nominal)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setKwitansiTerpilih(t)}>
                          Kwitansi
                        </Button>
                        <button
                          type="button"
                          title="Hapus transaksi"
                          onClick={() => void db.kasIuran.delete(t.id)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modal Tambah Transaksi */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Catat Transaksi Kas / Setoran Iuran"
        testId="modal-transaksi-kas"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              data-testid="simpan-transaksi-kas"
              onClick={() => void simpanTransaksi()}
            >
              Simpan &amp; Buat Nomor Kwitansi
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Jenis Transaksi">
              <Select
                data-testid="select-jenis-kas"
                value={jenis}
                onChange={(e) => setJenis(e.target.value as JenisTransaksiKas)}
              >
                <option value="iuran_anggota">Setoran Iuran / Cicilan Anggota</option>
                <option value="pemasukan_umum">Pemasukan Kas Umum / Sponsor</option>
                <option value="pengeluaran">Pengeluaran Kegiatan / TC</option>
              </Select>
            </Field>
            <Field label="Tanggal">
              <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
            </Field>
          </div>

          {jenis === 'iuran_anggota' && (
            <Field label="Anggota Pembayar">
              <Select
                data-testid="select-anggota-kas"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              >
                <option value="">— Pilih anggota —</option>
                {anggotaAktif.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nominal (Rp)">
              <Input
                type="number"
                min={1}
                step={5000}
                data-testid="input-nominal-kas"
                value={nominalStr}
                onChange={(e) => setNominalStr(e.target.value)}
              />
            </Field>
            <Field label="Metode">
              <Select
                value={metodeBayar}
                onChange={(e) => setMetodeBayar(e.target.value as 'tunai' | 'transfer')}
              >
                <option value="tunai">Tunai</option>
                <option value="transfer">Transfer</option>
              </Select>
            </Field>
            <Field label="Bendahara / Penerima">
              <Input value={penerima} onChange={(e) => setPenerima(e.target.value)} />
            </Field>
          </div>

          <Field label="Keterangan">
            <Input
              data-testid="input-keterangan-kas"
              placeholder="Mis. Cicilan ke-1 Iuran TC GPMB / Konsumsi air mineral"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
            />
          </Field>
        </div>
      </Modal>

      {/* Modal Pratinjau Kwitansi */}
      <Modal
        open={!!kwitansiTerpilih}
        onClose={() => setKwitansiTerpilih(null)}
        title={kwitansiTerpilih ? `Kwitansi Resmi — ${kwitansiTerpilih.nomorKwitansi}` : 'Kwitansi'}
        wide
        footer={
          kwitansiTerpilih && (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setKwitansiTerpilih(null)}>
                Tutup
              </Button>
              <Button
                variant="soft"
                onClick={() =>
                  downloadHtmlFile(
                    susunHtmlKwitansi(kwitansiTerpilih),
                    `kwitansi-${slugify(kwitansiTerpilih.nomorKwitansi)}.html`,
                  )
                }
              >
                <IconDownload size={14} /> Unduh Kwitansi HTML
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const html = susunHtmlKwitansi(kwitansiTerpilih)
                  if (!printHtml(html)) {
                    downloadHtmlFile(html, `kwitansi-${slugify(kwitansiTerpilih.nomorKwitansi)}.html`)
                  }
                }}
              >
                <IconPrinter size={14} /> Cetak Kwitansi
              </Button>
            </div>
          )
        }
      >
        {kwitansiTerpilih && (
          <div className="overflow-hidden rounded-lg border border-slate-700 bg-white">
            <iframe
              title="Pratinjau Kwitansi Resmi"
              data-testid="iframe-pratinjau-kwitansi"
              srcDoc={susunHtmlKwitansi(kwitansiTerpilih)}
              className="h-[52vh] w-full border-0"
            />
          </div>
        )}
      </Modal>

      {/* Modal Pratinjau Rekap Buku Kas A4 */}
      <Modal
        open={pratinjauRekapOpen}
        onClose={() => setPratinjauRekapOpen(false)}
        title="Pratinjau Rekapitulasi Buku Kas & Iuran A4"
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPratinjauRekapOpen(false)}>
              Tutup
            </Button>
            <Button
              variant="soft"
              onClick={() => downloadHtmlFile(susunHtmlRekapKas(), `rekap-kas-${slugify(namaTim)}.html`)}
            >
              <IconDownload size={14} /> Unduh HTML
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const html = susunHtmlRekapKas()
                if (!printHtml(html)) downloadHtmlFile(html, `rekap-kas-${slugify(namaTim)}.html`)
              }}
            >
              <IconPrinter size={14} /> Cetak A4
            </Button>
          </div>
        }
      >
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-white">
          <iframe
            title="Pratinjau Rekap Kas A4"
            data-testid="iframe-pratinjau-kas"
            srcDoc={susunHtmlRekapKas()}
            className="h-[65vh] w-full border-0"
          />
        </div>
      </Modal>
    </div>
  )
}
