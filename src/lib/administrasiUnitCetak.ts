import type {
  ArsipMusim,
  CalonAudisi,
  KartuMedisAnggota,
  KopSuratUnit,
  Member,
  TransaksiKasIuran,
} from '../db/types'
import {
  LABEL_STATUS_AUDISI,
  buatNomorSuratDispensasi,
  evaluasiSiagaMedis,
  formatRupiah,
  hitungRekapKasIuran,
  hitungStatusIuranAnggota,
  kelompokkanPesertaDispensasi,
  susunPeringkatAudisi,
} from './administrasiUnit'

/**
 * Pembangun HTML Cetak A4 Resmi Administrasi Unit (#21):
 *   - Rekapitulasi Peringkat & Seleksi Audisi (#21a)
 *   - Surat Permohonan Izin / Dispensasi Kolektif per Instansi Tujuan (#21b)
 *   - Lembar Siaga Medis & Kontak Darurat Lapangan (#21b)
 *   - Kartu Bukti Bayar / Kwitansi & Rekap Buku Kas/Iuran TC (#21c)
 *   - Laporan Pembekuan Arsip Musim (#21c)
 *
 * 100% warna `#hex` murni — bebas `oklch()`, `color-mix()`, dan `rgba()`.
 */

function esc(s: string | undefined | null): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const BULAN_INDO = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

function formatTanggalIndo(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  if (!m) return iso || '—'
  const bln = BULAN_INDO[Number(m[2]) - 1] ?? m[2]
  return `${Number(m[3])} ${bln} ${m[1]}`
}

const CSS_A4_DASAR = `
  @page { size: A4 portrait; margin: 14mm 15mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #0f172a;
    background: #ffffff;
    font-size: 11px;
    line-height: 1.45;
  }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 7px; vertical-align: top; }
  th { background: #1e293b; color: #ffffff; font-weight: 700; text-align: left; }
  td.angka, th.angka { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
`

/* ========================================================================== */
/*  1. Cetak Rekap Audisi Anggota Baru (#21a)                                 */
/* ========================================================================== */

