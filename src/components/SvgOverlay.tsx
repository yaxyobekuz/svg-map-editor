/**
 * The SVG editing surface that sits on top of the Google Map.
 *
 * Every render it re-projects each shape's geo vertices into pixels via the live
 * `Projector`, so shapes stay locked to the map as it pans/zooms. It owns all
 * pointer interaction:
 *   - drawing new rect/frame (drag a box -> 4-vertex ring)
 *   - selecting + box-resize (8 handles scale the whole ring)
 *   - VERTEX EDIT mode (double-click a shape): move / add / delete individual
 *     vertices, Figma-style, so any element becomes an arbitrary footprint.
 * When `tool === 'hand'` (or no projector yet) it is transparent to pointer
 * events so the map underneath can be panned.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  boundsFromPoints,
  midpoint,
  projectBounds,
  unprojectRect,
  type Projector,
} from '../lib/geo'
import { useEditor } from '../store'
import type { LatLng, Point, Shape } from '../types'

interface Props {
  map: google.maps.Map | null
  projector: Projector | null
  /** bumped on every map move — forces re-projection */
  version: number
  width: number
  height: number
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'

type DragMode =
  | { kind: 'none' }
  | { kind: 'draw'; start: Point; current: Point }
  | { kind: 'move'; id: string; last: Point }
  | {
      kind: 'resizeBox'
      id: string
      handle: ResizeHandle
      startBounds: ReturnType<typeof boundsFromPoints>
      startPixel: Point
    }
  | { kind: 'moveVertex'; id: string; index: number }

const SELECTION_COLOR = '#2563eb'

