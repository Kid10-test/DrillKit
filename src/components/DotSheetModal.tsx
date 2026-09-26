/**
 * Diekstrak dari `src/pages/Drill.tsx` (#5 — pecah Drill.tsx).
 * Isinya tidak diubah; hanya alamat impor yang disesuaikan.
 */

/** Dot sheet A4 & buku saku lipat per pemain (pratinjau + unduh + cetak). */
import { useState } from 'react'
import { namaTampil } from '../lib/namaAnggota'
import { useModeNama } from './NamaTampil'
import type {
  Drill,
  DrillSet,
  Member,
} from '../db/types'
import {
  Button,
  Field,
  Modal,
  Select,
  Textarea,
  useToast,
} from './ui'
import {
  IconDownload,
  IconEye,
  IconPrinter,
} from './Icons'
import { barisPenandaCetak } from './FieldMarkers'

import {
  coordText as coorTextSafe,
  panahArah,
  patokOf,
  stepYd,
} from '../lib/field'
import {
  TINGKAT_WARNA,
  type MetrikPemain,
  analisisPerpindahan,
} from '../lib/analitik'
import { downloadHtmlFile, esc, printHtml, printShell } from '../lib/print'
import {
  sectionLabel,
  slugify,
} from '../lib/utils'
import { useSettings } from '../hooks/useSettings'

/* ========================================================================== */
/*  Dot sheet (A4) & buku saku per pemain                                      */
/* ========================================================================== */

/**
 * DD8 — sel "langkah per hitungan" untuk buku saku & dot sheet.
 *
 * Diwarnai hanya kalau gerakannya berat atau mustahil, supaya tinta cetak
 * tetap hemat dan yang menonjol memang cuma yang perlu diperhatikan.
 */
function selLangkahPerCount(met?: MetrikPemain): string {
  if (!met) return '<span class="muted">-</span>'
  const n = Math.round(met.langkahPerCount * 100) / 100
  if (met.tingkat === 'berat' || met.tingkat === 'mustahil') {
    return `<span style="color:${TINGKAT_WARNA[met.tingkat]};font-weight:700">${n}</span>`
  }
  return `<span class="mono">${n}</span>`
}

/**
 * DD10b — ukuran langkah (inci) yang harus dipakai pemain.
 *
 * Di mode `tetap` angkanya selalu sama (22,5″ = 8-to-5), jadi kolom ini
 * sekadar pengingat. Di mode `menyesuaikan` justru di sinilah kabar
 * pentingnya: ritme terkunci pada hitungan, dan yang mengecil atau membesar
 * adalah **panjang langkahnya**. Sama seperti Lk/cnt, warna hanya dipakai
 * kalau langkahnya berat atau mustahil — supaya tinta tetap hemat.
 */
function selUkuranLangkah(met?: MetrikPemain): string {
  if (!met) return '<span class="muted">-</span>'
  if (!Number.isFinite(met.ukuranLangkahInci)) return '<span class="muted">-</span>'
  const n = Math.round(met.ukuranLangkahInci * 10) / 10
  if (met.tingkatLangkah === 'berat' || met.tingkatLangkah === 'mustahil') {
    return `<span style="color:${TINGKAT_WARNA[met.tingkatLangkah]};font-weight:700">${n}&Prime;</span>`
  }
  return `<span class="mono">${n}&Prime;</span>`
}

/**
 * DD8 — kompas kecil yang dicetak **sekali** di kepala kartu, bukan di tiap
 * baris.
 *
 * Inilah kunci supaya buku saku tidak kebanjiran informasi: karena arah
 * dijelaskan satu kali, tiap baris cukup diberi **satu panah** — tidak perlu
 * kata-kata, dan jumlah kolom tidak bertambah.
 *
 * Arah memakai patokan **lapangan** (S1/S2, penonton/belakang), bukan
 * kiri/kanan, supaya tidak rancu dengan sudut pandang pemain.
 */