export function bangunHtmlRekapAudisi(opts: {
  namaTim: string
  daftarCalon: CalonAudisi[]
  labelSeksiFilter?: string
}): string {
  const peringkat = susunPeringkatAudisi(opts.daftarCalon)
  const baris = peringkat
    .map(
      (b) => `<tr>
        <td style="text-align:center;"><strong>${b.peringkat}</strong></td>
        <td>
          <strong>${esc(b.calon.nama)}</strong>
          ${b.calon.instansiAsal ? `<div style="font-size:9.5px;color:#475569;">${esc(b.calon.instansiAsal)}${b.calon.kelasJurusan ? ` · ${esc(b.calon.kelasJurusan)}` : ''}</div>` : ''}
        </td>
        <td>${esc(b.calon.minatSeksi1)}${b.calon.minatInstrumen1 ? ` (${esc(b.calon.minatInstrumen1)})` : ''}${b.calon.minatSeksi2 ? `<div style="font-size:9.5px;color:#64748b;">Minat 2: ${esc(b.calon.minatSeksi2)}</div>` : ''}</td>
        <td class="angka">${b.skor ? b.skor.ritmik : '—'}</td>
        <td class="angka">${b.skor ? b.skor.kepekaanNada : '—'}</td>
        <td class="angka">${b.skor ? b.skor.posturLangkah : '—'}</td>
        <td class="angka">${b.skor ? b.skor.koordinasiAlat : '—'}</td>
        <td class="angka"><strong>${b.skor ? b.skor.rataRata.toFixed(1).replace('.', ',') : '—'}</strong></td>
        <td>${esc(LABEL_STATUS_AUDISI[b.calon.status])}</td>
      </tr>`,
    )
    .join('')

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Rekapitulasi Audisi — ${esc(opts.namaTim)}</title>
<style>
  ${CSS_A4_DASAR}
  .kop { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
  .kop h1 { margin: 0; font-size: 16px; color: #0f172a; }
  .kop .sub { font-size: 10.5px; color: #475569; margin-top: 2px; }
</style>
</head>
<body>
  <div class="kop">
    <h1>REKAPITULASI HASIL SELEKSI &amp; AUDISI ANGGOTA BARU</h1>
    <div class="sub"><strong>${esc(opts.namaTim)}</strong>${opts.labelSeksiFilter ? ` · Peminatan: ${esc(opts.labelSeksiFilter)}` : ''} · Total Pendaftar: ${peringkat.length} orang</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:36px;text-align:center;">#</th>
        <th>Nama Calon &amp; Asal</th>
        <th>Peminatan Seksi</th>
        <th class="angka">Ritmik</th>
        <th class="angka">Nada</th>
        <th class="angka">Postur</th>
        <th class="angka">Alat</th>
        <th class="angka">Rata-rata</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${baris || `<tr><td colspan="9" style="text-align:center;color:#64748b;">Belum ada data calon audisi.</td></tr>`}
    </tbody>
  </table>
</body>
</html>`
}

/* ========================================================================== */
/*  2. Generator Surat Izin / Dispensasi Resmi Kolektif A4 (#21b)             */
/* ========================================================================== */

export interface MasukanCetakSuratDispensasi {
  namaTim: string
  kota?: string
  namaPelatih?: string
  logoDataUrl?: string
  kop?: KopSuratUnit
  perihal: string
  namaKegiatan: string
  tanggalMulai: string
  tanggalSelesai: string
  waktuKegiatan?: string
  lokasiKegiatan: string
  nomorUrutAwal?: number
  tanggalSurat?: string
  peserta: Member[]
}

export function bangunHtmlSuratDispensasi(opts: MasukanCetakSuratDispensasi): string {
  const kelompok = kelompokkanPesertaDispensasi(opts.peserta)
  const kota = opts.kota?.trim() || 'Tempat'
  const tglSurat = formatTanggalIndo(opts.tanggalSurat || new Date().toISOString().slice(0, 10))
  const rentangTanggal =
    opts.tanggalMulai === opts.tanggalSelesai || !opts.tanggalSelesai
      ? formatTanggalIndo(opts.tanggalMulai)
      : `${formatTanggalIndo(opts.tanggalMulai)} s.d. ${formatTanggalIndo(opts.tanggalSelesai)}`
  const urutAwal = Math.max(1, opts.nomorUrutAwal ?? 1)
  const kop = opts.kop ?? {}
  const penandatanganKiri = kop.namaPembina?.trim() || ''
  const jabatanKiri = kop.jabatanPembina?.trim() || 'Pembina / Penanggung Jawab'
  const penandatanganKanan = kop.namaKetuaUnit?.trim() || opts.namaPelatih?.trim() || 'Pelatih / Ketua Unit'

  const halamanPerInstansi = kelompok
    .map((grup, idx) => {
      const noSurat = buatNomorSuratDispensasi(urutAwal + idx, opts.namaTim, opts.tanggalSurat || opts.tanggalMulai)
      const barisPeserta = grup.peserta
        .map(
          (m, no) => `<tr>
            <td style="text-align:center;">${no + 1}</td>
            <td><strong>${esc(m.name)}</strong></td>
            <td>${esc(m.nomorInduk || '—')}</td>
            <td>${esc(m.kelasJurusan || '—')}</td>
            <td>${esc(m.instrument || m.section)}</td>
          </tr>`,
        )
        .join('')

      return `<section class="lembar-surat${idx < kelompok.length - 1 ? ' pisah-halaman' : ''}">
        <div class="kop-resmi">
          ${opts.logoDataUrl ? `<img src="${esc(opts.logoDataUrl)}" alt="Logo Unit" class="logo-kop" />` : ''}
          <div class="teks-kop">
            ${kop.namaInstansiInduk ? `<div class="induk">${esc(kop.namaInstansiInduk)}</div>` : ''}
            <div class="unit">${esc(opts.namaTim)}</div>
            ${kop.alamatSekretariat ? `<div class="alamat">${esc(kop.alamatSekretariat)}</div>` : ''}
            ${kop.kontakResmi ? `<div class="alamat">${esc(kop.kontakResmi)}</div>` : ''}
          </div>
        </div>

        <div class="baris-meta">
          <div>
            <div>Nomor : <strong>${esc(noSurat)}</strong></div>
            <div>Lampiran : ${grup.peserta.length > 5 ? '1 (satu) daftar nama' : '—'}</div>
            <div>Perihal : <strong>${esc(opts.perihal || 'Permohonan Izin / Dispensasi Kegiatan')}</strong></div>
          </div>
          <div style="text-align:right;">${esc(kota)}, ${esc(tglSurat)}</div>
        </div>

        <div class="tujuan">
          Kepada Yth.<br />
          <strong>Pimpinan / Kepala / Dekan ${esc(grup.namaInstansiTujuan)}</strong><br />
          di Tempat
        </div>

        <p>Dengan hormat,</p>
        <p>
          Sehubungan dengan pelaksanaan kegiatan <strong>${esc(opts.namaKegiatan)}</strong> oleh unit
          <strong>${esc(opts.namaTim)}</strong>, bersama surat ini kami memohon kesediaan Bapak/Ibu untuk
          memberikan izin / dispensasi kepada anggota kami yang berasal dari
          <strong>${esc(grup.namaInstansiTujuan)}</strong> pada:
        </p>

        <table class="tabel-agenda">
          <tbody>
            <tr><td style="width:130px;">Hari / Tanggal</td><td>: <strong>${esc(rentangTanggal)}</strong></td></tr>
            ${opts.waktuKegiatan ? `<tr><td>Waktu</td><td>: ${esc(opts.waktuKegiatan)}</td></tr>` : ''}
            <tr><td>Tempat / Lokasi</td><td>: ${esc(opts.lokasiKegiatan || 'Lapangan Latihan / Arena Kejuaraan')}</td></tr>
          </tbody>
        </table>

        <p style="margin-bottom:6px;">Adapun daftar nama peserta yang dimohonkan dispensasi adalah sebagai berikut:</p>
        <table class="tabel-peserta">
          <thead>
            <tr>
              <th style="width:34px;text-align:center;">No</th>
              <th>Nama Lengkap</th>
              <th style="width:115px;">NIS / NIM / ID</th>
              <th style="width:135px;">Kelas / Jurusan</th>
              <th style="width:120px;">Seksi / Instrumen</th>
            </tr>
          </thead>
          <tbody>
            ${barisPeserta}
          </tbody>
        </table>

        <p>
          Demikian surat permohonan dispensasi ini kami sampaikan. Atas perhatian, dukungan, dan kerja sama
          Bapak/Ibu, kami ucapkan terima kasih.
        </p>

        <div class="ttd-blok">
          ${
            penandatanganKiri
              ? `<div class="ttd-kolom">
                  <div>Mengetahui,</div>
                  <div>${esc(jabatanKiri)}</div>
                  <div class="ruang-ttd"></div>
                  <div><strong><u>${esc(penandatanganKiri)}</u></strong></div>
                  ${kop.nipPembina ? `<div style="font-size:10px;color:#334155;">NIP/NIDN: ${esc(kop.nipPembina)}</div>` : ''}
                </div>`
              : `<div></div>`
          }
          <div class="ttd-kolom">
            <div>Hormat kami,</div>
            <div>Pengurus / Pelatih ${esc(opts.namaTim)}</div>
            <div class="ruang-ttd"></div>
            <div><strong><u>${esc(penandatanganKanan)}</u></strong></div>
          </div>
        </div>
      </section>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Surat Dispensasi — ${esc(opts.namaKegiatan)}</title>
<style>
  @page { size: A4 portrait; margin: 16mm 18mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Times New Roman", Georgia, Cambria, serif;
    color: #0f172a;
    background: #ffffff;
    font-size: 11.5pt;
    line-height: 1.5;
  }
  .pisah-halaman { page-break-after: always; break-after: page; }
  .kop-resmi {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    border-bottom: 3px double #0f172a;
    padding-bottom: 8px;
    margin-bottom: 14px;
    text-align: center;
  }
  .logo-kop { height: 58px; width: auto; }
  .teks-kop .induk { font-size: 11pt; font-weight: 700; text-transform: uppercase; color: #1e293b; }
  .teks-kop .unit { font-size: 14.5pt; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.02em; }
  .teks-kop .alamat { font-size: 9.5pt; color: #334155; }
  .baris-meta {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 14px;
    font-size: 11pt;
  }
  .tujuan { margin-bottom: 12px; }
  p { margin: 8px 0; text-align: justify; }
  .tabel-agenda { border-collapse: collapse; margin: 6px 0 10px 14px; font-size: 11pt; }
  .tabel-agenda td { border: 0; padding: 2px 6px; vertical-align: top; }
  .tabel-peserta { width: 100%; border-collapse: collapse; font-size: 10pt; font-family: ui-sans-serif, -apple-system, sans-serif; margin: 6px 0 12px; }
  .tabel-peserta th, .tabel-peserta td { border: 1px solid #334155; padding: 5px 7px; }
  .tabel-peserta th { background: #e2e8f0; color: #0f172a; font-weight: 700; text-align: left; }
  .ttd-blok {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-top: 24px;
    text-align: center;
    font-size: 11pt;
  }
  .ruang-ttd { height: 58px; }
</style>
</head>
<body>
  ${halamanPerInstansi || '<p>Belum ada peserta yang dipilih untuk surat dispensasi.</p>'}
</body>
</html>`
}

/* ========================================================================== */
/*  3. Cetak Lembar Siaga Medis & Kontak Darurat Lapangan (#21b)              */
/* ========================================================================== */

export function bangunHtmlLembarMedisDarurat(opts: {
  namaTim: string
  anggota: Member[]
  petaMedis: Map<string, KartuMedisAnggota>
  hanyaPerhatianKhusus?: boolean
}): string {
  const barisData = opts.anggota
    .filter((m) => m.active !== 0)
    .map((m) => {
      const k = opts.petaMedis.get(m.id)
      const siaga = evaluasiSiagaMedis(k)
      return { m, k, siaga }
    })
    .filter((x) => (!opts.hanyaPerhatianKhusus ? true : x.siaga.tingkatSiaga === 'perhatian_khusus'))

  const htmlBaris = barisData
    .map(({ m, k, siaga }) => {
      const sorot = siaga.tingkatSiaga === 'perhatian_khusus'
      return `<tr style="background:${sorot ? '#fef2f2' : '#ffffff'};">
        <td>
          <strong>${esc(m.name)}</strong>
          <div style="font-size:9.5px;color:#475569;">${esc(m.code)} · ${esc(m.instrument || m.section)}</div>
        </td>
        <td style="text-align:center;"><strong>${esc(k?.golonganDarah || '-')}</strong></td>
        <td>
          ${k?.alergiObat ? `<div><strong>Alergi Obat:</strong> ${esc(k.alergiObat)}</div>` : ''}
          ${k?.alergiMakanan ? `<div><strong>Alergi Makanan:</strong> ${esc(k.alergiMakanan)}</div>` : ''}
          ${k?.riwayatMedis ? `<div><strong>Riwayat:</strong> ${esc(k.riwayatMedis)}</div>` : ''}
          ${!k?.alergiObat && !k?.alergiMakanan && !k?.riwayatMedis ? '<span style="color:#64748b;">Tidak ada catatan khusus</span>' : ''}
        </td>
        <td>${esc(k?.obatPribadi || '—')}</td>
        <td>
          ${
            k?.kontakDaruratNama
              ? `<strong>${esc(k.kontakDaruratNama)}</strong>${k.kontakDaruratHubungan ? ` (${esc(k.kontakDaruratHubungan)})` : ''}<br /><strong>${esc(k.kontakDaruratTelepon)}</strong>`
              : '<span style="color:#dc2626;font-weight:700;">Belum diisi</span>'
          }
        </td>
      </tr>`
    })
    .join('')

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Lembar Siaga Medis Darurat — ${esc(opts.namaTim)}</title>
<style>
  ${CSS_A4_DASAR}
  .rahasia {
    background: #7f1d1d;
    color: #ffffff;
    padding: 6px 10px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 10.5px;
    margin-bottom: 10px;
    letter-spacing: 0.03em;
  }
  h1 { margin: 0 0 8px; font-size: 15px; color: #0f172a; }
</style>
</head>
<body>
  <div class="rahasia">DOKUMEN RAHASIA TIM MEDIS &amp; PELATIH KEPALA — DILARANG DISEBARKAN KE PUBLIK / GRUP UMUM</div>
  <h1>DAFTAR SIAGA MEDIS &amp; KONTAK DARURAT LAPANGAN — ${esc(opts.namaTim)}</h1>
  <table>
    <thead>
      <tr>
        <th style="width:140px;">Anggota</th>
        <th style="width:48px;text-align:center;">Gol.</th>
        <th>Alergi &amp; Riwayat Kesehatan</th>
        <th style="width:145px;">Obat Pribadi / Penanganan</th>
        <th style="width:155px;">Kontak Darurat Wali</th>
      </tr>
    </thead>
    <tbody>
      ${htmlBaris || `<tr><td colspan="5" style="text-align:center;color:#64748b;">Tidak ada data medis yang sesuai filter.</td></tr>`}
    </tbody>
  </table>
</body>
</html>`
}

/* ========================================================================== */
/*  4. Cetak Kartu Bukti Bayar (Kwitansi) & Rekap Kas/Iuran TC (#21c)         */
/* ========================================================================== */

export function bangunHtmlKwitansiIuran(opts: {
  namaTim: string
  transaksi: TransaksiKasIuran
  namaAnggota?: string
  kodeAnggota?: string
  sisaTunggakan?: number
}): string {
  const { transaksi: t } = opts
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Kwitansi ${esc(t.nomorKwitansi)}</title>
<style>
  @page { size: A5 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #0f172a;
    background: #ffffff;
    padding: 8px;
  }
  .kartu {
    border: 2px solid #0f172a;
    border-radius: 10px;
    padding: 14px 18px;
    max-width: 680px;
  }
  .kepala {
    display: flex;
    justify-content: space-between;
    border-bottom: 2px solid #cbd5e1;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .judul { font-size: 15px; font-weight: 800; color: #0f172a; }
  .no { font-size: 11px; font-weight: 700; color: #047857; }
  .baris { display: flex; margin: 5px 0; font-size: 12px; }
  .lbl { width: 150px; color: #475569; }
  .nominal {
    margin-top: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #ecfdf5;
    border: 1px solid #10b981;
    border-radius: 8px;
    padding: 8px 12px;
  }
  .nominal .angka-besar { font-size: 18px; font-weight: 800; color: #065f46; }
</style>
</head>
<body>
  <div class="kartu">
    <div class="kepala">
      <div>
        <div class="judul">BUKTI PEMBAYARAN KAS / IURAN TC</div>
        <div style="font-size:11px;color:#475569;">${esc(opts.namaTim)}</div>
      </div>
      <div style="text-align:right;">
        <div class="no">${esc(t.nomorKwitansi)}</div>
        <div style="font-size:11px;color:#475569;">Tanggal: ${esc(formatTanggalIndo(t.tanggal))}</div>
      </div>
    </div>
    <div class="baris"><div class="lbl">Telah diterima dari</div><div>: <strong>${esc(opts.namaAnggota || 'Pemasukan Umum Unit')}</strong>${opts.kodeAnggota ? ` (${esc(opts.kodeAnggota)})` : ''}</div></div>
    <div class="baris"><div class="lbl">Program / Keperluan</div><div>: <strong>${esc(t.kategoriProgram)}</strong></div></div>
    <div class="baris"><div class="lbl">Metode Pembayaran</div><div>: ${t.metode === 'transfer' ? 'Transfer' : 'Tunai'}</div></div>
    ${t.keterangan ? `<div class="baris"><div class="lbl">Catatan</div><div>: ${esc(t.keterangan)}</div></div>` : ''}
    ${typeof opts.sisaTunggakan === 'number' ? `<div class="baris"><div class="lbl">Sisa Tagihan Program</div><div>: <strong>${opts.sisaTunggakan === 0 ? 'LUNAS' : formatRupiah(opts.sisaTunggakan)}</strong></div></div>` : ''}
    <div class="nominal">
      <div>
        <div style="font-size:10px;color:#065f46;text-transform:uppercase;">Nominal Diterima</div>
        <div class="angka-besar">${esc(formatRupiah(t.nominal))}</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#334155;">
        Bendahara / Penerima,<br /><br />
        <strong>${esc(t.penerimaOleh || 'Bendahara Unit')}</strong>
      </div>
    </div>
  </div>
</body>
</html>`
}

export function bangunHtmlRekapKasIuran(opts: {
  namaTim: string
  anggotaAktif: Member[]
  transaksi: TransaksiKasIuran[]
  kategoriProgramFokus?: string
}): string {
  const rekap = hitungRekapKasIuran(opts.transaksi)
  const fokus = opts.kategoriProgramFokus || rekap.programIuran[0]?.kategoriProgram || 'Iuran TC'
  const matriks = hitungStatusIuranAnggota(opts.anggotaAktif, opts.transaksi, fokus)

  const barisMatriks = matriks
    .map(
      (b, idx) => `<tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td><strong>${esc(b.member.name)}</strong> <span style="color:#64748b;">(${esc(b.member.code)})</span></td>
        <td class="angka">${esc(formatRupiah(b.terbayar))}</td>
        <td class="angka">${esc(formatRupiah(b.sisaTunggakan))}</td>
        <td style="text-align:center;"><strong>${b.status === 'lunas' ? 'LUNAS' : b.status === 'cicilan' ? 'CICILAN' : 'BELUM'}</strong></td>
      </tr>`,
    )
    .join('')

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Rekap Buku Kas &amp; Iuran — ${esc(opts.namaTim)}</title>
<style>
  ${CSS_A4_DASAR}
  .ringkasan { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0 14px; }
  .kotak { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 10px; background: #f8fafc; }
  .kotak .lbl { font-size: 9.5px; color: #475569; text-transform: uppercase; }
  .kotak .val { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px; }
</style>
</head>
<body>
  <h1 style="margin:0;font-size:16px;">REKAPITULASI BUKU KAS &amp; IURAN KEGIATAN — ${esc(opts.namaTim)}</h1>
  <div class="ringkasan">
    <div class="kotak"><div class="lbl">Total Pemasukan</div><div class="val">${esc(formatRupiah(rekap.totalPemasukan))}</div></div>
    <div class="kotak"><div class="lbl">Total Pengeluaran</div><div class="val">${esc(formatRupiah(rekap.totalPengeluaran))}</div></div>
    <div class="kotak"><div class="lbl">Saldo Akhir Kas</div><div class="val">${esc(formatRupiah(rekap.saldoAkhir))}</div></div>
  </div>
  <h2 style="font-size:12px;margin:12px 0 6px;">Status Pembayaran Program: ${esc(fokus)}</h2>
  <table>
    <thead>
      <tr>
        <th style="width:34px;text-align:center;">No</th>
        <th>Anggota</th>
        <th class="angka">Terbayar</th>
        <th class="angka">Sisa Tunggakan</th>
        <th style="width:90px;text-align:center;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${barisMatriks || `<tr><td colspan="5" style="text-align:center;color:#64748b;">Belum ada anggota aktif.</td></tr>`}
    </tbody>
  </table>
</body>
</html>`
}

/* ========================================================================== */
/*  5. Cetak Piagam Ringkasan Arsip Musim (#21c)                              */
/* ========================================================================== */

export function bangunHtmlPiagamArsipMusim(namaTim: string, arsip: ArsipMusim): string {
  const r = arsip.ringkasan
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Arsip Musim — ${esc(arsip.namaMusim)}</title>
<style>
  ${CSS_A4_DASAR}
  .bingkai { border: 2px solid #0f172a; border-radius: 10px; padding: 18px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0; }
  .kartu { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; background: #f8fafc; }
  .kartu .lbl { font-size: 9.5px; color: #475569; text-transform: uppercase; }
  .kartu .val { font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px; }
</style>
</head>
<body>
  <div class="bingkai">
    <h1 style="margin:0;font-size:17px;">LAPORAN ARSIP LINTAS-MUSIM — ${esc(namaTim)}</h1>
    <p style="margin:4px 0 10px;color:#475569;"><strong>${esc(arsip.namaMusim)}</strong> · Tahun ${esc(arsip.tahunMusim)} · Dibekukan pada ${esc(formatTanggalIndo(arsip.tanggalArsip))}</p>
    <div class="grid">
      <div class="kartu"><div class="lbl">Anggota Aktif</div><div class="val">${r.jmlAnggotaAktif} orang</div></div>
      <div class="kartu"><div class="lbl">Sesi Latihan &amp; Lomba</div><div class="val">${r.jmlSesi} sesi (${r.rataKehadiranPersen}% hadir)</div></div>
      <div class="kartu"><div class="lbl">Skor Puncak Simulasi</div><div class="val">${r.skorPuncakSimulasi !== null ? r.skorPuncakSimulasi.toFixed(2).replace('.', ',') : '—'}</div></div>
      <div class="kartu"><div class="lbl">Repertoar Lagu</div><div class="val">${r.jmlLagu} karya</div></div>
      <div class="kartu"><div class="lbl">Paket Drill / Show</div><div class="val">${r.jmlDrill} drill</div></div>
      <div class="kartu"><div class="lbl">Saldo Akhir Kas Musim</div><div class="val">${esc(formatRupiah(r.saldoAkhirKas))}</div></div>
    </div>
    ${arsip.catatanPenutup ? `<p><strong>Catatan Penutup Musim:</strong> ${esc(arsip.catatanPenutup)}</p>` : ''}
  </div>
</body>
</html>`
}
