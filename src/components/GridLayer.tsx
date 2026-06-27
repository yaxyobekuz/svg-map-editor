/**
 * A screen-fixed pixel grid, Figma-style.
 *
 * Drawn purely with CSS gradients so it's painted by the compositor and never
 * jitters. It is PINNED to the screen — it does NOT move, scale, or shift when
 * the map pans or zooms. That stability is the whole point: a vertex snapped to
 * a grid line stays on that same on-screen line no matter where you scroll, so
 * aligning elements is reliable.
 *
 * All lines are identical (no major/minor distinction).
 */

import { useEditor } from '../store'

const LINE_COLOR = 'rgba(255,255,255,0.22)'
const LINE_WIDTH = 1

export function GridLayer() {
  const gridVisible = useEditor((s) => s.gridVisible)
  const gridSize = useEditor((s) => s.gridSize)

  if (!gridVisible) return null

  // Two repeating gradients: vertical lines + horizontal lines, all uniform.
  const lines = `
    repeating-linear-gradient(to right, ${LINE_COLOR} 0 ${LINE_WIDTH}px, transparent ${LINE_WIDTH}px ${gridSize}px),
    repeating-linear-gradient(to bottom, ${LINE_COLOR} 0 ${LINE_WIDTH}px, transparent ${LINE_WIDTH}px ${gridSize}px)
  `

  return <div className="grid-layer" style={{ backgroundImage: lines }} />
}
