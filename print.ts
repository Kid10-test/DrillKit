import { downloadFile } from './utils'

/**
 * Mencetak HTML ke jendela baru lalu memanggil dialog cetak browser.
 *
 * Mengembalikan `false` kalau browser memblokir jendela baru — ini terjadi
 * misalnya saat aplikasi dibuka **di dalam iframe pratinjau** yang tidak
 * mengizinkan popup. Pemanggil wajib memberi jalan keluar lain kalau `false`
 * (lihat `downloadHtmlFile`).
 */
export function printHtml(html: string): boolean {
  try {
    const w = window.open('', '_blank', 'width=900,height=1000')
    if (!w) return false
    w.document.write(html)
    w.document.close()
    w.focus()
    // Beri jeda sebentar supaya layout & font selesai disusun sebelum dialog cetak muncul.
    w.setTimeout(() => {
      try {
        w.print()
      } catch {
        /* abaikan — pengguna masih bisa mencetak manual dari jendela itu */
      }
    }, 600)
    return true
  } catch {
    return false
  }
}

/**
 * Menyimpan HTML ke berkas. Jalan keluar saat `printHtml` diblokir:
 * pengguna tinggal membuka berkasnya di tab browser lalu Ctrl+P.
 */
export function downloadHtmlFile(html: string, filename: string) {
  downloadFile(filename, html, 'text/html')
}

/** Escape teks sebelum dimasukkan ke HTML hasil cetak. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  )
}

/** Kerangka HTML cetak bersama (judul + CSS dasar + isi). */
export function printShell(title: string, body: string, extraCss = ''): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      @media print { .no-print { display:none !important } }
      body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color:#000; margin:0; }
      ${extraCss}
    </style></head><body>${body}</body></html>`
}