export function SvgOverlay({ map, projector, version, width, height }: Props) {
  const shapes = useEditor((s) => s.shapes)
  const order = useEditor((s) => s.order)
  const selection = useEditor((s) => s.selection)
  const tool = useEditor((s) => s.tool)
  const editingId = useEditor((s) => s.editingId)
  const activeVertex = useEditor((s) => s.activeVertex)

  const toggleSelect = useEditor((s) => s.toggleSelect)
  const clearSelection = useEditor((s) => s.clearSelection)
  const setTool = useEditor((s) => s.setTool)
  const addRect = useEditor((s) => s.addRect)
  const addFrame = useEditor((s) => s.addFrame)
  const resizeToBounds = useEditor((s) => s.resizeToBounds)
  const translateShape = useEditor((s) => s.translateShape)
  const enterVertexEdit = useEditor((s) => s.enterVertexEdit)
  const moveVertex = useEditor((s) => s.moveVertex)
  const addVertex = useEditor((s) => s.addVertex)
  const setActiveVertex = useEditor((s) => s.setActiveVertex)

  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<DragMode>({ kind: 'none' })
  /** Manual double-click detection (pointer capture suppresses native dblclick). */
  const lastClickRef = useRef<{ id: string; t: number }>({ id: '', t: 0 })

  // re-render when the map moves (projection changes).
  void version

  const interactive = tool !== 'hand' && projector != null

  const localPoint = useCallback((e: React.PointerEvent): Point => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  // --- Ctrl/Cmd + wheel = zoom (zoom toward the cursor) -----------------------
  // The overlay swallows wheel events while interactive, so the map underneath
  // never sees them. We forward Ctrl/Cmd+wheel to the map ourselves, keeping the
  // point under the cursor fixed. A native (non-passive) listener is required so
  // we can preventDefault the browser's pinch-zoom.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return // only Ctrl/Cmd + wheel zooms
      if (!map || !projector) return
      e.preventDefault()
      e.stopPropagation()

      const rect = svg.getBoundingClientRect()
      const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      const cursorLatLng = projector.toLatLng(cursor)
      const oldZoom = map.getZoom()
      const center = map.getCenter()
      if (cursorLatLng == null || oldZoom == null || center == null) return

      // Satellite (raster) maps snap to integer zoom, so step ±1 per notch by
      // the wheel direction — matches Google Maps' own wheel behaviour.
      if (e.deltaY === 0) return
      const dz = e.deltaY < 0 ? 1 : -1
      const newZoom = Math.max(1, Math.min(22, oldZoom + dz))
      const factor = Math.pow(2, newZoom - oldZoom)
      if (factor === 1) return

      // keep the cursor point fixed: newCenter = cursor + (center - cursor)/factor
      const newCenter = {
        lat: cursorLatLng.lat + (center.lat() - cursorLatLng.lat) / factor,
        lng: cursorLatLng.lng + (center.lng() - cursorLatLng.lng) / factor,
      }
      map.setZoom(newZoom)
      map.setCenter(newCenter)
    }

    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [map, projector])

  // --- background ------------------------------------------------------------

  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    if (!interactive || !projector) return
    if (e.button !== 0) return
    const p = localPoint(e)
    if (tool === 'rect' || tool === 'frame') {
      svgRef.current?.setPointerCapture(e.pointerId)
      setDrag({ kind: 'draw', start: p, current: p })
    } else if (tool === 'select') {
      clearSelection()
    }
  }

  // --- whole-shape move ------------------------------------------------------

  const onShapePointerDown = (e: React.PointerEvent, shape: Shape) => {
    if (!interactive || !projector || tool !== 'select' || shape.locked) return
    e.stopPropagation()

    // Manual double-click: a second press on the same shape within 350ms enters
    // vertex-edit mode. (Pointer capture below suppresses the native dblclick.)
    const now = e.timeStamp
    const prev = lastClickRef.current
    if (editingId !== shape.id && prev.id === shape.id && now - prev.t < 350) {
      lastClickRef.current = { id: '', t: 0 }
      enterVertexEdit(shape.id)
      return
    }
    lastClickRef.current = { id: shape.id, t: now }

    // In vertex-edit mode for THIS shape, a body press does nothing special
    // (vertex handles own their events; clicking the body keeps edit mode).
    if (editingId === shape.id) return

    svgRef.current?.setPointerCapture(e.pointerId)
    if (!selection.includes(shape.id)) toggleSelect(shape.id, e.shiftKey)
    setDrag({ kind: 'move', id: shape.id, last: localPoint(e) })
  }

  // --- box resize ------------------------------------------------------------

  const onBoxHandleDown = (
    e: React.PointerEvent,
    shape: Shape,
    handle: ResizeHandle,
  ) => {
    if (!interactive || !projector) return
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    setDrag({
      kind: 'resizeBox',
      id: shape.id,
      handle,
      startBounds: boundsFromPoints(shape.points),
      startPixel: localPoint(e),
    })
  }

  // --- vertex handles --------------------------------------------------------

  const onVertexDown = (e: React.PointerEvent, shape: Shape, index: number) => {
    if (!interactive || !projector) return
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    setActiveVertex(index)
    setDrag({ kind: 'moveVertex', id: shape.id, index })
  }

  const onEdgeMidpointDown = (
    e: React.PointerEvent,
    shape: Shape,
    afterIndex: number,
    pos: LatLng,
  ) => {
    if (!interactive || !projector) return
    e.stopPropagation()
    addVertex(shape.id, afterIndex, pos)
    svgRef.current?.setPointerCapture(e.pointerId)
    setActiveVertex(afterIndex + 1)
    setDrag({ kind: 'moveVertex', id: shape.id, index: afterIndex + 1 })
  }

  // --- move / up -------------------------------------------------------------

  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.kind === 'none' || !projector) return
    const p = localPoint(e)

    if (drag.kind === 'draw') {
      setDrag({ ...drag, current: p })
      return
    }

    if (drag.kind === 'move') {
      const a = projector.toLatLng(drag.last)
      const b = projector.toLatLng(p)
      if (a && b) translateShape(drag.id, b.lat - a.lat, b.lng - a.lng)
      setDrag({ ...drag, last: p })
      return
    }

    if (drag.kind === 'moveVertex') {
      const ll = projector.toLatLng(p)
      if (ll) moveVertex(drag.id, drag.index, ll)
      return
    }

    if (drag.kind === 'resizeBox') {
      const rect = projectBounds(drag.startBounds, projector)
      if (!rect) return
      let { x, y, width: w, height: h } = rect
      const dx = p.x - drag.startPixel.x
      const dy = p.y - drag.startPixel.y
      if (drag.handle.includes('w')) {
        x += dx
        w -= dx
      }
      if (drag.handle.includes('e')) w += dx
      if (drag.handle.includes('n')) {
        y += dy
        h -= dy
      }
      if (drag.handle.includes('s')) h += dy
      if (w < 0) {
        x += w
        w = -w
      }
      if (h < 0) {
        y += h
        h = -h
      }
      const newBounds = unprojectRect({ x, y, width: w, height: h }, projector)
      if (newBounds) resizeToBounds(drag.id, newBounds)
      return
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.kind === 'draw' && projector) {
      const { start, current } = drag
      const x = Math.min(start.x, current.x)
      const y = Math.min(start.y, current.y)
      const w = Math.abs(current.x - start.x)
      const h = Math.abs(current.y - start.y)
      if (w > 3 && h > 3) {
        const bounds = unprojectRect({ x, y, width: w, height: h }, projector)
        if (bounds) {
          const parentId = tool === 'rect' ? frameAt({ x, y }, projector) : null
          if (tool === 'frame') addFrame(bounds)
          else addRect(bounds, parentId)
        }
      }
      setTool('select')
    }
    svgRef.current?.releasePointerCapture?.(e.pointerId)
    setDrag({ kind: 'none' })
  }

  /** Find the topmost frame whose ring contains a point (for nesting drops). */
  function frameAt(p: Point, proj: Projector): string | null {
    const ll = proj.toLatLng(p)
    if (!ll) return null
    for (let i = order.length - 1; i >= 0; i--) {
      const sh = shapes[order[i]]
      if (sh?.type !== 'frame') continue
      const b = boundsFromPoints(sh.points)
      if (ll.lat <= b.north && ll.lat >= b.south && ll.lng >= b.west && ll.lng <= b.east) {
        return sh.id
      }
    }
    return null
  }

  // --- render ----------------------------------------------------------------

  const cursor =
    tool === 'hand'
      ? 'grab'
      : tool === 'rect' || tool === 'frame'
        ? 'crosshair'
        : 'default'

  const editingShape = editingId ? shapes[editingId] : null

  return (
    <svg
      ref={svgRef}
      className="svg-overlay"
      width={width}
      height={height}
      style={{ pointerEvents: interactive ? 'auto' : 'none', cursor }}
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {projector &&
        order.map((id) => {
          const shape = shapes[id]
          if (!shape || !shape.visible) return null
          return (
            <ShapeView
              key={id}
              shape={shape}
              projector={projector}
              selected={selection.includes(id)}
              editing={editingId === id}
              onPointerDown={onShapePointerDown}
            />
          )
        })}

      {/* box-resize handles when selected and NOT in vertex edit */}
      {projector &&
        !editingId &&
        drag.kind !== 'draw' &&
        selection.map((id) => {
          const shape = shapes[id]
          if (!shape) return null
          return (
            <BoxHandles
              key={`b-${id}`}
              shape={shape}
              projector={projector}
              onHandleDown={onBoxHandleDown}
            />
          )
        })}

      {/* vertex handles in vertex-edit mode */}
      {projector && editingShape && (
        <VertexHandles
          shape={editingShape}
          projector={projector}
          activeVertex={activeVertex}
          onVertexDown={onVertexDown}
          onEdgeMidpointDown={onEdgeMidpointDown}
        />
      )}

      {/* live draw preview */}
      {drag.kind === 'draw' && (
        <rect
          x={Math.min(drag.start.x, drag.current.x)}
          y={Math.min(drag.start.y, drag.current.y)}
          width={Math.abs(drag.current.x - drag.start.x)}
          height={Math.abs(drag.current.y - drag.start.y)}
          fill={tool === 'frame' ? 'rgba(59,130,246,0.05)' : 'rgba(59,130,246,0.2)'}
          stroke={SELECTION_COLOR}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}
    </svg>
  )
}

