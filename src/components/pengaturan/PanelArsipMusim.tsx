import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { ArsipMusim } from '../../db/types'
import {
  TABEL_MUSIMAN_DIARSIPKAN,
  formatRupiah,
  susunArsipMusim,
} from '../../lib/administrasiUnit'
import { bangunHtmlPiagamArsipMusim } from '../../lib/administrasiUnitCetak'
import { buildBackupPayload } from '../../lib/backup'
import { downloadHtmlFile, printHtml } from '../../lib/print'
import { downloadFile, slugify, todayISO, uid } from '../../lib/utils'
import { IconDownload, IconPrinter, IconTrash } from '../Icons'
import { Button, Card, Field, Input, Modal, useToast } from '../ui'

export function PanelArsipMusim({ namaTim }: { namaTim: string }) {
  const toast = useToast()
  const daftarArsip = useLiveQuery(
    () => db.arsipMusim.orderBy('createdAt').reverse().toArray(),
    [],
    [],
  )

  const thnSkrg = new Date().getFullYear()
  const [namaMusim, setNamaMusim] = useState(`Musim Kompetisi ${thnSkrg}`)
  const [tahunMusim, setTahunMusim] = useState(String(thnSkrg))
  const [catatanPenutup, setCatatanPenutup] = useState('')
  const [konfirmasiOpen, setKonfirmasiOpen] = useState(false)
  const [sedangProses, setSedangProses] = useState(false)
  const [pratinjauArsip, setPratinjauArsip] = useState<ArsipMusim | null>(null)

  async function jalankanRolloverMusim() {
    if (!namaMusim.trim()) {
      toast.push('Nama musim wajib diisi terlebih dahulu', 'err')
      return
    }
    setSedangProses(true)
    try {
      const payload = await buildBackupPayload()
      const arsip = susunArsipMusim({
        idArsip: uid('musim_'),
        namaMusim: namaMusim.trim(),
        tahunMusim: tahunMusim.trim() || String(thnSkrg),
        tanggalArsip: todayISO(),
        catatanPenutup: catatanPenutup.trim() || undefined,
        members: payload.members,
        sessions: payload.sessions,
        attendance: payload.attendance,
        drills: payload.drills,
        sets: payload.sets,
        songs: payload.songs,
        setlists: payload.setlists,
        kemajuan: payload.kemajuan,
        memberNotes: payload.memberNotes,
        evaluasi: payload.evaluasi,
        targetSetoran: payload.targetSetoran,
        setoran: payload.setoran,
        logPerubahan: payload.logPerubahan,
        countSheets: payload.countSheets,
        logistikLomba: payload.logistikLomba,
        penilaianLomba: payload.penilaianLomba,
        kasIuran: payload.kasIuran,
        audisi: payload.audisi,
        tindakLanjut: payload.tindakLanjut,
        anotasiPartitur: payload.anotasiPartitur,
      })

      const tabelBersih = TABEL_MUSIMAN_DIARSIPKAN.map((nama: string) => db.table(nama))

      await db.transaction('rw', [db.arsipMusim, ...tabelBersih], async () => {
        await db.arsipMusim.put(arsip)
        for (const t of tabelBersih) {
          await t.clear()
        }
      })

      setKonfirmasiOpen(false)
      setCatatanPenutup('')
      const thnLanjut = (Number(tahunMusim) || thnSkrg) + 1
      setNamaMusim(`Musim Kompetisi ${thnLanjut}`)
      setTahunMusim(String(thnLanjut))
      toast.push(
        `${arsip.namaMusim} berhasil dibekukan ke Arsip Lintas-Musim! Roster aktif, inventaris alat, & kartu medis tetap utuh untuk musim baru.`,
      )
    } catch (err) {
      toast.push(
        err instanceof Error ? err.message : 'Gagal membekukan arsip musim',
        'err',
      )
    } finally {
      setSedangProses(false)
    }
  }

  async function pulihkanArsipKeRuangKerja(arsip: ArsipMusim) {
    try {
      const m = arsip.muatanMusim
      const tabelTulis = [
        db.sessions,
        db.attendance,
        db.drills,
        db.sets,
        db.songs,
        db.setlists,
        db.kemajuan,
        db.memberNotes,
        db.evaluasi,
        db.targetSetoran,
        db.setoran,
        db.logPerubahan,
        db.countSheets,
        db.logistikLomba,
        db.penilaianLomba,
        db.kasIuran,
        db.audisi,
        db.tindakLanjut,
        db.anotasiPartitur,
      ]
      await db.transaction('rw', tabelTulis, async () => {
        for (const t of tabelTulis) await t.clear()
        if (m.sessions?.length) await db.sessions.bulkPut(m.sessions)
        if (m.attendance?.length) await db.attendance.bulkPut(m.attendance)
        if (m.drills?.length) await db.drills.bulkPut(m.drills)
        if (m.sets?.length) await db.sets.bulkPut(m.sets)
        if (m.songs?.length) await db.songs.bulkPut(m.songs)
        if (m.setlists?.length) await db.setlists.bulkPut(m.setlists)
        if (m.kemajuan?.length) await db.kemajuan.bulkPut(m.kemajuan)
        if (m.memberNotes?.length) await db.memberNotes.bulkPut(m.memberNotes)
        if (m.evaluasi?.length) await db.evaluasi.bulkPut(m.evaluasi)
        if (m.targetSetoran?.length) await db.targetSetoran.bulkPut(m.targetSetoran)
        if (m.setoran?.length) await db.setoran.bulkPut(m.setoran)
        if (m.logPerubahan?.length) await db.logPerubahan.bulkPut(m.logPerubahan)
        if (m.countSheets?.length) await db.countSheets.bulkPut(m.countSheets)
        if (m.logistikLomba?.length) await db.logistikLomba.bulkPut(m.logistikLomba)
        if (m.penilaianLomba?.length) await db.penilaianLomba.bulkPut(m.penilaianLomba)
        if (m.kasIuran?.length) await db.kasIuran.bulkPut(m.kasIuran)
        if (m.audisi?.length) await db.audisi.bulkPut(m.audisi)
        if (m.tindakLanjut?.length) await db.tindakLanjut.bulkPut(m.tindakLanjut)
        if (m.anotasiPartitur?.length) await db.anotasiPartitur.bulkPut(m.anotasiPartitur)
      })
      toast.push(`Data musim "${arsip.namaMusim}" berhasil dimuat kembali ke ruang kerja aktif`)
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal memuat arsip musim', 'err')
    }
  }

  return (
    <Card className="space-y-4" data-testid="panel-arsip-musim">
      <div>
        <h2 className="text-sm font-semibold text-slate-200">
          Arsip Lintas-Musim &amp; Pergantian Tahun Kepengurusan (Season Rollover)
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Bekukan repertoar lagu, koreografi drill/kirab, presensi latihan, buku kas, dan rekap nilai lomba musim ini ke arsip permanen baca-saja, lalu mulai musim baru <strong>tanpa menghapus</strong> daftar anggota aktif, inventaris alat/seragam, kartu medis, maupun identitas tim.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:grid-cols-3">
        <Field label="Nama Musim yang Akan Dibekukan">
          <Input
            data-testid="input-nama-musim"
            value={namaMusim}
            onChange={(e) => setNamaMusim(e.target.value)}
            placeholder="Mis. Musim GPMB 2026"
          />
        </Field>
        <Field label="Tahun Kompetisi">
          <Input
            type="number"
            value={tahunMusim}
            onChange={(e) => setTahunMusim(e.target.value)}
          />
        </Field>
        <Field label="Catatan / Prestasi Penutup Musim">
          <Input
            data-testid="input-catatan-musim"
            value={catatanPenutup}
            onChange={(e) => setCatatanPenutup(e.target.value)}
            placeholder="Mis. Juara Umum 2 Divisi Open"
          />
        </Field>
        <div className="sm:col-span-3 flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-slate-400">
            Tetap dipertahankan di musim baru: <strong>Anggota Aktif</strong>, <strong>Inventaris &amp; Pinjaman Alat</strong>, <strong>Kartu Medis</strong>, dan <strong>Pengaturan Unit</strong>.
          </span>
          <Button
            size="sm"
            variant="primary"
            data-testid="buka-konfirmasi-rollover"
            onClick={() => setKonfirmasiOpen(true)}
          >
            Bekukan Musim &amp; Mulai Musim Baru
          </Button>
        </div>
      </div>

      {(daftarArsip?.length ?? 0) > 0 && (
        <div className="space-y-2.5" data-testid="daftar-arsip-musim">
          <div className="text-xs font-semibold text-slate-300">
            Riwayat Arsip Musim Tersimpan ({daftarArsip?.length})
          </div>
          {daftarArsip?.map((a) => (
            <div
              key={a.id}
              data-testid={`kartu-arsip-musim-${a.id}`}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-emerald-300">
                    {a.namaMusim || a.id}{' '}
                    {a.tahunMusim && (
                      <span className="text-xs font-normal text-slate-400">({a.tahunMusim})</span>
                    )}
                  </div>
                  {a.catatanPenutup && (
                    <div className="mt-0.5 text-slate-300">{a.catatanPenutup}</div>
                  )}
                  {a.ringkasan && (
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-slate-400">
                      <span>Anggota: <strong>{a.ringkasan.jmlAnggotaAktif}</strong></span>
                      <span>· Sesi: <strong>{a.ringkasan.jmlSesi}</strong> ({a.ringkasan.rataKehadiranPersen}% hadir)</span>
                      <span>· Lagu: <strong>{a.ringkasan.jmlLagu}</strong></span>
                      <span>· Drill: <strong>{a.ringkasan.jmlDrill}</strong></span>
                      {a.ringkasan.skorPuncakSimulasi != null && (
                        <span>· Skor Puncak: <strong>{a.ringkasan.skorPuncakSimulasi.toFixed(2).replace('.', ',')}</strong></span>
                      )}
                      <span>· Saldo Kas: <strong>{formatRupiah(a.ringkasan.saldoAkhirKas)}</strong></span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {a.ringkasan && (
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`piagam-musim-${a.id}`}
                      onClick={() => setPratinjauArsip(a)}
                    >
                      <IconPrinter size={13} /> Piagam A4
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={() =>
                      downloadFile(
                        `arsip-${slugify(a.namaMusim || a.id)}.json`,
                        JSON.stringify(a, null, 2),
                        'application/json',
                      )
                    }
                  >
                    <IconDownload size={13} /> JSON
                  </Button>
                  {a.muatanMusim && (
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`muat-ulang-musim-${a.id}`}
                      onClick={() => void pulihkanArsipKeRuangKerja(a)}
                    >
                      Muat Ulang
                    </Button>
                  )}
                  <button
                    type="button"
                    title="Hapus arsip musim"
                    onClick={() => void db.arsipMusim.delete(a.id)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Konfirmasi Season Rollover */}
      <Modal
        open={konfirmasiOpen}
        onClose={() => setKonfirmasiOpen(false)}
        title={`Konfirmasi Bekukan "${namaMusim}" & Mulai Musim Baru`}
        testId="modal-konfirmasi-rollover"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setKonfirmasiOpen(false)}>
              Batal
            </Button>
            <Button
              variant="primary"
              disabled={sedangProses}
              data-testid="konfirmasi-bekukan-musim"
              onClick={() => void jalankanRolloverMusim()}
            >
              {sedangProses ? 'Membekukan…' : 'Ya, Bekukan ke Arsip & Mulai Musim Baru'}
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-xs text-slate-300">
          <p>
            Seluruh data musim <strong>{namaMusim}</strong> akan disimpan utuh ke dalam Arsip Lintas-Musim lokal (dan sewaktu-waktu dapat diunduh atau dimuat ulang).
          </p>
          <ul className="list-disc space-y-1 pl-5 text-slate-400">
            <li>
              <strong>Dibersihkan untuk musim baru:</strong> Jadwal &amp; presensi latihan, lagu &amp; setoran hafalan, koreografi drill/kirab, kesiapan lomba, simulasi nilai juri, buku kas/iuran musim berjalan, serta daftar audisi lama.
            </li>
            <li>
              <strong>Tetap utuh dan siap dipakai:</strong> Daftar anggota aktif, inventaris seragam/alat &amp; peminjaman aktif, kartu medis darurat, serta pengaturan unit.
            </li>
          </ul>
        </div>
      </Modal>

      {/* Modal Pratinjau Piagam Arsip Musim */}
      <Modal
        open={!!pratinjauArsip}
        onClose={() => setPratinjauArsip(null)}
        title={pratinjauArsip ? `Piagam Arsip — ${pratinjauArsip.namaMusim}` : 'Piagam Arsip'}
        wide
        footer={
          pratinjauArsip && (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPratinjauArsip(null)}>
                Tutup
              </Button>
              <Button
                variant="soft"
                onClick={() =>
                  downloadHtmlFile(
                    bangunHtmlPiagamArsipMusim(namaTim, pratinjauArsip),
                    `piagam-${slugify(pratinjauArsip.namaMusim)}.html`,
                  )
                }
              >
                <IconDownload size={14} /> Unduh HTML
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const html = bangunHtmlPiagamArsipMusim(namaTim, pratinjauArsip)
                  if (!printHtml(html)) {
                    downloadHtmlFile(html, `piagam-${slugify(pratinjauArsip.namaMusim)}.html`)
                  }
                }}
              >
                <IconPrinter size={14} /> Cetak A4
              </Button>
            </div>
          )
        }
      >
        {pratinjauArsip && (
          <div className="overflow-hidden rounded-lg border border-slate-700 bg-white">
            <iframe
              title="Pratinjau Piagam Arsip Musim"
              data-testid="iframe-pratinjau-piagam-musim"
              srcDoc={bangunHtmlPiagamArsipMusim(namaTim, pratinjauArsip)}
              className="h-[65vh] w-full border-0"
            />
          </div>
        )}
      </Modal>
    </Card>
  )
}
