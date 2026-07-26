import type { CSSProperties, ReactNode } from 'react'

export type MapIconName =
  | 'area'
  | 'cancel'
  | 'data'
  | 'delete'
  | 'finish'
  | 'globe'
  | 'layers'
  | 'line'
  | 'magnifier'
  | 'moon'
  | 'more'
  | 'point'
  | 'redo'
  | 'search'
  | 'settings'
  | 'snap'
  | 'sun'
  | 'undo'

const paths: Record<MapIconName, ReactNode> = {
  area: (
    <>
      <path d="M4 20h16L4 4v16z" />
      <path d="M7 17h6L7 11v6z" />
      <path d="M4 8h2M4 12h3M4 16h2M8 20v-2M12 20v-3M16 20v-2" />
    </>
  ),
  cancel: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6M9 9l6 6" />
    </>
  ),
  data: <path d="M3 6h18M3 12h18M3 18h18" />,
  delete: (
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
  ),
  finish: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 5-5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3c-2.4 2.5-3.6 5.5-3.6 9S9.6 18.5 12 21" />
    </>
  ),
  layers: <path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" />,
  line: (
    <>
      <path d="M21.3 6.7 17.3 2.7a2 2 0 0 0-2.8 0L2.7 14.5a2 2 0 0 0 0 2.8l4 4a2 2 0 0 0 2.8 0L21.3 9.5a2 2 0 0 0 0-2.8z" />
      <path d="m7.5 18.5 2-2M10.5 15.5l3-3M13.5 12.5l2-2M16.5 9.5l3-3" />
    </>
  ),
  magnifier: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m15.5 15.5 4.5 4.5" />
    </>
  ),
  moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5z" />,
  more: <path d="M12 5.5h.01M12 12h.01M12 18.5h.01" strokeWidth="3.5" />,
  point: (
    <>
      <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  redo: <path d="m15 14 5-5-5-5M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </>
  ),
  settings: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  snap: (
    <>
      <path d="M6 3v6a6 6 0 0 0 12 0V3h-4v6a2 2 0 0 1-4 0V3H6z" fill="currentColor" stroke="none" />
      <path d="M6 3h4v3H6zm8 0h4v3h-4z" fill="currentColor" opacity="0.6" stroke="none" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  undo: <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />,
}

export function MapIcon(props: { name: MapIconName; style?: CSSProperties }) {
  return (
    <svg aria-hidden="true" focusable="false" style={props.style} viewBox="0 0 24 24">
      {paths[props.name]}
    </svg>
  )
}
