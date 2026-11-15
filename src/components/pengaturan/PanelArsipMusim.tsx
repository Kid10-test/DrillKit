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
import { buildBackupPayload, downloadBackupZip } from '../../lib/backup'
import {
  berkasYatim,
  kumpulkanRujukanBerkas,
  nonaktifkanSemua,
  transaksiSaldoAwal,
} from '../../lib/pindahMusim'
import { AmbilDariArsip } from './AmbilDariArsip'
import { downloadHtmlFile, printHtml } from '../../lib/print'
import { downloadFile, slugify, todayISO, uid } from '../../lib/utils'
import { IconDownload, IconPrinter, IconTrash } from '../Icons'
import { Button, Card, Field, Input, Modal, Toggle, useToast } from '../ui'

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
  // v2.10 — backup wajib, pilihan rollover, dan konfirmasi untuk aksi yang mengubah data.
  const [backupAkhir, setBackupAkhir] = useState(false)
  const [sedangBackup, setSedangBackup] = useState(false)
  const [nonaktifkanAnggota, setNonaktifkanAnggota] = useState(true)
  const [bawaSaldo, setBawaSaldo] = useState(true)
  const [ambilDari, setAmbilDari] = useState<ArsipMusim | null>(null)
  const [muatUlang, setMuatUlang] = useState<ArsipMusim | null>(null)
  const [hapusArsip, setHapusArsip] = useState<ArsipMusim | null>(null)

  function bukaKonfirmasi() {
    setBackupAkhir(false)
    setKonfirmasiOpen(true)
  }

  /**
   * v2.10 — backup ZIP lengkap (termasuk partitur & rekaman) sebelum musim
   * dibekukan. Arsip musim tinggal di penyimpanan browser yang sama; kalau
   * HP hilang, arsip ikut hilang. Berkas ini satu-satunya salinan di luar HP.
   */
  async function unduhBackupAkhirMusim() {
    setSedangBackup(true)
    try {
      await downloadBackupZip({ akhirMusim: namaMusim.trim() || `Musim ${tahunMusim}` })
      setBackupAkhir(true)
      toast.push('Backup akhir musim diunduh. Simpan di Drive sebelum lanjut.')
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal membuat backup', 'err')
    } finally {
      setSedangBackup(false)
    }
  }

  async function jalankanRolloverMusim() {
    if (!namaMusim.trim()) {
      toast.push('Nama musim wajib diisi terlebih dahulu', 'err')
      return
    }
    if (!backupAkhir) {
      toast.push('Unduh backup akhir musim dulu', 'err')
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

      // v2.10 — tabel berkas biner (partitur, rekaman, judge tape) TIDAK
      // termasuk di sini lagi; lihat TABEL_BERKAS_DIPERTAHANKAN.
      const tabelBersih = TABEL_MUSIMAN_DIARSIPKAN.map((nama: string) => db.table(nama))
      const saldo = transaksiSaldoAwal(
        arsip.ringkasan.saldoAkhirKas,
        arsip.namaMusim,
        todayISO(),
        uid('kas_'),
        Date.now(),
      )
      let jmlNonaktif = 0

      await db.transaction('rw', [db.arsipMusim, db.members, ...tabelBersih], async () => {
        await db.arsipMusim.put(arsip)
        for (const t of tabelBersih) {
          await t.clear()
        }
        if (nonaktifkanAnggota) {
          const ubah = nonaktifkanSemua(await db.members.toArray())
          jmlNonaktif = ubah.length
          if (ubah.length) await db.members.bulkPut(ubah)
        }
        if (bawaSaldo && saldo) await db.kasIuran.put(saldo)
      })

      setKonfirmasiOpen(false)
      setCatatanPenutup('')
      const thnLanjut = (Number(tahunMusim) || thnSkrg) + 1
      setNamaMusim(`Musim Kompetisi ${thnLanjut}`)
      setTahunMusim(String(thnLanjut))
      setBackupAkhir(false)
      toast.push(
        `${arsip.namaMusim} dibekukan ke arsip. Musim baru mulai bersih` +
          (nonaktifkanAnggota ? `; ${jmlNonaktif} anggota dinonaktifkan, aktifkan lagi yang lanjut di menu Anggota.` : '.'),
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
      // v2.10 — Muat Ulang MENGGANTI seluruh isi musim berjalan, jadi isi yang
      // sekarang diselamatkan dulu ke berkas.
      await downloadBackupZip()
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
      setMuatUlang(null)
      toast.push(`Data musim "${arsip.namaMusim}" dimuat kembali. Isi sebelumnya tersimpan di backup yang baru diunduh.`)
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal memuat arsip musim', 'err')
    }
  }

  /**
   * v2.10 — hapus arsip beserta berkas partitur/rekaman yang HANYA dirujuk
   * arsip itu. Berkas yang masih dipakai musim berjalan atau arsip lain tetap.
   */
  async function jalankanHapusArsip(arsip: ArsipMusim) {
    try {
      let jml = 0
      await db.transaction(
        'rw',
        [db.arsipMusim, db.songs, db.penilaianLomba, db.partiturBerkas, db.rekamanAudio, db.judgeTapeAudio],
        async () => {
          const lain = (await db.arsipMusim.toArray()).filter((a) => a.id !== arsip.id)
          const rujukan = kumpulkanRujukanBerkas(
            { songs: await db.songs.toArray(), penilaianLomba: await db.penilaianLomba.toArray() },
            lain,
          )
          const yatim = berkasYatim(arsip, rujukan, {
            partitur: await db.partiturBerkas.toArray(),
            audio: await db.rekamanAudio.toArray(),
            judgeTape: await db.judgeTapeAudio.toArray(),
          })
          await db.partiturBerkas.bulkDelete(yatim.partitur)
          await db.rekamanAudio.bulkDelete(yatim.audio)
          await db.judgeTapeAudio.bulkDelete(yatim.judgeTape)
          jml = yatim.partitur.length + yatim.audio.length + yatim.judgeTape.length
          await db.arsipMusim.delete(arsip.id)
        },
      )
      setHapusArsip(null)
      toast.push(`Arsip "${arsip.namaMusim}" dihapus${jml ? `, beserta ${jml} berkas partitur/rekaman miliknya` : ''}.`, 'info')
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal menghapus arsip', 'err')
    }
  }

  return (
    <Card className="space-y-4" data-testid="panel-arsip-musim">
      <div>
        <h2 className="text-sm font-semibold text-slate-200">
          Arsip Lintas-Musim &amp; Pergantian Tahun Kepengurusan (Season Rollover)
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Rekap seluruh musim ini (jadwal &amp; absensi, lagu, drill, evaluasi, buku kas, nilai lomba) ke arsip, lalu mulai musim baru dari nol.
          Anggota tidak dihapus, hanya dinonaktifkan; yang lanjut tinggal diaktifkan lagi. Lagu, drill, dan jadwal lama bisa diambil kembali satu per satu dari arsip.
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
            Tetap ada di musim baru: <strong>data anggota</strong> (nonaktif), <strong>inventaris &amp; pinjaman alat</strong>, <strong>kartu medis</strong>, <strong>pengaturan unit</strong>, serta berkas partitur &amp; rekaman.
          </span>
          <Button
            size="sm"
            variant="primary"
            data-testid="buka-konfirmasi-rollover"
            onClick={bukaKonfirmasi}
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
                      variant="primary"
                      data-testid={`ambil-arsip-${a.id}`}
                      onClick={() => setAmbilDari(a)}
                    >
                      Ambil lagu/drill/jadwal
                    </Button>
                  )}
                  {a.muatanMusim && (
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid={`muat-ulang-musim-${a.id}`}
                      onClick={() => setMuatUlang(a)}
                    >
                      Muat Ulang
                    </Button>
                  )}
                  <button
                    type="button"
                    title="Hapus arsip musim"
                    data-testid={`hapus-arsip-${a.id}`}
                    onClick={() => setHapusArsip(a)}
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
              disabled={sedangProses || !backupAkhir}
              data-testid="konfirmasi-bekukan-musim"
              onClick={() => void jalankanRolloverMusim()}
            >
              {sedangProses ? 'Membekukan…' : 'Ya, Bekukan ke Arsip & Mulai Musim Baru'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs text-slate-300">
          <div
            className={`rounded-lg border p-3 ${backupAkhir ? 'border-emerald-700/50 bg-emerald-950/20' : 'border-amber-700/50 bg-amber-950/20'}`}
          >
            <div className="font-semibold text-slate-100">Langkah 1 · Unduh backup akhir musim</div>
            <p className="mt-1 text-slate-400">
              Satu berkas ZIP berisi semua data, partitur, dan rekaman. Arsip di bawah tersimpan di HP ini saja; kalau HP hilang, hanya berkas
              ini yang tersisa. Simpan ke Drive.
            </p>
            <Button
              size="sm"
              variant={backupAkhir ? 'soft' : 'primary'}
              className="mt-2"
              data-testid="unduh-backup-akhir-musim"
              disabled={sedangBackup}
              onClick={() => void unduhBackupAkhirMusim()}
            >
              <IconDownload size={13} /> {sedangBackup ? 'Menyiapkan…' : backupAkhir ? 'Sudah diunduh · unduh lagi' : 'Unduh backup (ZIP)'}
            </Button>
          </div>
          <div className="space-y-2 rounded-lg border border-slate-800 p-3">
            <div className="font-semibold text-slate-100">Langkah 2 · Bekukan &amp; mulai musim baru</div>
            <ul className="list-disc space-y-1 pl-5 text-slate-400">
              <li>
                <strong>Disalin ke arsip lalu dikosongkan:</strong> jadwal &amp; absensi, lagu &amp; set list, drill, setoran hafalan, evaluasi,
                kesiapan &amp; nilai lomba, buku kas, audisi.
              </li>
              <li>
                <strong>Tetap:</strong> data anggota, inventaris &amp; pinjaman, kartu medis, pengaturan unit, serta berkas partitur &amp; rekaman
                (tersambung lagi begitu lagunya diambil dari arsip).
              </li>
            </ul>
            <Toggle
              checked={nonaktifkanAnggota}
              onChange={setNonaktifkanAnggota}
              label="Nonaktifkan semua anggota (yang lanjut diaktifkan lagi di menu Anggota)"
              testId="opsi-nonaktifkan-anggota"
            />
            <Toggle
              checked={bawaSaldo}
              onChange={setBawaSaldo}
              label="Bawa saldo akhir kas sebagai saldo awal musim baru"
              testId="opsi-bawa-saldo"
            />
          </div>
        </div>
      </Modal>

      {ambilDari && <AmbilDariArsip arsip={ambilDari} onClose={() => setAmbilDari(null)} />}

      <Modal
        open={!!muatUlang}
        onClose={() => setMuatUlang(null)}
        title={muatUlang ? `Muat ulang "${muatUlang.namaMusim}"?` : 'Muat ulang arsip'}
        testId="modal-muat-ulang-musim"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMuatUlang(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              data-testid="konfirmasi-muat-ulang-musim"
              onClick={() => muatUlang && void pulihkanArsipKeRuangKerja(muatUlang)}
            >
              Ganti isi musim berjalan
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-xs text-slate-300">
          <p>
            Jadwal, absensi, lagu, drill, evaluasi, dan buku kas yang ada sekarang akan <strong>diganti seluruhnya</strong> dengan isi arsip ini.
            Sebelum itu DrillKit mengunduh backup ZIP isi sekarang.
          </p>
          <p className="text-slate-400">
            Hanya perlu sebagian? Pakai <strong>Ambil lagu/drill/jadwal</strong>, yang menambahkan tanpa menimpa.
          </p>
        </div>
      </Modal>

      <Modal
        open={!!hapusArsip}
        onClose={() => setHapusArsip(null)}
        title={hapusArsip ? `Hapus arsip "${hapusArsip.namaMusim}"?` : 'Hapus arsip'}
        testId="modal-hapus-arsip"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setHapusArsip(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              data-testid="konfirmasi-hapus-arsip"
              onClick={() => hapusArsip && void jalankanHapusArsip(hapusArsip)}
            >
              Hapus permanen
            </Button>
          </div>
        }
      >
        <p className="text-xs text-slate-300">
          Rekap musim ini beserta berkas partitur &amp; rekaman yang hanya dipakai musim itu akan dihapus dari HP ini. Pastikan backup akhir
          musimnya sudah tersimpan di Drive.
        </p>
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
