/**
 * #18 — Pembangun HTML Cetak A4 Murni `#hex` untuk Berita Acara Peminjaman,
 * Buku Induk Inventaris, Distribusi Seragam, dan Manifes Logistik Hari Lomba.
 *
 * Dipisahkan dari `inventarisLogistik.ts` agar hanya dimuat saat panel
 * Inventaris/Logistik (lazy chunk) dibuka, menjaga bundel awal tetap ramping.
 */
import type {
  ItemInventaris,
  KondisiInventaris,
  ManifesLogistikLomba,
  Member,
} from '../db/types'
import {
  LABEL_KONDISI_INVENTARIS,
  LABEL_PENDEK_KATEGORI,
  LABEL_STATUS_SERAGAM,
  WARNA_KONDISI_HEX,
  WARNA_STATUS_SERAGAM_HEX,
  ringkasInventaris,
  ringkasManifesLogistik,
  ringkasSeragamTim,
  statusBarisManifes,
} from './inventarisLogistik'
import { esc, printShell } from './print'

const CSS_CETAK_INVENTARIS_HEX = `
  @page { size: A4 portrait; margin: 12mm; }
  body { padding: 0; margin: 0; font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #0f172a; background: #ffffff; font-size: 11px; }
  .halaman { page-break-after: always; padding: 4px 0; }
  .halaman:last-child { page-break-after: auto; }
  .kop { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
  .kop h1 { margin: 0; font-size: 16px; color: #0f172a; letter-spacing: -0.01em; }
  .kop .sub { margin: 3px 0 0; font-size: 11px; color: #475569; }
  .kop .kanan { text-align: right; font-size: 10px; color: #475569; }
  .kotak-info { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; color: #1e293b; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }
  .angka { text-align: center; font-variant-numeric: tabular-nums; }
  .lencana { display: inline-block; padding: 1px 6px; border-radius: 999px; font-size: 9.5px; font-weight: 600; border: 1px solid #cbd5e1; }
  .klausul { margin-top: 12px; font-size: 10.5px; line-height: 1.5; color: #334155; }
  .klausul ol { margin: 4px 0 0 18px; padding: 0; }
  .ttd-grid { margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; text-align: center; page-break-inside: avoid; }
  .ttd-kotak { padding-top: 4px; }
  .ttd-garis { margin: 48px auto 4px; width: 78%; border-bottom: 1px solid #0f172a; font-weight: 600; padding-bottom: 2px; }
  .merah-baris td { background: #fef2f2; color: #7f1d1d; }
  .peringatan-merah { margin-top: 10px; border: 1.5px solid #ef4444; background: #fef2f2; color: #991b1b; padding: 8px 10px; border-radius: 6px; font-size: 10.5px; }
  .aman-hijau { margin-top: 10px; border: 1px solid #6ee7b7; background: #ecfdf5; color: #065f46; padding: 8px 10px; border-radius: 6px; font-size: 10.5px; }
`

function lencanaKondisiHtml(kondisi: KondisiInventaris): string {
  const w = WARNA_KONDISI_HEX[kondisi]
  return `<span class="lencana" style="background:${w.latar};border-color:${w.garis};color:${w.teks};">${esc(
    LABEL_KONDISI_INVENTARIS[kondisi],
  )}</span>`
}

