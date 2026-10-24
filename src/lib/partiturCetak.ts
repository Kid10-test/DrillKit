/**
 * #11c — Penyusun dokumen HTML cetak mandiri murni heksadesimal untuk partitur.
 *
 * Modul ini **100% murni** (tanpa DOM, tanpa Dexie, tanpa OSMD, tanpa dependensi
 * baru) supaya dirakit `qa/bangun-logika.sh` ke `/tmp/partiturCetak.mjs` dan
 * seluruh jaminan warnanya (nol `oklch()` / `color-mix()`, keutuhan `viewBox`
 * SVG, `@page`, dan `.no-print`) diuji langsung di Node.
 */

/* --------------------------------- Tipe --------------------------------- */

export type UkuranKertasPartitur = 'A4_P' | 'A4_L' | 'A5_L'
export type SkalaCetakPartitur = 'padat' | 'normal' | 'besar'

export interface SpesifikasiKertasPartitur {
  kode: UkuranKertasPartitur
  label: string
  labelPendek: string
  /** Nilai `@page { size: … }` baku CSS. */
  cssPageSize: string
  /** Margin kertas pada `@page`. */
  cssPageMargin: string
  /** Lebar wadah render lepas-layar OSMD pada 96 dpi. */
  lebarRenderPx: number
  lebarMm: number
  tinggiMm: number
}

export interface DataCetakPartitur {
  namaTim?: string
  judulLagu: string
  pengarang?: string
  /** Mis. `"Full Score (6 part)"`, `"Trumpet 1"`, atau `"Brass (3 part)"`. */
  labelBagian: string
  /** Keterangan sukat/tempo/birama ringkas, mis. `"132 BPM · 4/4 → 3/4 · 12 birama"`. */
  ringkasanMusik?: string
  ukuranKertas: UkuranKertasPartitur
  /** Daftar elemen `<svg>…</svg>` per halaman yang dihasilkan OSMD. */
  halamanSvg: string[]
  dicetakPada?: string
}

/* ------------------------------- Konstanta ------------------------------ */

/** Palet warna heksadesimal murni — dilarang memakai `oklch()` / `color-mix()`. */
export const PALET_CETAK_PARTITUR = {
  kertas: '#ffffff',
  latarPratinjau: '#e2e8f0',
  bilahAtas: '#0f172a',
  teksBilah: '#f8fafc',
  teksBilahRedup: '#cbd5e1',
  tombolCetak: '#059669',
  tombolCetakTeks: '#ffffff',
  tinta: '#0f172a',
  tintaSub: '#334155',
  tintaKaki: '#64748b',
  garis: '#cbd5e1',
  lencanaLatar: '#f1f5f9',
} as const

export const SPESIFIKASI_KERTAS_PARTITUR: Record<
  UkuranKertasPartitur,
  SpesifikasiKertasPartitur
> = {
  A4_P: {
    kode: 'A4_P',
    label: 'A4 Tegak',
    labelPendek: 'A4 Tegak',
    cssPageSize: '210mm 297mm',
    cssPageMargin: '10mm 12mm',
    lebarRenderPx: 794,
    lebarMm: 210,
    tinggiMm: 297,
  },
  A4_L: {
    kode: 'A4_L',
    label: 'A4 Mendatar',
    labelPendek: 'A4 Mendatar',
    cssPageSize: '297mm 210mm',
    cssPageMargin: '10mm 12mm',
    lebarRenderPx: 1122,
    lebarMm: 297,
    tinggiMm: 210,
  },
  A5_L: {
    kode: 'A5_L',
    label: 'Buku Saku / Lyre (A5 Mendatar)',
    labelPendek: 'A5 Lyre',
    cssPageSize: '210mm 148mm',
    cssPageMargin: '6mm 8mm',
    lebarRenderPx: 794,
    lebarMm: 210,
    tinggiMm: 148,
  },
}

export const DAFTAR_UKURAN_KERTAS_PARTITUR: UkuranKertasPartitur[] = [
  'A4_P',
  'A4_L',
  'A5_L',
]

export const LABEL_SKALA_CETAK_PARTITUR: Record<SkalaCetakPartitur, string> = {
  padat: 'Padat (82%)',
  normal: 'Normal (95%)',
  besar: 'Besar (110%)',
}

/* ---------------------------- Fungsi Pembantu --------------------------- */