function kompasHtml(pakaiPatok: boolean): string {
  const legenda = pakaiPatok
    ? `<b>A</b> = tengah lapangan &middot; <b>&minus;</b> mendekati A &middot; <b>+</b> menjauhi A<br>
  <span class="mono">C&#39;</span> = C di seberang A (sisi S2) &middot; panah = arah jalan`
    : `panah = arah jalan (mata angin tetap, tidak ikut hadap pemain)`
  return `<div class="kompas">
  <svg viewBox="0 0 40 40" width="34" height="34" style="flex:none">
    <rect x="1" y="1" width="38" height="38" fill="none" stroke="#94a3b8"/>
    <text x="20" y="9" font-size="6" text-anchor="middle" fill="#64748b">BELAKANG</text>
    <text x="20" y="36" font-size="6" text-anchor="middle" fill="#64748b">PENONTON</text>
    <text x="3" y="23" font-size="6" fill="#64748b">S1</text>
    <text x="30" y="23" font-size="6" fill="#64748b">S2</text>
    <path d="M20 30 L20 14" stroke="#334155" stroke-width="1.2"/>
    <path d="M20 14 l-3 4 M20 14 l3 4" stroke="#334155" stroke-width="1.2" fill="none"/>
  </svg>
  <div>${legenda}</div>
</div>`
}

/**
 * 2b — pembagi set ke kartu lipat: satu kartu = muka depan + muka belakang.
 *
 * Muka depan selalu diisi dulu sampai `kapDepan`; sisanya ke muka belakang.
 * Muka belakang kartu TERAKHIR memuat keterangan + catatan, jadi jatahnya
 * lebih kecil (`kapBelakangAkhir`); muka belakang kartu tengah boleh penuh
 * (`kapBelakangTengah`). Rentangnya **[dari, sampai)** dalam indeks set
 * global — pemanggil yang mengubahnya menjadi nomor baris.
 */
function rencanaKartu(
  total: number,
  kapDepan: number,
  kapBelakangAkhir: number,
  kapBelakangTengah: number,
): { depan: [number, number]; belakang: [number, number] }[] {
  const kartus: { depan: [number, number]; belakang: [number, number] }[] = []
  let i = 0
  while (i < total) {
    const d1 = Math.min(i + kapDepan, total)
    const sisa = total - d1
    const b1 = sisa <= 0 ? d1 : sisa <= kapBelakangAkhir ? total : d1 + kapBelakangTengah
    kartus.push({ depan: [i, d1], belakang: [d1, b1] })
    i = b1
  }
  // Drill tanpa set tetap menghasilkan satu kartu (kosong, bukan nol kartu).
  if (!kartus.length) kartus.push({ depan: [0, 0], belakang: [0, 0] })
  return kartus
}