export function bangunHtmlBeritaAcaraPinjam(opsi: {
  namaTim: string
  namaPelatih?: string
  kota?: string
  tanggalCetak?: string
  inventaris: ItemInventaris[]
  members: Member[]
  anggotaTarget?: Member | null
  labelSeksi?: (seksi: string) => string
}): string {
  const tanggalTeks = opsi.tanggalCetak || new Date().toISOString().slice(0, 10)
  const petaAnggota = new Map(opsi.members.map((m) => [m.id, m]))
  const daftarPeminjam: Member[] = opsi.anggotaTarget
    ? [opsi.anggotaTarget]
    : Array.from(
        new Set(
          opsi.inventaris
            .map((it) => it.pemegangId)
            .filter((id): id is string => Boolean(id && petaAnggota.has(id))),
        ),
      )
        .map((id) => petaAnggota.get(id)!)
        .sort((a, b) => a.code.localeCompare(b.code))

  if (daftarPeminjam.length === 0) {
    const kosong = `
      <div class="halaman">
        <div class="kop">
          <div>
            <h1>BERITA ACARA PEMINJAMAN ALAT &amp; PERLENGKAPAN</h1>
            <p class="sub">${esc(opsi.namaTim)}</p>
          </div>
          <div class="kanan">Tanggal: ${esc(tanggalTeks)}</div>
        </div>
        <p>Belum ada instrumen atau perlengkapan yang sedang tercatat dipinjam anggota.</p>
      </div>
    `
    return printShell(`Berita Acara Peminjaman - ${opsi.namaTim}`, kosong, CSS_CETAK_INVENTARIS_HEX)
  }

  const halaman = daftarPeminjam
    .map((m) => {
      const pinjaman = opsi.inventaris
        .filter((it) => it.pemegangId === m.id)
        .sort((a, b) => a.kodeAset.localeCompare(b.kodeAset))
      const namaSeksi = opsi.labelSeksi ? opsi.labelSeksi(m.section) : m.section
      const u = m.ukuranSeragam
      const barisAlat = pinjaman
        .map(
          (it, idx) => `
          <tr>
            <td class="angka">${idx + 1}</td>
            <td class="mono"><b>${esc(it.kodeAset)}</b>${
              it.nomorSeri ? `<br><span style="color:#475569;">SN: ${esc(it.nomorSeri)}</span>` : ''
            }</td>
            <td><b>${esc(it.nama)}</b>${
              it.merekTipe ? `<br><span style="color:#475569;">${esc(it.merekTipe)}</span>` : ''
            }</td>
            <td>${lencanaKondisiHtml(it.kondisi)}</td>
            <td>${esc(it.kelengkapanPinjam || 'Standar unit')}</td>
            <td class="mono">${esc(it.tanggalPinjam || tanggalTeks)}${
              it.targetKembali ? `<br>s.d. ${esc(it.targetKembali)}` : ''
            }</td>
          </tr>`,
        )
        .join('')

      const barisSeragam =
        u?.nomorSeriSeragam || u?.statusPinjam === 'dipinjam'
          ? `
          <tr>
            <td class="angka">${pinjaman.length + 1}</td>
            <td class="mono"><b>${esc(u.nomorSeriSeragam || 'SERAGAM')}</b>${
              u.nomorShako ? `<br><span style="color:#475569;">Shako: ${esc(u.nomorShako)}</span>` : ''
            }</td>
            <td><b>Stel Seragam Penampilan Unit</b><br><span style="color:#475569;">Jaket ${esc(
              u.jaketTunic || '-',
            )} · Bibber ${esc(u.bibber || '-')} · Sepatu ${esc(u.sepatu || '-')}</span></td>
            <td><span class="lencana" style="background:#ecfdf5;border-color:#6ee7b7;color:#065f46;">Lengkap</span></td>
            <td>Garment bag, shako, sarung tangan</td>
            <td class="mono">${esc(u.tanggalAmbil || tanggalTeks)}</td>
          </tr>`
          : ''

      return `
        <div class="halaman">
          <div class="kop">
            <div>
              <h1>BERITA ACARA PEMINJAMAN INVENTARIS UNIT</h1>
              <p class="sub">${esc(opsi.namaTim)}${opsi.kota ? ` · ${esc(opsi.kota)}` : ''}</p>
            </div>
            <div class="kanan">
              <div>Dokumen Inventaris Resmi</div>
              <div>Tanggal: <b>${esc(tanggalTeks)}</b></div>
            </div>
          </div>

          <div class="kotak-info">
            <div class="grid-2">
              <div><b>Nama Peminjam (Pihak Kedua):</b> ${esc(m.name)} (${esc(m.code)})</div>
              <div><b>Seksi / Instrumen:</b> ${esc(namaSeksi)} · ${esc(m.instrument || '-')}</div>
              <div><b>Pengurus / Pelatih (Pihak Pertama):</b> ${esc(opsi.namaPelatih || 'Pengurus Inventaris Unit')}</div>
              <div><b>Tahun Angkatan:</b> ${esc(String(m.joinYear || '-'))}</div>
            </div>
          </div>

          <p style="margin:0 0 6px;">Pada tanggal tersebut di atas, Pihak Pertama menyerahkan hak pakai sementara atas inventaris milik <b>${esc(
            opsi.namaTim,
          )}</b> kepada Pihak Kedua dengan rincian sebagai berikut:</p>

          <table>
            <thead>
              <tr>
                <th style="width:28px;" class="angka">No</th>
                <th style="width:115px;">Kode Aset / Seri</th>
                <th>Nama Instrumen / Perlengkapan</th>
                <th style="width:88px;">Kondisi Awal</th>
                <th style="width:140px;">Kelengkapan</th>
                <th style="width:92px;">Masa Pinjam</th>
              </tr>
            </thead>
            <tbody>
              ${barisAlat}${barisSeragam}
              ${
                !barisAlat && !barisSeragam
                  ? '<tr><td colspan="6">Belum ada item pinjaman tercatat pada anggota ini.</td></tr>'
                  : ''
              }
            </tbody>
          </table>

          <div class="klausul">
            <b>Ketentuan Tanggung Jawab Peminjam:</b>
            <ol>
              <li>Pihak Kedua wajib merawat kebersihan dan keamanan alat beserta kelengkapannya setiap selesai latihan maupun penampilan.</li>
              <li>Alat dilarang dipindahtangankan kepada pihak lain tanpa sepengetahuan Pengurus Inventaris / Pelatih.</li>
              <li>Apabila terjadi kerusakan atau gejala kendala teknis, Pihak Kedua wajib segera melapor agar dicatat di Buku Perawatan (dilarang membongkar paksa).</li>
              <li>Seluruh alat dan seragam wajib dikembalikan ke gudang unit sesuai jadwal pengembalian atau saat masa kepengurusan/keanggotaan berakhir.</li>
            </ol>
          </div>

          <div class="ttd-grid">
            <div class="ttd-kotak">
              <div>Yang Menyerahkan (Pihak Pertama),</div>
              <div style="color:#475569;font-size:10px;">Pengurus Inventaris / Pelatih</div>
              <div class="ttd-garis">${esc(opsi.namaPelatih || '........................................')}</div>
            </div>
            <div class="ttd-kotak">
              <div>Yang Menerima (Pihak Kedua),</div>
              <div style="color:#475569;font-size:10px;">Anggota Peminjam (${esc(m.code)})</div>
              <div class="ttd-garis">${esc(m.name)}</div>
            </div>
          </div>
        </div>
      `
    })
    .join('')

  return printShell(`Berita Acara Peminjaman - ${opsi.namaTim}`, halaman, CSS_CETAK_INVENTARIS_HEX)
}