/** Escape teks pengguna sebelum disisipkan ke atribut/isi HTML cetak. */
export function escHtmlPartitur(teks: string): string {
  return teks.replace(
    /[&<>"']/g,
    (kar) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[kar] ?? kar,
  )
}

/**
 * Pilih ukuran kertas awal secara cerdas:
 * - `>= 4` part tampil (mis. *Full score* atau seksi besar) → `'A4_L'` agar sistem lega.
 * - `1–3` part tampil (mis. *part* instrumen tunggal) → `'A4_P'`.
 */
export function kertasBawaanUntukJumlahPart(jumlahPartTampil: number): UkuranKertasPartitur {
  return jumlahPartTampil >= 4 ? 'A4_L' : 'A4_P'
}

/** Hitung faktor zoom OSMD untuk kombinasi skala cetak & ukuran kertas. */
export function zoomUntukSkalaCetak(
  skala: SkalaCetakPartitur,
  ukuranKertas: UkuranKertasPartitur,
): number {
  const dasar = skala === 'padat' ? 0.82 : skala === 'besar' ? 1.1 : 0.95
  // Kertas buku saku/lyre A5 tingginya setengah A4, jadi sedikit dirapatkan agar muat 2–3 sistem per lembar.
  const faktorKertas = ukuranKertas === 'A5_L' ? 0.88 : 1
  return Math.round(dasar * faktorKertas * 100) / 100
}

function bersihkanFungsiWarnaModern(teks: string): string {
  if (!/oklch\(|color-mix\(/i.test(teks)) return teks
  // Ganti pemanggilan oklch(...) / color-mix(...) bersarang 1 tingkat dengan tinta hex aman.
  return teks
    .replace(/color-mix\((?:[^()]+|\([^()]*\))*\)/gi, PALET_CETAK_PARTITUR.tinta)
    .replace(/oklch\([^()]*\)/gi, PALET_CETAK_PARTITUR.tinta)
}

function bacaAngkaAtribut(tagSvgPembuka: string, namaAtribut: string): number | null {
  const re = new RegExp(`\\b${namaAtribut}\\s*=\\s*["']\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i')
  const cocok = tagSvgPembuka.match(re)
  if (!cocok) return null
  const nilai = Number.parseFloat(cocok[1])
  return Number.isFinite(nilai) && nilai > 0 ? nilai : null
}

/**
 * Siapkan satu elemen `<svg>…</svg>` keluaran OSMD/VexFlow supaya siap dicetak:
 * 1. Suntikkan `viewBox="0 0 W H"` bila belum ada (VexFlow menulis `width`/`height`
 *    tanpa `viewBox`, sehingga tanpa ini CSS `width:100%;height:auto` memotong tepi kanan).
 * 2. Seragamkan atribut `style` pembuka ke unit responsif murni hex `#ffffff`.
 * 3. Pastikan nol `oklch()` dan nol `color-mix()`.
 */
export function siapkanSvgHalamanCetak(svgMentah: string): string {
  const bersihWarna = bersihkanFungsiWarnaModern(svgMentah.trim())
  const cocokTag = bersihWarna.match(/^<svg\b[^>]*>/i)
  if (!cocokTag) return ''

  let tagPembuka = cocokTag[0]
  const sisaIsi = bersihWarna.slice(tagPembuka.length)

  const punyaViewBox = /\bviewBox\s*=/i.test(tagPembuka)
  if (!punyaViewBox) {
    const lebar = bacaAngkaAtribut(tagPembuka, 'width') ?? 794
    const tinggi = bacaAngkaAtribut(tagPembuka, 'height') ?? 1123
    tagPembuka = tagPembuka.replace(
      /^<svg\b/i,
      `<svg viewBox="0 0 ${lebar} ${tinggi}"`,
    )
  }

  const gayaAman = `width:100%;height:auto;display:block;background:${PALET_CETAK_PARTITUR.kertas};`
  if (/\bstyle\s*=\s*["'][^"']*["']/i.test(tagPembuka)) {
    tagPembuka = tagPembuka.replace(/\bstyle\s*=\s*["'][^"']*["']/i, `style="${gayaAman}"`)
  } else {
    tagPembuka = tagPembuka.replace(/>$/, ` style="${gayaAman}">`)
  }

  return tagPembuka + sisaIsi
}

/* --------------------- Pembangkit HTML & Nama Berkas -------------------- */

function formatTanggalCetakBawaan(): string {
  const d = new Date()
  const bln = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ]
  return `${d.getDate()} ${bln[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Rakit dokumen `<!doctype html>` mandiri siap cetak / simpan PDF / kirim WA.
 *
 * Seluruh warna 100% heksadesimal murni, tanpa skrip/font eksternal, dilengkapi
 * bilah `.no-print` di bagian atas sehingga berkas `.html` yang dibuka terpisah
 * di peramban laptop lama tetap memiliki tombol **Cetak** satu klik.
 */
export function htmlCetakPartitur(data: DataCetakPartitur): string {
  const spec =
    SPESIFIKASI_KERTAS_PARTITUR[data.ukuranKertas] ?? SPESIFIKASI_KERTAS_PARTITUR.A4_P
  const daftarSvg = data.halamanSvg
    .map((mentah) => siapkanSvgHalamanCetak(mentah))
    .filter((s) => s.length > 0)

  const judulAman = escHtmlPartitur(data.judulLagu.trim() || 'Partitur Tanpa Judul')
  const bagianAman = escHtmlPartitur(data.labelBagian.trim() || 'Full Score')
  const timAman = data.namaTim?.trim() ? escHtmlPartitur(data.namaTim.trim()) : ''
  const pengarangAman = data.pengarang?.trim() ? escHtmlPartitur(data.pengarang.trim()) : ''
  const ringkasanAman = data.ringkasanMusik?.trim()
    ? escHtmlPartitur(data.ringkasanMusik.trim())
    : ''
  const tanggalAman = escHtmlPartitur(data.dicetakPada?.trim() || formatTanggalCetakBawaan())

  const totalHalaman = Math.max(1, daftarSvg.length)
  const judulDokumen = `${judulAman} — ${bagianAman}`

  const lembarHtml =
    daftarSvg.length === 0
      ? `<section class="lembar-partitur" data-halaman="1">
          <div class="kepala-utama">
            <div>
              ${timAman ? `<div class="nama-tim">${timAman}</div>` : ''}
              <h1 class="judul-lagu">${judulAman}</h1>
            </div>
            <div class="lencana-bagian">${bagianAman}</div>
          </div>
          <p class="kosong-catatan">Tidak ada halaman notasi untuk ditampilkan.</p>
        </section>`
      : daftarSvg
          .map((svg, idx) => {
            const nomor = idx + 1
            const kepala =
              nomor === 1
                ? `<header class="kepala-utama">
                    <div class="kepala-kiri">
                      ${timAman ? `<div class="nama-tim">${timAman}</div>` : ''}
                      <h1 class="judul-lagu">${judulAman}</h1>
                      ${
                        pengarangAman || ringkasanAman
                          ? `<div class="meta-lagu">${[pengarangAman, ringkasanAman].filter(Boolean).join(' · ')}</div>`
                          : ''
                      }
                    </div>
                    <div class="lencana-bagian">${bagianAman}</div>
                  </header>`
                : `<header class="kepala-lanjutan">
                    <span>${judulAman} — <strong>${bagianAman}</strong></span>
                    <span>Hal. ${nomor} / ${totalHalaman}</span>
                  </header>`

            const kakiDepan = [timAman, `${judulAman} — ${bagianAman}`]
              .filter(Boolean)
              .join(' · ')

            return `<section class="lembar-partitur" data-halaman="${nomor}">
              ${kepala}
              <div class="wadah-svg">${svg}</div>
              <footer class="kaki-lembar">
                <span>${kakiDepan}</span>
                <span>Dicetak ${tanggalAman} · Hal. ${nomor} / ${totalHalaman}</span>
              </footer>
            </section>`
          })
          .join('\n')

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${judulDokumen}</title>
  <style>
    @page {
      size: ${spec.cssPageSize};
      margin: ${spec.cssPageMargin};
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: ${PALET_CETAK_PARTITUR.latarPratinjau};
      color: ${PALET_CETAK_PARTITUR.tinta};
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .bilah-atas {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 16px;
      background: ${PALET_CETAK_PARTITUR.bilahAtas};
      color: ${PALET_CETAK_PARTITUR.teksBilah};
      border-bottom: 1px solid ${PALET_CETAK_PARTITUR.tintaSub};
    }
    .bilah-info {
      font-size: 13px;
      line-height: 1.4;
    }
    .bilah-sub {
      color: ${PALET_CETAK_PARTITUR.teksBilahRedup};
      font-size: 11px;
    }
    .tombol-cetak {
      appearance: none;
      border: 0;
      border-radius: 6px;
      padding: 7px 14px;
      background: ${PALET_CETAK_PARTITUR.tombolCetak};
      color: ${PALET_CETAK_PARTITUR.tombolCetakTeks};
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .daftar-lembar {
      padding: 16px;
    }
    .lembar-partitur {
      width: 100%;
      max-width: ${spec.lebarMm}mm;
      margin: 0 auto 16px auto;
      padding: ${data.ukuranKertas === 'A5_L' ? '6mm 8mm' : '8mm 10mm'};
      background: ${PALET_CETAK_PARTITUR.kertas};
      color: ${PALET_CETAK_PARTITUR.tinta};
      border: 1px solid ${PALET_CETAK_PARTITUR.garis};
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .kepala-utama {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 6px;
      border-bottom: 1.5px solid ${PALET_CETAK_PARTITUR.tinta};
    }
    .nama-tim {
      font-size: 9pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: ${PALET_CETAK_PARTITUR.tintaSub};
    }
    .judul-lagu {
      margin: 1px 0 0 0;
      font-size: ${data.ukuranKertas === 'A5_L' ? '12pt' : '14pt'};
      font-weight: 700;
      color: ${PALET_CETAK_PARTITUR.tinta};
    }
    .meta-lagu {
      margin-top: 2px;
      font-size: 8.5pt;
      color: ${PALET_CETAK_PARTITUR.tintaSub};
    }
    .lencana-bagian {
      flex-shrink: 0;
      padding: 3px 9px;
      border: 1.5px solid ${PALET_CETAK_PARTITUR.tinta};
      border-radius: 4px;
      background: ${PALET_CETAK_PARTITUR.lencanaLatar};
      color: ${PALET_CETAK_PARTITUR.tinta};
      font-size: 9.5pt;
      font-weight: 700;
    }
    .kepala-lanjutan {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 3px;
      border-bottom: 1px solid ${PALET_CETAK_PARTITUR.garis};
      font-size: 8.5pt;
      color: ${PALET_CETAK_PARTITUR.tintaSub};
    }
    .wadah-svg {
      width: 100%;
      background: ${PALET_CETAK_PARTITUR.kertas};
    }
    .kaki-lembar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding-top: 4px;
      border-top: 1px solid ${PALET_CETAK_PARTITUR.garis};
      font-size: 8pt;
      color: ${PALET_CETAK_PARTITUR.tintaKaki};
    }
    .kosong-catatan {
      margin: 24px 0;
      font-size: 10pt;
      color: ${PALET_CETAK_PARTITUR.tintaSub};
    }
    @media print {
      .no-print { display: none !important; }
      html, body {
        background: ${PALET_CETAK_PARTITUR.kertas};
      }
      .daftar-lembar {
        padding: 0;
      }
      .lembar-partitur {
        max-width: none;
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        break-after: page;
        page-break-after: always;
      }
      .lembar-partitur:last-child {
        break-after: auto;
        page-break-after: auto;
      }
    }
  </style>
</head>
<body>
  <div class="bilah-atas no-print">
    <div>
      <div class="bilah-info"><strong>${judulAman}</strong> · ${bagianAman}</div>
      <div class="bilah-sub">${escHtmlPartitur(spec.label)} · ${totalHalaman} halaman · Gunakan Ctrl+P atau tombol di kanan untuk mencetak / simpan ke PDF</div>
    </div>
    <button type="button" class="tombol-cetak" onclick="window.print()">Cetak / Simpan PDF</button>
  </div>
  <main class="daftar-lembar">
    ${lembarHtml}
  </main>
</body>
</html>`
}

function rapikanSegmenNamaBerkas(teks: string, cadangan: string): string {
  const bersih = teks
    .replace(/[/\\:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim()
  return bersih || cadangan
}

/**
 * Nama berkas jelas selaras konvensi #7:
 * `DrillKit - PARTITUR - Mars Latihan Sore - Trumpet 1 (A4 Tegak).html`
 */
export function namaBerkasCetakPartitur(
  judulLagu: string,
  labelBagian: string,
  ukuranKertas: UkuranKertasPartitur,
): string {
  const spec =
    SPESIFIKASI_KERTAS_PARTITUR[ukuranKertas] ?? SPESIFIKASI_KERTAS_PARTITUR.A4_P
  const j = rapikanSegmenNamaBerkas(judulLagu, 'Lagu')
  const b = rapikanSegmenNamaBerkas(labelBagian, 'Full Score')
  return `DrillKit - PARTITUR - ${j} - ${b} (${spec.labelPendek}).html`
}
