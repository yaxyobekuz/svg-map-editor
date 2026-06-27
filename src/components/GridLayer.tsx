/**
 * A pixel grid drawn purely with CSS gradients, sitting between the map and the
 * SVG overlay.
 *
 * Behaviour (hybrid, Figma-over-map style):
 *  - PAN: the grid follows the map. The parent (MapCanvas) projects a fixed
 *    geographic anchor to pixels each frame and passes `offsetX/offsetY`
 *    (the anchor's position modulo the cell size) which we apply as
 *    `background-position` — so lines track the terrain as you drag.
 *  - ZOOM: the cell size is a constant pixel value, so the grid does NOT scale
 *    or jitter when zooming. (Only the offset shifts, by whole-cell modulo, so
 *    the pattern stays put.)
 *
 * Because it's a compositor-painted CSS gradient, updating only the
 * `background-position` string per frame is cheap and never tears down DOM.
 */

import { useEditor } from '../store'

/** Minor line color/thickness. */
const MINOR_COLOR = 'rgba(255,255,255,0.18)'
const MINOR_WIDTH = 1.5
/** Major (every 5th) line color/thickness. */
const MAJOR_COLOR = 'rgba(255,255,255,0.32)'
const MAJOR_WIDTH = 2

export function GridLayer({
  offsetX,
  offsetY,
}: {
  offsetX: number
  offsetY: number
}) {
  const gridVisible = useEditor((s) => s.gridVisible)
  const gridSize = useEditor((s) => s.gridSize)

  if (!gridVisible) return null

  const major = gridSize * 5

  const minorLines = `
    repeating-linear-gradient(to right, ${MINOR_COLOR} 0 ${MINOR_WIDTH}px, transparent ${MINOR_WIDTH}px ${gridSize}px),
    repeating-linear-gradient(to bottom, ${MINOR_COLOR} 0 ${MINOR_WIDTH}px, transparent ${MINOR_WIDTH}px ${gridSize}px)
  `
  const majorLines = `
    repeating-linear-gradient(to right, ${MAJOR_COLOR} 0 ${MAJOR_WIDTH}px, transparent ${MAJOR_WIDTH}px ${major}px),
    repeating-linear-gradient(to bottom, ${MAJOR_COLOR} 0 ${MAJOR_WIDTH}px, transparent ${MAJOR_WIDTH}px ${major}px)
  `

  // Same offset for all four gradient layers so minor + major stay aligned.
  const pos = `${offsetX}px ${offsetY}px`

  return (
    <div
      className="grid-layer"
      style={{
        backgroundImage: `${majorLines}, ${minorLines}`,
        backgroundPosition: `${pos}, ${pos}, ${pos}, ${pos}`,
      }}
    />
  )
}