export function bangunHtmlBukuInventaris(opsi: {
  namaTim: string
  inventaris: ItemInventaris[]
  members: Member[]
  tanggalCetak?: string
}): string {
  const tanggalTeks = opsi.tanggalCetak || new Date().toISOString().slice(0, 10)
  const petaAnggota = new Map(opsi.members.map((m) => [m.id, m]))
  const ringkas = ringkasInventaris(opsi.inventaris)
  const urut = [...opsi.inventaris].sort(
    (a, b) => a.kategori.localeCompare(b.kategori) || a.kodeAset.localeCompare(b.kodeAset),
  )

  const baris = urut
    .map((it, idx) => {
      const pemegang = it.pemegangId ? petaAnggota.get(it.pemegangId) : undefined
      const servisTerakhir = [...(it.riwayatServis ?? [])].sort((a, b) =>
        b.tanggal.localeCompare(a.tanggal),
      )[0]
      return `
        <tr class="${it.kondisi === 'rusak' ? 'merah-baris' : ''}">
          <td class="angka">${idx + 1}</td>
          <td class="mono"><b>${esc(it.kodeAset)}</b>${
            it.nomorSeri ? `<br><span style="color:#475569;">${esc(it.nomorSeri)}</span>` : ''
          }</td>
          <td><b>${esc(it.nama)}</b>${
            it.merekTipe ? `<br><span style="color:#475569;">${esc(it.merekTipe)}</span>` : ''
          }</td>
          <td>${esc(LABEL_PENDEK_KATEGORI[it.kategori])}</td>
          <td>${lencanaKondisiHtml(it.kondisi)}</td>
          <td>${
            pemegang
              ? `<b>${esc(pemegang.code)}</b> · ${esc(pemegang.name)}`
              : `<span style="color:#475569;">Gudang${
                  it.lokasiSimpan ? ` (${esc(it.lokasiSimpan)})` : ''
                }</span>`
          }</td>
          <td>${
            servisTerakhir
              ? `${esc(servisTerakhir.tanggal)}: ${esc(servisTerakhir.jenis)}`
              : '<span style="color:#64748b;">—</span>'
          }</td>
        </tr>`
    })
    .join('')

  const tubuh = `
    <div class="halaman">
      <div class="kop">
        <div>
          <h1>BUKU INDUK INVENTARIS INSTRUMEN &amp; PERLENGKAPAN</h1>
          <p class="sub">${esc(opsi.namaTim)} · Total ${ringkas.total} aset (${ringkas.siapPakai} siap pakai, ${
            ringkas.perluServis
          } perlu servis, ${ringkas.rusak} rusak)</p>
        </div>
        <div class="kanan">Dicetak: ${esc(tanggalTeks)}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:26px;" class="angka">No</th>
            <th style="width:105px;">Kode / No. Seri</th>
            <th>Nama &amp; Merek/Tipe</th>
            <th style="width:74px;">Kategori</th>
            <th style="width:86px;">Kondisi</th>
            <th style="width:135px;">Pemegang / Lokasi</th>
            <th style="width:140px;">Perawatan Terakhir</th>
          </tr>
        </thead>
        <tbody>
          ${baris || '<tr><td colspan="7">Belum ada data inventaris tercatat.</td></tr>'}
        </tbody>
      </table>
    </div>
  `
  return printShell(`Buku Induk Inventaris - ${opsi.namaTim}`, tubuh, CSS_CETAK_INVENTARIS_HEX)
}

