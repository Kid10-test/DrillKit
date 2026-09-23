import React from 'react'

/** Set ikon inline (SVG) — biar tetap ringan dan jalan offline tanpa CDN. */
type P = { className?: string; size?: number }

const wrap = (path: React.ReactNode, viewBox = '0 0 24 24') =>
  function Icon({ className, size = 20 }: P) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {path}
      </svg>
    )
  }

export const IconHome = wrap(
  <>
    <path d="m3 10.5 9-7 9 7" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </>,
)

export const IconUsers = wrap(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>,
)

export const IconCheck = wrap(<path d="m4 12.5 5 5L20 6.5" />)

export const IconCalendar = wrap(
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 11h18" />
  </>,
)

export const IconGrid = wrap(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16M15 4v16M3 10h18M3 14h18" />
  </>,
)

export const IconMusic = wrap(
  <>
    <path d="M9 18V5l10-2v13" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </>,
)

export const IconShare = wrap(
  <>
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    <path d="M16 6l-4-4-4 4" />
    <path d="M12 2v13" />
  </>,
)

export const IconSettings = wrap(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </>,
)

export const IconPlus = wrap(<path d="M12 5v14M5 12h14" />)

export const IconSearch = wrap(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
)

export const IconQr = wrap(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3zM20 14v3M14 20h3v3h-3z" />
  </>,
)

export const IconPlay = wrap(<path d="M6 4l14 8-14 8V4z" />)

export const IconPause = wrap(
  <>
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </>,
)

export const IconDownload = wrap(
  <>
    <path d="M12 3v12" />
    <path d="m7 11 5 5 5-5" />
    <path d="M4 21h16" />
  </>,
)

export const IconUpload = wrap(
  <>
    <path d="M12 17V5" />
    <path d="m7 9 5-5 5 5" />
    <path d="M4 21h16" />
  </>,
)

export const IconTrash = wrap(
  <>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    <path d="M9 7V4h6v3" />
  </>,
)

/** M5 — ulang: panah melingkar, dipakai tombol "Ulang" di metronom. */
export const IconLoop = wrap(
  <>
    <path d="M17 2.5 20.5 6 17 9.5" />
    <path d="M3.5 11V9a3 3 0 0 1 3-3h14" />
    <path d="M7 21.5 3.5 18 7 14.5" />
    <path d="M20.5 13v2a3 3 0 0 1-3 3h-14" />
  </>,
)

export const IconChevronLeft = wrap(<path d="m14 6-6 6 6 6" />)
export const IconChevronRight = wrap(<path d="m10 6 6 6-6 6" />)
export const IconCopy = wrap(
  <>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </>,
)
export const IconEye = wrap(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </>,
)
export const IconLock = wrap(
  <>
    <rect x="4" y="10" width="16" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </>,
)
export const IconMic = wrap(
  <>
    <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
    <path d="M8 21h8" />
  </>,
)
/** Ikon bendera — dipakai menu run sheet hari lomba. */
export const IconFlag = wrap(
  <>
    <path d="M5 21V4" />
    <path d="M5 4h11l-1.5 3.5L16 11H5" />
  </>,
)
export const IconPrinter = wrap(
  <>
    <path d="M6 9V3h12v6" />
    <rect x="4" y="9" width="16" height="8" rx="2" />
    <path d="M8 17h8v4H8z" />
  </>,
)

/** Ikon "layar penuh" — dipakai tombol mode presenter. */
export const IconExpand = wrap(
  <>
    <path d="M4 9V5a1 1 0 0 1 1-1h4" />
    <path d="M20 9V5a1 1 0 0 0-1-1h-4" />
    <path d="M4 15v4a1 1 0 0 0 1 1h4" />
    <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
  </>,
)
