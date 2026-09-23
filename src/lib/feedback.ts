/**
 * Umpan balik singkat untuk pemindaian QR: bunyi "tit" dan getaran.
 *
 * Kenapa modul sendiri?
 * - Supaya halaman absensi tidak perlu tahu cara kerja AudioContext.
 * - Supaya kalau ada browser yang memblokir suara/getar, cukup diam
 *   di sini (semua dibungkus try/catch) tanpa merusak alur pemindaian.
 *
 * Dipakai oleh: src/components/QrScanner.tsx
 */

/** Pola nada untuk tiap jenis hasil pemindaian. */
const NADA = {
  /** Berhasil tercatat hadir — dua nada naik, terdengar "tit-tit" cerah. */
  ok: [880, 1320],
  /** Sudah tercatat sebelumnya — satu nada sedang, tidak mengagetkan. */
  dupe: [520],
  /** Kode tidak dikenal — satu nada rendah, terdengar "kurang tepat". */
  unknown: [180],
} as const

export type BeepKind = keyof typeof NADA

let ctx: AudioContext | null = null

/**
 * Mengambil AudioContext yang dipakai bersama (dibuat sekali saja).
 * Mengembalikan `null` kalau browser tidak mendukung atau menolak membuatnya.
 */
function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    // Sebagian browser membuat context dalam keadaan "suspended" sampai ada
    // sentuhan pengguna dulu. Tombol pembuka pemindai sudah cukup sebagai
    // sentuhan, jadi resume di sini aman.
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
    return ctx
  } catch {
    return null
  }
}

/**
 * Memainkan nada pendek. Aman dipanggil berulang kali (tiap kali QR terbaca).
 *
 * @param kind 'ok' = berhasil, 'dupe' = sudah tercatat, 'unknown' = kode asing.
 */
export function beep(kind: BeepKind) {
  const c = getCtx()
  if (!c) return
  try {
    NADA[kind].forEach((freq, i) => {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = c.currentTime + i * 0.07
      const vol = kind === 'unknown' ? 0.12 : 0.16
      osc.connect(gain)
      gain.connect(c.destination)
      gain.gain.setValueAtTime(vol, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
      osc.start(t)
      osc.stop(t + 0.14)
    })
  } catch {
    /* suara tidak penting — jangan sampai menggagalkan absensi */
  }
}

/**
 * Menggetarkan perangkat kalau didukung (HP Android; iOS Safari tidak mendukung).
 *
 * @param kind Dipakai untuk memilih pola getar.
 */
export function buzz(kind: BeepKind) {
  try {
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }
    if (typeof nav.vibrate !== 'function') return
    if (kind === 'ok') nav.vibrate(45)
    else if (kind === 'dupe') nav.vibrate(25)
    else nav.vibrate([60, 50, 60])
  } catch {
    /* abaikan */
  }
}

/** Menutup AudioContext kalau tidak dipakai lagi (menghemat baterai). */
export function closeBeep() {
  try {
    ctx?.close().catch(() => undefined)
  } catch {
    /* abaikan */
  }
  ctx = null
}