export function bangunHtmlDistribusiSeragam(opsi: {
  namaTim: string
  members: Member[]
  labelSeksi?: (seksi: string) => string
  tanggalCetak?: string
}): string {
  const tanggalTeks = opsi.tanggalCetak || new Date().toISOString().slice(0, 10)
  const aktif = [...opsi.members]
    .filter((m) => m.active === 1)
    .sort((a, b) => a.section.localeCompare(b.section) || a.code.localeCompare(b.code))
  const r = ringkasSeragamTim(aktif)

  const baris = aktif
    .map((m, idx) => {
      const u = m.ukuranSeragam
      const st = u?.statusPinjam ?? 'belum'
      const w = WARNA_STATUS_SERAGAM_HEX[st]
      const seksi = opsi.labelSeksi ? opsi.labelSeksi(m.section) : m.section
      return `
        <tr>
          <td class="angka">${idx + 1}</td>
          <td><b>${esc(m.code)}</b> · ${esc(m.name)}<br><span style="color:#475569;">${esc(
            seksi,
          )} (${esc(m.instrument || '-')})</span></td>
          <td class="angka">${esc(u?.sepatu || '—')}</td>
          <td class="angka">${esc(u?.jaketTunic || '—')}${
            u?.lingkarDadaCm ? `<br><span style="color:#64748b;">${u.lingkarDadaCm}cm</span>` : ''
          }</td>
          <td class="angka">${esc(u?.bibber || '—')}${
            u?.panjangCelanaCm ? `<br><span style="color:#64748b;">${u.panjangCelanaCm}cm</span>` : ''
          }</td>
          <td class="angka">${esc(u?.shakoTopi || '—')}</td>
          <td class="angka">${esc(u?.sarungTangan || '—')}${
            u?.kostumGuard ? `<br><span style="color:#475569;">CG: ${esc(u.kostumGuard)}</span>` : ''
          }</td>
          <td class="mono">${esc(u?.nomorSeriSeragam || '—')}${
            u?.nomorShako ? `<br>Shk: ${esc(u.nomorShako)}` : ''
          }</td>
          <td><span class="lencana" style="background:${w.latar};border-color:${w.garis};color:${w.teks};">${esc(
            LABEL_STATUS_SERAGAM[st],
          )}</span></td>
        </tr>`
    })
    .join('')

  const tubuh = `
    <div class="halaman">
      <div class="kop">
        <div>
          <h1>DAFTAR UKURAN FITTING &amp; DISTRIBUSI SERAGAM</h1>
          <p class="sub">${esc(opsi.namaTim)} · ${r.sudahFitting}/${r.totalAnggotaAktif} sudah fitting · ${
            r.sedangDipinjam
          } sedang dipinjam · ${r.sudahDicuci} kembali &amp; dicuci</p>
        </div>
        <div class="kanan">Dicetak: ${esc(tanggalTeks)}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:24px;" class="angka">No</th>
            <th>Anggota &amp; Seksi</th>
            <th style="width:42px;" class="angka">Sepatu</th>
            <th style="width:52px;" class="angka">Jaket</th>
            <th style="width:52px;" class="angka">Bibber</th>
            <th style="width:48px;" class="angka">Shako</th>
            <th style="width:58px;" class="angka">Glove/CG</th>
            <th style="width:82px;">No. Seri</th>
            <th style="width:118px;">Status Kembali/Cuci</th>
          </tr>
        </thead>
        <tbody>
          ${baris || '<tr><td colspan="9">Belum ada anggota aktif.</td></tr>'}
        </tbody>
      </table>
    </div>
  `
  return printShell(`Distribusi Seragam - ${opsi.namaTim}`, tubuh, CSS_CETAK_INVENTARIS_HEX)
}