// ---------------------------------------------------------------------------

function ringToPixels(points: LatLng[], proj: Projector): Point[] {
  const out: Point[] = []
  for (const p of points) {
    const px = proj.toPixel(p)
    if (px) out.push(px)
  }
  return out
}

function ShapeView({
  shape,
  projector,
  selected,
  editing,
  onPointerDown,
}: {
  shape: Shape
  projector: Projector
  selected: boolean
  editing: boolean
  onPointerDown: (e: React.PointerEvent, shape: Shape) => void
}) {
  const { style } = shape
  const px = ringToPixels(shape.points, projector)
  if (px.length < 2) return null
  const pts = px.map((p) => `${p.x},${p.y}`).join(' ')
  const stroke = selected ? SELECTION_COLOR : style.stroke
  const strokeWidth = selected ? style.strokeWidth + 0.5 : style.strokeWidth
  const isFrame = shape.type === 'frame'

  // label position = topmost-leftmost vertex
  const labelAnchor = px.reduce((a, b) => (b.y < a.y ? b : a), px[0])

  return (
    <g>
      <polygon
        points={pts}
        fill={style.fill}
        fillOpacity={style.fillOpacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={isFrame ? '6 3' : undefined}
        onPointerDown={(e) => onPointerDown(e, shape)}
        style={{ cursor: editing ? 'default' : 'move' }}
      />
      {isFrame && (
        <text
          x={labelAnchor.x}
          y={labelAnchor.y - 6}
          fontSize={11}
          fill={selected ? SELECTION_COLOR : style.stroke}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
          fontFamily="Inter, system-ui, sans-serif"
        >
          {shape.name}
        </text>
      )}
    </g>
  )
}

function BoxHandles({
  shape,
  projector,
  onHandleDown,
}: {
  shape: Shape
  projector: Projector
  onHandleDown: (e: React.PointerEvent, shape: Shape, h: ResizeHandle) => void
}) {
  const r = projectBounds(boundsFromPoints(shape.points), projector)
  if (!r) return null
  const S = 8
  const half = S / 2
  const handles: { h: ResizeHandle; x: number; y: number; cursor: string }[] = [
    { h: 'nw', x: r.x, y: r.y, cursor: 'nwse-resize' },
    { h: 'ne', x: r.x + r.width, y: r.y, cursor: 'nesw-resize' },
    { h: 'sw', x: r.x, y: r.y + r.height, cursor: 'nesw-resize' },
    { h: 'se', x: r.x + r.width, y: r.y + r.height, cursor: 'nwse-resize' },
    { h: 'n', x: r.x + r.width / 2, y: r.y, cursor: 'ns-resize' },
    { h: 's', x: r.x + r.width / 2, y: r.y + r.height, cursor: 'ns-resize' },
    { h: 'w', x: r.x, y: r.y + r.height / 2, cursor: 'ew-resize' },
    { h: 'e', x: r.x + r.width, y: r.y + r.height / 2, cursor: 'ew-resize' },
  ]
  return (
    <g>
      <rect
        x={r.x}
        y={r.y}
        width={r.width}
        height={r.height}
        fill="none"
        stroke={SELECTION_COLOR}
        strokeWidth={1}
        pointerEvents="none"
      />
      {handles.map((hd) => (
        <rect
          key={hd.h}
          x={hd.x - half}
          y={hd.y - half}
          width={S}
          height={S}
          fill="#fff"
          stroke={SELECTION_COLOR}
          strokeWidth={1.5}
          style={{ cursor: hd.cursor }}
          onPointerDown={(e) => onHandleDown(e, shape, hd.h)}
        />
      ))}
    </g>
  )
}

function VertexHandles({
  shape,
  projector,
  activeVertex,
  onVertexDown,
  onEdgeMidpointDown,
}: {
  shape: Shape
  projector: Projector
  activeVertex: number | null
  onVertexDown: (e: React.PointerEvent, shape: Shape, index: number) => void
  onEdgeMidpointDown: (
    e: React.PointerEvent,
    shape: Shape,
    afterIndex: number,
    pos: LatLng,
  ) => void
}) {
  const px = ringToPixels(shape.points, projector)
  if (px.length < 2) return null

  // edge midpoints (in pixel space) for the "+" add-vertex handles
  const mids = shape.points.map((p, i) => {
    const next = shape.points[(i + 1) % shape.points.length]
    const geoMid = midpoint(p, next)
    return { geoMid, px: projector.toPixel(geoMid), afterIndex: i }
  })

  return (
    <g>
      {/* outline so the editable ring is obvious */}
      <polygon
        points={px.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={SELECTION_COLOR}
        strokeWidth={1.5}
        pointerEvents="none"
      />

      {/* edge midpoints: click to add a vertex */}
      {mids.map((m) =>
        m.px ? (
          <circle
            key={`m-${m.afterIndex}`}
            cx={m.px.x}
            cy={m.px.y}
            r={4}
            fill="#fff"
            stroke={SELECTION_COLOR}
            strokeWidth={1}
            opacity={0.55}
            style={{ cursor: 'copy' }}
            onPointerDown={(e) =>
              onEdgeMidpointDown(e, shape, m.afterIndex, m.geoMid)
            }
          >
            <title>Nuqta qo'shish</title>
          </circle>
        ) : null,
      )}

      {/* vertices: drag to move, the active one is filled */}
      {px.map((p, i) => {
        const active = activeVertex === i
        return (
          <circle
            key={`v-${i}`}
            cx={p.x}
            cy={p.y}
            r={5.5}
            fill={active ? SELECTION_COLOR : '#fff'}
            stroke={SELECTION_COLOR}
            strokeWidth={1.5}
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => onVertexDown(e, shape, i)}
          >
            <title>Nuqta {i + 1} — surish / Delete bilan o'chirish</title>
          </circle>
        )
      })}
    </g>
  )
}
