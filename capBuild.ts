/**
 * N5 — cap waktu build, dibaca dari konstanta yang disuntikkan Vite.
 *
 * Mengapa ini perlu: setelah pelatih mengunggah rilis baru, satu-satunya
 * cara mengetahui apakah yang berjalan adalah rilis baru atau simpanan
 * lama adalah melihat CAP-NYA. Tanpa itu ia hanya menebak, padahal
 * perbaikan untuk "simpanan lama" (tutup lalu buka kembali) berbeda
 * sama sekali dari perbaikan untuk "unggahan gagal" (unggah ulang).
 */

/** Cap ISO dari saat aplikasi dirakit. */
export const capBuild: string = typeof __CAP_BUILD__ === 'string' ? __CAP_BUILD__ : ''

/** Capnya dalam bentuk yang bisa dibaca orang, memakai lokal Indonesia. */
export function capBuildTeks(): string {
  if (!capBuild) return 'tidak diketahui'
  const d = new Date(capBuild)
  if (Number.isNaN(d.getTime())) return capBuild
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Singkatnya saja — dipakai di bilah sisi, yang tempatnya sempit.
 * Sengaja menyertakan menitnya: dua rilis pada hari yang sama tetap
 * harus bisa dibedakan.
 */
export function capBuildSingkat(): string {
  if (!capBuild) return 'versi?'
  const d = new Date(capBuild)
  if (Number.isNaN(d.getTime())) return capBuild
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