export function DotSheetModal({
  open,
  onClose,
  drill,
  sets,
  roster,
}: {
  open: boolean
  onClose: () => void
  drill: Drill
  sets: DrillSet[]
  roster: Member[]
}) {
  const toast = useToast()
  const modeNama = useModeNama()
  /** Ambang kesulitan punya tim — supaya kertas & panel DD3 berkata sama. */
  const settings = useSettings()
  const [memberId, setMemberId] = useState<string>('all')
  const [notes, setNotes] = useState('')
  /** 'lipat' = kartu lipat per pemain di A4, 'a4' = lembar koordinat lega */
  const [format, setFormat] = useState<'lipat' | 'a4'>('lipat')
  /** DD8 — sertakan kolom "langkah per hitungan" di kertas. */
  const [sertakanLpc, setSertakanLpc] = useState(true)
  /** DD8 — sertakan kompas & panah arah jalan di kertas. */
  const [sertakanArah, setSertakanArah] = useState(true)
  /** DD10b — sertakan kolom "ukuran langkah" di kertas. */
  const [sertakanUkuran, setSertakanUkuran] = useState(true)
  /** HTML hasil cetak yang ditampilkan langsung di dalam aplikasi */
  const [preview, setPreview] = useState<string | null>(null)

  const sYd = stepYd(drill.field)
  const ordered = [...sets].sort((a, b) => a.order - b.order)
  const fileName = `${slugify(drill.name)}-${format === 'lipat' ? 'buku-saku' : 'dot-sheet'}`

  /** `lpc` = metrik gerak per perpindahan (DD3), dipakai untuk kolom Lk/cnt. */
  function rowsFor(
    m: Member,
    compact: boolean,
    lpc: Map<string, MetrikPemain>[],
    dari = 0,
    sampai = ordered.length,
  ): string {
    const tambah = (sertakanLpc ? 1 : 0) + (sertakanUkuran ? 1 : 0)
    const kosong = (compact ? 2 : 4) + tambah
    // 2b — kartu lipat mencetak set dalam rentang [dari, sampai); nomor
    // baris tetap nomor set global (i + 1), bukan nomor di dalam muka.
    return ordered
      .slice(dari, sampai)
      .map((set, k) => {
        const i = dari + k
        const p = set.points[m.id]
        const next = ordered[i + 1]?.points[m.id]
        if (!p)
          return `<tr><td>${i + 1}</td><td>${esc(set.name)}</td><td colspan="${kosong}" class="muted">— tidak di lapangan —</td></tr>`
        const met = lpc[i]?.get(m.id)
        /**
         * DD10b — angka yang dicetak adalah **jumlah langkah yang benar-benar
         * dijalankan pemain**, jadi mengikuti modenya: mode `tetap` dihitung
         * dari jarak (dan sudah mengikuti jalur, termasuk lengkungan), mode
         * `menyesuaikan` dihitung dari hitungan. Karena itu angkanya selalu
         * sejalan dengan kolom Lk/cnt: langkah ÷ count = Lk/cnt.
         */
        const dist = next
          ? Math.round(met ? met.jarakLangkah : Math.hypot(next.x - p.x, next.y - p.y) / sYd)
          : 0
        const durasi = ((set.counts * drill.beatsPerCount * 60) / Math.max(20, drill.tempo)).toFixed(1)
        const koordinat = coorTextSafe(p.x, p.y, drill.field)
        // DD8 — panah arah jalan, mengikuti orientasi gambar chart (lihat kompas).
        const arah = next ? panahArah(next.x - p.x, next.y - p.y) : ''
        const panahHtml = sertakanArah && arah ? ` <span class="panah">${arah}</span>` : ''
        // DD8 — langkah per hitungan untuk perpindahan dari set ini ke berikutnya.
        const selLpc = sertakanLpc ? `<td>${selLangkahPerCount(met)}</td>` : ''
        const selUk = sertakanUkuran ? `<td>${selUkuranLangkah(met)}</td>` : ''
        if (compact) {
          return `<tr><td>${i + 1}</td><td>${esc(set.name)}</td><td>${set.counts}</td><td class="mono">${esc(koordinat)}</td><td>${next ? dist : '-'}${panahHtml}</td>${selLpc}${selUk}</tr>`
        }
        return `<tr>
          <td>${i + 1}</td>
          <td>${esc(set.name)}</td>
          <td>${set.counts}</td>
          <td class="mono">${esc(koordinat)}</td>
          <td>${Math.round((p.x / sYd) * 4) / 4}</td>
          <td>${Math.round(((p.y + drill.field.widthYd / 2) / sYd) * 4) / 4}</td>
          <td>${next ? `${dist} (${durasi}s)` : '-'}${panahHtml}</td>
          ${selLpc}
          ${selUk}
        </tr>`
      })
      .join('')
  }

  function buildHtml(): string {
    const lipat = format === 'lipat'
    const targets = memberId === 'all' ? roster : roster.filter((m) => m.id === memberId)
    /**
     * DD8 — metrik gerak dihitung **sekali** untuk semua perpindahan, lalu
     * dipakai bersama oleh semua pemain. Sengaja tidak dihitung per pemain:
     * untuk 60 pemain × 20 set itu akan jadi 1.200 perhitungan yang isinya
     * berulang.
     */
    /**
     * Metrik ini sekarang selalu dihitung, bukan hanya saat kolom Lk/cnt
     * dicetak: angka di kolom "Langkah & arah" juga bergantung pada mode
     * langkah (DD10b), jadi harus tersedia meski kolomnya disembunyikan.
     */
    const lpc = ordered.map((s, i) => {
      const h = analisisPerpindahan(
        s,
        ordered[i + 1],
        roster,
        sYd,
        drill.tempo,
        drill.beatsPerCount,
        undefined,
        drill.setelanLangkah,
        settings?.ambangGerak,
        drill.setelanJarak,
      )
      return new Map(h.daftar.map((d) => [d.id, d]))
    })
    /**
     * Kepala tabel set — dipakai tiga tempat: muka depan, muka belakang,
     * dan lembar A4. Judul kolomnya kontrak dengan uji (`sel()` di
     * `qa/alat-buku-saku.mjs`): kolom dicari lewat judul, bukan posisinya.
     */
    function kepalaTabel(compact: boolean): string {
      // 2b — di kartu lipat kolomnya sempit, jadi judul panjang dipenggal
      // paksa dua baris. Spasi di sekitar `<br>` disengaja: `textContent`-nya
      // harus tetap terbaca "Langkah & arah" (kontrak dengan uji).
      const langkah = sertakanArah ? 'Langkah &amp; arah' : '&#8594; langkah'
      const kepalaLangkah = compact
        ? `<th>${sertakanArah ? 'Langkah <br>&amp; arah' : langkah}</th>`
        : `<th>X (langkah)</th><th>Y (langkah)</th><th>Langkah${sertakanArah ? ' &amp; arah' : ''}</th>`
      const kepalaLpc = sertakanLpc ? `<th>${compact ? 'Lk/<br>cnt' : 'Lk/cnt'}</th>` : ''
      const kepalaUk = sertakanUkuran ? `<th>${compact ? 'Ukuran <br>langkah' : 'Ukuran langkah'}</th>` : ''
      return `<thead><tr>
            <th>#</th><th>Set</th><th>Cnt</th><th>Koordinat</th>
            ${kepalaLangkah}
            ${kepalaLpc}
            ${kepalaUk}
          </tr></thead>`
    }

    /** Keterangan kolom — di kartu lipat hanya dicetak di kartu terakhir. */
    function legendaHtml(): string {
      return `${sertakanLpc
        ? `<p class="legend">Lk/cnt = langkah per hitungan pada ${drill.tempo} BPM, ${drill.beatsPerCount} ketuk/count — jawabannya <i>apakah aku harus berlari</i>. Angka berwarna: <span style="color:${TINGKAT_WARNA.berat};font-weight:700">berat</span> atau <span style="color:${TINGKAT_WARNA.mustahil};font-weight:700">mustahil</span> diselesaikan.</p>`
        : ''}${sertakanUkuran
        ? `<p class="legend"><b>Ukuran langkah</b> = panjang satu langkah yang harus dipakai, dalam inci — jawabannya <i>mampukah kakiku melangkah sejauh itu</i>. Bawaan 22,5&Prime; (8-to-5). Di atas 30&Prime; (6-to-5) mulai berat, di atas 45&Prime; (4-to-5) praktis mustahil.${drill.setelanLangkah?.mode === 'menyesuaikan' ? ' Mode drill ini <b>menyesuaikan</b>: jumlah langkah mengikuti hitungan, jadi ukuran langkahnya yang berubah-ubah.' : ''}${(drill.setelanJarak ?? 'jalur') === 'lurus' ? ' Jarak dihitung sebagai <b>garis lurus</b> dari titik awal ke akhir, bukan jarak tempuh kaki.' : ''}</p>`
        : ''}`
    }

    /**
     * 2b — lebar kolom tabel lipat. Muka kartu tingginya TETAP (135 mm),
     * jadi tinggi baris harus tetap juga: tabel memakai `table-layout:
     * fixed` dan sel tidak boleh melipat (`white-space: nowrap` + elipsis
     * di CSS). Nama set yang kepanjangan terpotong berelipsis di kertas —
     * tetapi teks selnya utuh (yang dipotong hanya tampilannya).
     */
    function kolomLipat(): string {
      // [ditampilkan, bobot] — bobot dinormalisasi ke 100%.
      const defs: [boolean, number][] = [
        [true, 6], // #
        [true, 16], // Set (satu-satunya kolom yang boleh terelipsis)
        [true, 7], // Cnt
        [true, 38], // Koordinat (±27 karakter mono — tak boleh terpotong)
        [true, 12], // Langkah & arah
        [sertakanLpc, 9], // Lk/cnt
        [sertakanUkuran, 12], // Ukuran langkah
      ]
      const pakai = defs.filter(([tampil]) => tampil)
      const total = pakai.reduce((s, [, b]) => s + b, 0)
      const cols = pakai.map(([, b]) => `<col style="width:${Math.round((b / total) * 1000) / 10}%">`).join('')
      return `<colgroup>${cols}</colgroup>`
    }

    /** Kepala muka depan kartu: nama pemain + nama drill. */
    function kepalaMuka(m: Member): string {
      return `<header>
          <div>
            <h2>${esc(m.name)} <span class="code">${esc(m.code)}</span></h2>
            <p class="sub">${esc(sectionLabel(m.section))} · ${esc(m.instrument || '-')}</p>
          </div>
          <div class="right">
            <p class="sub">${esc(drill.name)}</p>
            <p class="sub">${drill.tempo} BPM · ${drill.beatsPerCount} ketuk/count</p>
          </div>
        </header>`
    }

    if (lipat) {
      /**
       * Kapasitas baris per muka, diukur dari hasil render Chromium (96 dpi):
       * satu baris 13 px (sel satu baris berelipsis — lihat `kolomLipat`),
       * muka setinggi 508 px. Muka depan memuat kepala (26) + kompas (40) +
       * tabel; muka belakang kartu terakhir memuat tabel + keterangan
       * (±72) + catatan; muka belakang kartu tengah hanya tabel. Semua
       * angka ±10% di bawah hasil ukur — sisa ruang dibiarkan kosong
       * daripada satu piksel terpotong di font lain.
       */
      const KAP_DEPAN = sertakanArah ? 27 : 30
      const KAP_BELAKANG_TENGAH = 32
      let kapBelakang = 24 + (sertakanLpc ? 0 : 2) + (sertakanUkuran ? 0 : 3)
      kapBelakang -= Math.ceil(notes.trim().length / 90) // ±90 karakter per baris catatan
      kapBelakang = Math.max(4, kapBelakang)

      /** Satu lembaran kartu (190 × 135 mm) milik satu pemain. */
      function kartuHtml(
        m: Member,
        r: { depan: [number, number]; belakang: [number, number] },
        k: number,
        nKartu: number,
      ): string {
        const [d0, d1] = r.depan
        const [b0, b1] = r.belakang
        const terakhir = k === nKartu - 1
        const labelDepan = d1 > d0 ? `Set ${d0 + 1}–${d1}` : 'Belum ada set'
        const kakiDepan =
          b1 > b0
            ? `${labelDepan} · bersambung ke muka belakang →`
            : nKartu > 1
              ? `${labelDepan} · kartu ${k + 1}/${nKartu}`
              : labelDepan
        const isiBelakang =
          b1 > b0
            ? `<p class="sambung">← sambungan Set ${b0 + 1}–${b1} · ${esc(m.name)} <span class="code">${esc(m.code)}</span></p>
               <table>${kolomLipat()}${kepalaTabel(true)}<tbody>${rowsFor(m, true, lpc, b0, b1)}</tbody></table>`
            : ordered.length > 0
              ? nKartu > 1
                ? `<p class="muka-penuh">Set ${d0 + 1}–${d1} selesai di muka depan.</p>`
                : `<p class="muka-penuh">Seluruh ${ordered.length} set ada di muka depan.</p>`
              : ''
        const ekorBelakang = terakhir
          ? `${legendaHtml()}${notes.trim() ? `<p class="notes">${esc(notes)}</p>` : ''}<p class="kaki">muka belakang · kartu ${k + 1}/${nKartu} · ${new Date().toLocaleDateString('id-ID')}</p>`
          : `<p class="kaki">kartu ${k + 1}/${nKartu} · bersambung ke kartu ${k + 2} →</p>`
        return `<section class="kartu" data-pemain="${esc(m.name)}" data-kartu="${k + 1}/${nKartu}">
        <span class="gunting tl">✂</span><span class="gunting tr">✂</span><span class="gunting bl">✂</span><span class="gunting br">✂</span>
        <span class="lipat atas">— LIPAT —</span><span class="lipat bawah">— LIPAT —</span>
        <div class="muka depan">
          ${kepalaMuka(m)}
          ${sertakanArah ? kompasHtml(patokOf(drill.field).aktif === 1) : ''}
          <table>${kolomLipat()}${kepalaTabel(true)}<tbody>${rowsFor(m, true, lpc, d0, d1)}</tbody></table>
          <p class="kaki">${kakiDepan}</p>
        </div>
        <div class="muka">
          ${isiBelakang}
          ${ekorBelakang}
        </div>
      </section>`
      }

      const semuaKartu = targets.flatMap((m) =>
        rencanaKartu(ordered.length, KAP_DEPAN, kapBelakang, KAP_BELAKANG_TENGAH).map((r, k, semua) =>
          kartuHtml(m, r, k, semua.length),
        ),
      )
      // Dua kartu per lembar A4, lengkap dengan garis potong di antaranya.
      const pisah =
        '<div class="antar"><span>✂</span><div class="garis"></div><span>potong</span><div class="garis"></div><span>✂</span></div>'
      const halaman: string[] = []
      for (let i = 0; i < semuaKartu.length; i += 2) {
        halaman.push(`<div class="halaman">${semuaKartu.slice(i, i + 2).join(pisah)}</div>`)
      }
      const penanda = barisPenandaCetak(drill.markers ?? [], sYd)
      if (penanda) halaman.push(`<div class="halaman">${penanda}</div>`)

      return printShell(
        `${drill.name} — Buku saku`,
        halaman.join(''),
        `@page { size: A4 portrait; margin: 8mm; }
         .halaman { width: 194mm; page-break-after: always; }
         .halaman:last-child { page-break-after: auto; }
         .kartu { width:190mm; height:135mm; margin:0 2mm; border:.5mm solid #111; box-sizing:border-box; display:flex; position:relative; background:#fff; page-break-inside:avoid; }
         .muka { flex:1 1 0; min-width:0; box-sizing:border-box; padding:3.5mm 4mm; overflow:hidden; }
         .muka.depan { border-right:.4mm dashed #555; }
         .antar { height:6mm; margin:0 2mm; display:flex; align-items:center; gap:2mm; color:#888; font-size:8px; white-space:nowrap; }
         .antar .garis { flex:1; border-top:.3mm dashed #999; }
         .gunting { position:absolute; color:#666; font-size:9px; line-height:1; }
         .gunting.tl { top:.5mm; left:1mm; }
         .gunting.tr { top:.5mm; right:1mm; }
         .gunting.bl { bottom:.5mm; left:1mm; }
         .gunting.br { bottom:.5mm; right:1mm; }
         .lipat { position:absolute; left:50%; transform:translateX(-50%); background:#fff; padding:0 2mm; font-size:6px; letter-spacing:.12em; color:#555; white-space:nowrap; }
         .lipat.atas { top:-1.6mm; }
         .lipat.bawah { bottom:-1.6mm; }
         h2 { font-size: 11px; margin: 0 0 1px; }
         header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 4px; }
         .right { text-align:right; }
         .code { font-family: ui-monospace, monospace; font-size: 8px; background:#eee; padding:0 4px; border-radius:3px; }
         .sub { font-size: 7px; color:#555; margin:0; }
         table { width:100%; border-collapse: collapse; font-size: 7.5px; table-layout: fixed; }
         th, td { border: 1px solid #999; text-align:left; padding: 1px 2.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
         th { background:#f0f0f0; text-transform: uppercase; white-space: normal; font-size: 6.5px; padding: 1px; }
         .mono { font-family: ui-monospace, monospace; white-space: nowrap; }
         .muted { color:#888; text-align:center; }
         .panah { font-size: 9px; }
         .kompas { display:flex; gap:4px; align-items:center; margin-bottom:3px; padding:2px 3px; border:1px solid #cbd5e1; background:#f8fafc; font-size:6.5px; color:#475569; line-height:1.35; }
         .notes { margin-top: 3px; font-size: 7px; color:#333; }
         .legend { margin-top: 2px; font-size: 6.5px; color:#555; }
         .sambung { font-size: 7px; color:#333; margin: 0 0 2px; border-bottom: 1px solid #000; padding-bottom: 2px; }
         .muka-penuh { font-size: 7px; color:#555; margin: 6px 0; text-align:center; }
         .kaki { font-size: 6.5px; color:#555; margin: 3px 0 0; text-align:right; }
         .halaman .page { width:190mm; margin:0 2mm; }
         .halaman .page h2 { font-size:14px; }
         .halaman .page table { font-size:11px; table-layout:auto; }
         .halaman .page th, .halaman .page td { padding:4px 6px; white-space:normal; overflow:visible; text-overflow:clip; }`,
      )
    }

    const pages = targets
      .map(
        (m) => `<section class="page">
        ${kepalaMuka(m)}
        ${sertakanArah ? kompasHtml(patokOf(drill.field).aktif === 1) : ''}
        <table>
          ${kepalaTabel(false)}
          <tbody>${rowsFor(m, false, lpc)}</tbody>
        </table>
        ${legendaHtml()}
        ${notes.trim() ? `<p class="notes">${esc(notes)}</p>` : ''}
      </section>`,
      )
      .join('')

    const css = `@page { size: A4 portrait; margin: 14mm; }
         .page { page-break-after: always; padding-bottom: 6mm; }
         .page:last-child { page-break-after: auto; }
         h2 { font-size: 14px; margin: 0 0 2px; }
         header { border-bottom: 1.5px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
         table { font-size: 11px; }
         th, td { padding: 4px 6px; }
         .notes { margin-top: 8px; font-size: 10.5px; }
         .legend { margin-top: 4px; font-size: 9px; color:#555; }
         .kompas { display:flex; gap:8px; align-items:center; margin-bottom:6px; padding:4px 6px; border:1px solid #cbd5e1; background:#f8fafc; font-size:9px; color:#475569; line-height:1.4; }
         .panah { font-size: 12px; }`

    return printShell(
      `${drill.name} — Dot sheet`,
      `<div class="head">
         <h1>${esc(drill.name)}${drill.showTitle ? ' — ' + esc(drill.showTitle) : ''}</h1>
         <p class="sub">Lembar koordinat (dot sheet) · ${new Date().toLocaleDateString('id-ID')}</p>
       </div>
       ${pages}
       ${barisPenandaCetak(drill.markers ?? [], sYd)}`,
      `${css}
       h1 { font-size: 15px; margin: 0 0 2px; }
       .head { margin-bottom: 10px; }
       .code { font-family: ui-monospace, monospace; font-size: 12px; background:#eee; padding:0 4px; border-radius:3px; }
       .sub { font-size: 10.5px; color:#555; margin:0; }
       header { display:flex; justify-content:space-between; align-items:flex-start; }
       .right { text-align:right; }
       table { width:100%; border-collapse: collapse; }
       th, td { border: 1px solid #999; text-align:left; }
       th { background:#f0f0f0; text-transform: uppercase; letter-spacing:.03em; }
       .mono { font-family: ui-monospace, monospace; white-space: nowrap; }
       .muted { color:#888; text-align:center; }
       .notes { color:#333; }`,
    )
  }

  function doPrint() {
    const html = buildHtml()
    const ok = printHtml(html)
    if (!ok) {
      downloadHtmlFile(html, `${fileName}.html`)
      toast.push(
        'Jendela cetak diblokir browser (biasanya karena dibuka di dalam pratinjau). Berkas HTML sudah diunduh — buka di tab browser lalu Ctrl+P.',
        'info',
      )
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dot sheet & buku saku"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={() => setPreview(buildHtml())}>
            <IconEye size={14} /> Pratinjau
          </Button>
          <Button onClick={() => downloadHtmlFile(buildHtml(), `${fileName}.html`)}>
            <IconDownload size={14} /> Unduh HTML
          </Button>
          <Button variant="primary" onClick={doPrint}>
            <IconPrinter size={14} /> Cetak
          </Button>
        </>
      }
    >
      <Field label="Format kertas">
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant={format === 'lipat' ? 'primary' : 'soft'}
            onClick={() => setFormat('lipat')}
            className="flex-1"
          >
            Buku saku lipat (A4)
          </Button>
          <Button
            size="sm"
            variant={format === 'a4' ? 'primary' : 'soft'}
            onClick={() => setFormat('a4')}
            className="flex-1"
          >
            Lembar A4
          </Button>
        </div>
      </Field>
      <Field label="Pemain">
        <Select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="all">Semua pemain (satu kartu per orang)</option>
          {roster.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code} — {namaTampil(m, modeNama)}
            </option>
          ))}
        </Select>
      </Field>
      <label className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
        <input
          type="checkbox"
          checked={sertakanLpc}
          onChange={(e) => setSertakanLpc(e.target.checked)}
          className="mt-0.5 accent-sky-500"
        />
        <span>
          <b className="text-slate-300">Sertakan langkah per hitungan</b> — kolom{' '}
          <span className="font-mono">Lk/cnt</span> di tiap baris, dihitung dari jarak tempuh,
          jumlah count, dan tempo. Angka berwarna menandai gerakan yang berat atau mustahil
          diselesaikan — berguna untuk menandai bagian yang perlu dilatih pelan-pelan dulu.
        </span>
      </label>
      <label className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
        <input
          type="checkbox"
          checked={sertakanUkuran}
          onChange={(e) => setSertakanUkuran(e.target.checked)}
          className="mt-0.5 accent-sky-500"
        />
        <span>
          <b className="text-slate-300">Sertakan ukuran langkah</b> — kolom{' '}
          <span className="font-mono">Ukuran langkah</span> (inci) di tiap baris. Ini yang
          menjawab <i>panjang langkahnya berapa</i>, sedangkan{' '}
          <span className="font-mono">Lk/cnt</span> menjawab <i>apakah aku harus berlari</i>.
          Angka 22,5&Prime; = langkah 8-to-5; diwarnai kalau lebih dari 30&Prime; atau 45&Prime;.
        </span>
      </label>
      <label className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
        <input
          type="checkbox"
          checked={sertakanArah}
          onChange={(e) => setSertakanArah(e.target.checked)}
          className="mt-0.5 accent-sky-500"
        />
        <span>
          <b className="text-slate-300">Sertakan kompas &amp; panah arah</b> — satu kompas kecil di
          kepala kartu menjelaskan arah, lalu tiap baris cukup diberi satu panah. Arah mengikuti
          tampilan chart (S1/S2 · penonton/belakang), bukan arah hadap pemain, sehingga tidak
          berubah-ubah.
        </span>
      </label>
      <Field label="Catatan di kertas" hint="opsional">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="mis. Titik acuan: garis 50 & front hash. Wajib bawa metronom."
        />
      </Field>
      <div className="rounded-lg bg-slate-950/50 p-3 text-[11px] leading-relaxed text-slate-500">
        {format === 'lipat'
          ? 'Satu kartu per pemain, dua kartu per lembar A4. Potong mengikuti garis tepi (✂), lalu lipat garis putus-putus ke belakang menjadi kartu 9,5 × 13,5 cm bermuka dua. Muka depan: kepala kartu + kompas + set awal; muka belakang: sambungan set + keterangan.'
          : 'Lembar koordinat lengkap per halaman A4: nomor set, count, koordinat, posisi X/Y dalam langkah, jarak & durasi gerakan, dan (bila dicentang) langkah per hitungan.'}
      </div>
      <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-200">
        <b>Kalau tombol Cetak tidak muncul apa-apa:</b> browser sedang memblokir jendela baru
        (terjadi bila aplikasi dibuka di dalam pratinjau/iframe). Gunakan tombol{' '}
        <b>Pratinjau</b> untuk melihat hasilnya, atau <b>Unduh HTML</b> lalu buka berkasnya di tab
        browser biasa dan tekan Ctrl+P.
      </div>

      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title="Pratinjau hasil cetak"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Tutup
            </Button>
            <Button
              onClick={() => {
                if (preview) downloadHtmlFile(preview, `${fileName}.html`)
              }}
            >
              <IconDownload size={14} /> Unduh HTML
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (preview && !printHtml(preview)) {
                  toast.push('Jendela cetak diblokir browser — gunakan Unduh HTML.', 'info')
                }
              }}
            >
              <IconPrinter size={14} /> Cetak
            </Button>
          </>
        }
      >
        {preview && (
          <iframe
            title="Pratinjau cetak"
            srcDoc={preview}
            className="h-[65vh] w-full rounded-lg border border-slate-800 bg-white"
          />
        )}
      </Modal>
    </Modal>
  )
}
