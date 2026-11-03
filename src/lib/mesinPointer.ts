/**
 * #23.3 — Mesin Pointer Terpadu (`touch` / `pen` / `mouse`) & Viewport Kanvas.
 *
 * Menggantikan mode kaku tap-to-place lama dengan aturan gesture adaptif:
 *  - Mode `otomatis` membaca `PointerEvent.pointerType` (`touch`, `pen`, `mouse`).
 *  - Mode `sentuh` memaksa ergonomi tablet (seret 1 jari di area kosong = geser
 *    kanvas / pan, target tangkap >= 40 px, balon info tahan-lama / long-press).
 *  - Mode `tetikus` memaksa ergonomi desktop (seret area kosong = kotak pilih).
 */

export type ModeInputKanvas = 'otomatis' | 'sentuh' | 'tetikus'
export type PeranPointer = 'sentuh' | 'pena' | 'tetikus'
export type AlatKanvas = 'select' | 'pan' | 'lasso'

export interface ViewportKanvas {
  /** Faktor pembesaran kanvas (1 = 100% lapangan penuh, maks 4 = 400%). */
  zoom: number
  /** Koordinat X kiri-atas `viewBox` dalam satuan gambar SVG. */
  panX: number
  /** Koordinat Y kiri-atas `viewBox` dalam satuan gambar SVG. */
  panY: number
}

export const VIEWPORT_AWAL: ViewportKanvas = {
  zoom: 1,
  panX: 0,
  panY: 0,
}

export const BATAS_ZOOM_MIN = 1
export const BATAS_ZOOM_MAKS = 4
/** Ambang gerak (px layar) sebelum sentuhan dihitung sebagai geseran, bukan ketukan. */
export const AMBANG_GESER_PX = 6
/** Durasi tahan jari diam (ms) untuk memunculkan balon info kontrol / titik. */
export const DURASI_TEKAN_LAMA_MS = 450

/** Tentukan peran pointer efektif dari sakelar Mode Input + `e.pointerType`. */
export function peranPointerEfektif(
  modeInput: ModeInputKanvas,
  pointerType?: string,
): PeranPointer {
  if (modeInput === 'sentuh') return 'sentuh'
  if (modeInput === 'tetikus') return 'tetikus'
  if (pointerType === 'touch') return 'sentuh'
  if (pointerType === 'pen') return 'pena'
  return 'tetikus'
}

/**
 * Putuskan perilaku menyeret di area kanvas yang kosong:
 *  - Alat `pan` → selalu menggeser viewport (`'pan'`).
 *  - Alat `lasso` atau tombol `Alt` → menggambar poligon bebas (`'lasso'`).
 *  - Peran `'sentuh'` pada alat `select` → menggeser viewport (`'pan'`), bukan
 *    membuka kotak marquee secara tidak sengaja.
 *  - Peran `'pena'` (stylus) & `'tetikus'` → kotak pilih (`'marquee'`).
 */
export function aksiSeretKanvasKosong(opsi: {
  peran: PeranPointer
  alat: AlatKanvas
  altKey?: boolean
}): 'pan' | 'lasso' | 'marquee' {
  if (opsi.alat === 'pan') return 'pan'
  if (opsi.alat === 'lasso' || opsi.altKey) return 'lasso'
  if (opsi.peran === 'sentuh') return 'pan'
  return 'marquee'
}

/** Jepit zoom & batas geser `viewBox` agar lapangan tidak pernah hilang dari layar. */
export function jepitViewport(
  vp: ViewportKanvas,
  vw: number,
  vh: number,
): ViewportKanvas {
  const zoom = Math.min(
    BATAS_ZOOM_MAKS,
    Math.max(BATAS_ZOOM_MIN, Number.isFinite(vp.zoom) ? vp.zoom : 1),
  )
  const lebarView = vw / zoom
  const tinggiView = vh / zoom
  // Ruang napas 12% di tepi agar geser 1 jari di zoom 100% tetap terasa hidup & responsif
  const marginX = vw * 0.12
  const marginY = vh * 0.12
  const minX = -marginX
  const maxX = vw - lebarView + marginX
  const minY = -marginY
  const maxY = vh - tinggiView + marginY
  const panX = Math.min(maxX, Math.max(minX, Number.isFinite(vp.panX) ? vp.panX : 0))
  const panY = Math.min(maxY, Math.max(minY, Number.isFinite(vp.panY) ? vp.panY : 0))
  return {
    zoom: Math.round(zoom * 1000) / 1000,
    panX: Math.round(panX * 1000) / 1000,
    panY: Math.round(panY * 1000) / 1000,
  }
}