export function bangunHtmlManifesLogistik(opsi: {
  namaTim: string
  manifes: ManifesLogistikLomba
  members: Member[]
}): string {
  const { manifes } = opsi
  const petaAnggota = new Map(opsi.members.map((m) => [m.id, m]))
  const r = ringkasManifesLogistik(manifes)
  const adaPulang = r.sudahKembaliGudang > 0

  const kotakCentang = (aktif: number) => (aktif === 1 ? '☑' : '☐')

  const baris = (manifes.butir ?? [])
    .map((b, idx) => {
      const st = statusBarisManifes(b, manifes.tahapAktif, adaPulang)
      const pj = b.penanggungJawabId ? petaAnggota.get(b.penanggungJawabId) : undefined
      return `
        <tr class="${st === 'belum_kembali_merah' ? 'merah-baris' : ''}">
          <td class="angka">${idx + 1}</td>
          <td>
            <b>${esc(b.nama)}</b>${
              b.kodeAset ? ` <span class="mono" style="color:#475569;">[${esc(b.kodeAset)}]</span>` : ''
            }
            ${
              st === 'belum_kembali_merah'
                ? '<br><b style="color:#b91c1c;">⚠ BELUM KEMBALI KE GUDANG!</b>'
                : ''
            }
            ${b.catatan ? `<br><span style="color:#475569;">${esc(b.catatan)}</span>` : ''}
          </td>
          <td>${esc(LABEL_PENDEK_KATEGORI[b.kategori])}</td>
          <td class="angka">${b.jumlah} ${esc(b.satuan || 'unit')}</td>
          <td>${pj ? `${esc(pj.code)} · ${esc(pj.name)}` : '—'}</td>
          <td class="angka" style="font-size:13px;">${kotakCentang(b.muatBerangkat)}</td>
          <td class="angka" style="font-size:13px;">${kotakCentang(b.cekLokasi)}</td>
          <td class="angka" style="font-size:13px;">${kotakCentang(b.kembaliGudang)}</td>
        </tr>`
    })
    .join('')

  const blokPeringatan =
    r.belumKembaliMerah.length > 0
      ? `<div class="peringatan-merah"><b>PERHATIAN — ${r.belumKembaliMerah.length} BARANG BELUM MASUK KEMBALI KE GUDANG:</b><br>${r.belumKembaliMerah
          .map((x) => esc(x.nama))
          .join(', ')}</div>`
      : r.totalButir > 0 && r.sudahKembaliGudang === r.totalButir
        ? '<div class="aman-hijau"><b>LENGKAP 100%:</b> Seluruh perlengkapan telah kembali ke gudang markas.</div>'
        : ''

  const tubuh = `
    <div class="halaman">
      <div class="kop">
        <div>
          <h1>MANIFES LOGISTIK &amp; LOADING TRUK HARI LOMBA (3-TAHAP)</h1>
          <p class="sub">${esc(opsi.namaTim)} · <b>${esc(manifes.judul)}</b> · Tanggal ${esc(
            manifes.tanggal,
          )}</p>
        </div>
        <div class="kanan">
          <div>Armada: <b>${esc(manifes.kendaraan || '—')}</b></div>
          <div>Koordinator: <b>${esc(manifes.koordinator || '—')}</b></div>
        </div>
      </div>

      <div class="kotak-info">
        <div class="grid-2">
          <div><b>Total Muatan:</b> ${r.totalButir} jenis barang (${r.totalUnit} unit/koli)</div>
          <div><b>1. Muat Berangkat:</b> ${r.sudahBerangkat}/${r.totalButir} (${r.persenBerangkat}%)</div>
          <div><b>2. Cek di Lokasi Lomba:</b> ${r.sudahCekLokasi}/${r.totalButir} (${r.persenLokasi}%)</div>
          <div><b>3. Masuk Kembali ke Gudang:</b> ${r.sudahKembaliGudang}/${r.totalButir} (${r.persenKembali}%)</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:24px;" class="angka">No</th>
            <th>Nama Perlengkapan / Instrumen</th>
            <th style="width:70px;">Kategori</th>
            <th style="width:58px;" class="angka">Jumlah</th>
            <th style="width:110px;">PJ / Pemegang</th>
            <th style="width:58px;" class="angka">1. Muat<br>Markas</th>
            <th style="width:58px;" class="angka">2. Cek<br>Lokasi</th>
            <th style="width:58px;" class="angka">3. Masuk<br>Gudang</th>
          </tr>
        </thead>
        <tbody>
          ${baris || '<tr><td colspan="8">Belum ada daftar barang pada manifes ini.</td></tr>'}
        </tbody>
      </table>

      ${blokPeringatan}
    </div>
  `
  return printShell(`Manifes Logistik - ${manifes.tanggal}`, tubuh, CSS_CETAK_INVENTARIS_HEX)
}