/** Susun dimensi & string `viewBox` SVG dari keadaan `ViewportKanvas`. */
export function hitungViewBoxKanvas(
  vp: ViewportKanvas,
  vw: number,
  vh: number,
): { x: number; y: number; width: number; height: number; teks: string } {
  const aman = jepitViewport(vp, vw, vh)
  const width = vw / aman.zoom
  const height = vh / aman.zoom
  return {
    x: aman.panX,
    y: aman.panY,
    width,
    height,
    teks: `${aman.panX} ${aman.panY} ${width} ${height}`,
  }
}

/** Perbesar/perkecil kanvas dengan menjaga titik `(fokusSvgX, fokusSvgY)` tetap di bawah jari/kursor. */
export function zoomSekitarTitik(
  vp: ViewportKanvas,
  faktor: number,
  fokusSvgX: number,
  fokusSvgY: number,
  vw: number,
  vh: number,
): ViewportKanvas {
  const zoomLama = Math.min(BATAS_ZOOM_MAKS, Math.max(BATAS_ZOOM_MIN, vp.zoom || 1))
  const zoomBaru = Math.min(BATAS_ZOOM_MAKS, Math.max(BATAS_ZOOM_MIN, zoomLama * faktor))
  const porsiX = (fokusSvgX - vp.panX) / (vw / zoomLama)
  const porsiY = (fokusSvgY - vp.panY) / (vh / zoomLama)
  const lebarBaru = vw / zoomBaru
  const tinggiBaru = vh / zoomBaru
  return jepitViewport(
    {
      zoom: zoomBaru,
      panX: fokusSvgX - porsiX * lebarBaru,
      panY: fokusSvgY - porsiY * tinggiBaru,
    },
    vw,
    vh,
  )
}

/** Hitung viewport baru dari gerakan cubit 2 jari (*pinch-to-zoom* + *two-finger pan*). */
export function hitungCubitDuaJari(
  awalA: { x: number; y: number },
  awalB: { x: number; y: number },
  kiniA: { x: number; y: number },
  kiniB: { x: number; y: number },
  vpAwal: ViewportKanvas,
  rectLayar: { left: number; top: number; width: number; height: number },
  vw: number,
  vh: number,
): ViewportKanvas {
  const lebarPx = Math.max(1, rectLayar.width)
  const tinggiPx = Math.max(1, rectLayar.height)
  const jarakAwal = Math.max(12, Math.hypot(awalB.x - awalA.x, awalB.y - awalA.y))
  const jarakKini = Math.max(12, Math.hypot(kiniB.x - kiniA.x, kiniB.y - kiniA.y))
  const zoomBaru = Math.min(
    BATAS_ZOOM_MAKS,
    Math.max(BATAS_ZOOM_MIN, vpAwal.zoom * (jarakKini / jarakAwal)),
  )

  const midAwalNormX = ((awalA.x + awalB.x) / 2 - rectLayar.left) / lebarPx
  const midAwalNormY = ((awalA.y + awalB.y) / 2 - rectLayar.top) / tinggiPx
  const midKiniNormX = ((kiniA.x + kiniB.x) / 2 - rectLayar.left) / lebarPx
  const midKiniNormY = ((kiniA.y + kiniB.y) / 2 - rectLayar.top) / tinggiPx

  const titikDuniaX = vpAwal.panX + midAwalNormX * (vw / vpAwal.zoom)
  const titikDuniaY = vpAwal.panY + midAwalNormY * (vh / vpAwal.zoom)

  const panX = titikDuniaX - midKiniNormX * (vw / zoomBaru)
  const panY = titikDuniaY - midKiniNormY * (vh / zoomBaru)
  return jepitViewport({ zoom: zoomBaru, panX, panY }, vw, vh)
}

/**
 * Hitung radius lingkaran tangkap tak-kasatmata dalam satuan gambar SVG agar
 * area sentuh pada layar selalu minimal `42 px` diameter (`radius >= 21 px`) di mode Sentuh.
 */
export function hitungRadiusTangkapSvg(
  lebarViewSvg: number,
  lebarElemenPx: number,
  peran: PeranPointer,
  radiusVisualSvg: number,
): number {
  const minRadiusPx = peran === 'sentuh' ? 21 : peran === 'pena' ? 14 : 0
  if (minRadiusPx <= 0) return radiusVisualSvg
  const pxAman = Math.max(160, lebarElemenPx || 720)
  const svgPerPx = lebarViewSvg / pxAman
  return Math.max(radiusVisualSvg, Math.round(minRadiusPx * svgPerPx * 100) / 100)
}
