/**
 * Central editor state (zustand).
 *
 * Holds every shape (keyed by id, plus a top-level order array), the current
 * selection, the active tool, and all the mutation actions. Shapes live in geo
 * coordinates as an editable ring of vertices; nothing here knows about pixels.
 */

import { nanoid } from 'nanoid'
import { create } from 'zustand'
import {
  boundsFromPoints,
  midpoint,
  offsetMeters,
  rectRingFromBounds,
  rectRingFromMeters,
  ringPathMeters,
  scaleRingToBounds,
} from './lib/geo'
import { getTemplate } from './lib/templates'
import type {
  Attributes,
  FrameShape,
  GeoBounds,
  LatLng,
  RectShape,
  Shape,
  ShapeStyle,
  ShapeType,
} from './types'

export type Tool = 'select' | 'frame' | 'rect' | 'hand'

interface EditorState {
  /** All shapes by id. */
  shapes: Record<string, Shape>
  /** Render/z order of shape ids (top-level + nested share one array; parentId defines nesting). */
  order: string[]
  /** Currently selected shape ids. */
  selection: string[]
  /** Active tool. */
  tool: Tool
  /** Shape currently in vertex-edit mode (double-clicked), or null. */
  editingId: string | null
  /** Index of the highlighted vertex within the editing shape, or null. */
  activeVertex: number | null

  // --- selection ---
  select: (ids: string[]) => void
  toggleSelect: (id: string, additive: boolean) => void
  clearSelection: () => void

  // --- vertex edit mode ---
  enterVertexEdit: (id: string) => void
  exitVertexEdit: () => void
  setActiveVertex: (index: number | null) => void

  // --- tool ---
  setTool: (tool: Tool) => void

  // --- creation ---
  addRect: (bounds: GeoBounds, parentId?: string | null) => string
  addFrame: (bounds: GeoBounds, parentId?: string | null) => string
  dropTemplate: (templateId: string, topLeft: LatLng) => string[]

  // --- geometry mutation ---
  /** Box-resize: scale the whole ring into a new bounding box. */
  resizeToBounds: (id: string, bounds: GeoBounds) => void
  /** Move a single vertex to a new geo position. */
  moveVertex: (id: string, index: number, pos: LatLng) => void
  /** Insert a new vertex after `afterIndex` (defaults to the edge midpoint). */
  addVertex: (id: string, afterIndex: number, pos?: LatLng) => void
  /** Remove a vertex (no-op if it would drop below 3 points). */
  removeVertex: (id: string, index: number) => void
  /** Translate a shape and all its descendants by a geo delta. */
  translateShape: (id: string, dLat: number, dLng: number) => void

  // --- attributes / style ---
  setName: (id: string, name: string) => void
  setStyle: (id: string, style: Partial<ShapeStyle>) => void
  setAttribute: (id: string, key: string, value: string) => void
  renameAttribute: (id: string, oldKey: string, newKey: string) => void
  removeAttribute: (id: string, key: string) => void
  setLocked: (id: string, locked: boolean) => void
  setVisible: (id: string, visible: boolean) => void
  remove: (ids: string[]) => void

  // --- helpers ---
  childrenOf: (id: string) => Shape[]
}

const DEFAULT_RECT_STYLE: ShapeStyle = {
  fill: '#3b82f6',
  fillOpacity: 0.25,
  stroke: '#3b82f6',
  strokeWidth: 1.5,
}

const DEFAULT_FRAME_STYLE: ShapeStyle = {
  fill: '#ffffff',
  fillOpacity: 0.02,
  stroke: '#3b82f6',
  strokeWidth: 1.5,
}

/** Round a meters value for display in attributes. */
function fmtMeters(m: number): string {
  return `${m.toFixed(2)}m`
}

/** Mirror the canonical fields into the free-form attribute bag for export. */
function syncCoreAttributes(shape: Shape): Attributes {
  return {
    ...shape.attributes,
    id: shape.id,
    type: shape.attributes.type ?? shape.type,
    name: shape.name,
    vertices: String(shape.points.length),
    'total-path': fmtMeters(ringPathMeters(shape.points)),
  }
}

let frameCounter = 0
let rectCounter = 0

export const useEditor = create<EditorState>((set, get) => ({
  shapes: {},
  order: [],
  selection: [],
  tool: 'select',
  editingId: null,
  activeVertex: null,

  select: (ids) => set({ selection: ids, editingId: null, activeVertex: null }),
  toggleSelect: (id, additive) =>
    set((s) => {
      // selecting a different shape exits vertex-edit mode
      const exit =
        s.editingId && s.editingId !== id
          ? { editingId: null, activeVertex: null }
          : {}
      if (!additive) return { selection: [id], ...exit }
      return s.selection.includes(id)
        ? { selection: s.selection.filter((x) => x !== id), ...exit }
        : { selection: [...s.selection, id], ...exit }
    }),
  clearSelection: () =>
    set({ selection: [], editingId: null, activeVertex: null }),

  enterVertexEdit: (id) =>
    set({ editingId: id, selection: [id], activeVertex: null }),
  exitVertexEdit: () => set({ editingId: null, activeVertex: null }),
  setActiveVertex: (index) => set({ activeVertex: index }),

  setTool: (tool) =>
    set({ tool, editingId: null, activeVertex: null }),

  addRect: (bounds, parentId = null) => {
    const id = nanoid(8)
    const shape: RectShape = {
      id,
      type: 'rect',
      name: `Rectangle ${++rectCounter}`,
      parentId,
      locked: false,
      visible: true,
      points: rectRingFromBounds(bounds),
      style: { ...DEFAULT_RECT_STYLE },
      attributes: { type: 'rect' },
    }
    shape.attributes = syncCoreAttributes(shape)
    set((s) => ({
      shapes: { ...s.shapes, [id]: shape },
      order: [...s.order, id],
      selection: [id],
    }))
    return id
  },

  addFrame: (bounds, parentId = null) => {
    const id = nanoid(8)
    const shape: FrameShape = {
      id,
      type: 'frame',
      name: `Frame ${++frameCounter}`,
      parentId,
      locked: false,
      visible: true,
      points: rectRingFromBounds(bounds),
      clipsContent: false,
      style: { ...DEFAULT_FRAME_STYLE },
      attributes: { type: 'frame', 'frame-name': `Frame ${frameCounter}` },
    }
    shape.attributes = syncCoreAttributes(shape)
    set((s) => ({
      shapes: { ...s.shapes, [id]: shape },
      order: [...s.order, id],
      selection: [id],
    }))
    return id
  },

  dropTemplate: (templateId, topLeft) => {
    const template = getTemplate(templateId)
    if (!template) return []
    const newIds: string[] = []
    const indexToId: Record<number, string> = {}
    const newShapes: Record<string, Shape> = {}

    template.nodes.forEach((node, i) => {
      const id = nanoid(8)
      indexToId[i] = id
      newIds.push(id)
      const parentId =
        node.parentIndex != null ? indexToId[node.parentIndex] : null

      const r = node.rect
      // build the ring from meters relative to the template origin
      const ring = rectRingFromMeters(
        offsetMeters(topLeft, r.x, r.y),
        r.width,
        r.height,
      )

      if (node.type === 'frame') {
        const shape: FrameShape = {
          id,
          type: 'frame',
          name: node.name,
          parentId,
          locked: false,
          visible: true,
          points: ring,
          clipsContent: false,
          style: { ...node.style },
          attributes: { ...node.attributes },
        }
        shape.attributes = syncCoreAttributes(shape)
        newShapes[id] = shape
      } else {
        const shape: RectShape = {
          id,
          type: 'rect',
          name: node.name,
          parentId,
          locked: false,
          visible: true,
          points: ring,
          style: { ...node.style },
          attributes: { ...node.attributes },
        }
        shape.attributes = syncCoreAttributes(shape)
        newShapes[id] = shape
      }
    })

    set((s) => ({
      shapes: { ...s.shapes, ...newShapes },
      order: [...s.order, ...newIds],
      selection: newIds.length ? [newIds[0]] : [],
    }))
    return newIds
  },

  resizeToBounds: (id, bounds) => {
    set((s) => {
      const shape = s.shapes[id]
      if (!shape) return s
      const from = boundsFromPoints(shape.points)
      const next = {
        ...shape,
        points: scaleRingToBounds(shape.points, from, bounds),
      } as Shape
      next.attributes = syncCoreAttributes(next)
      return { shapes: { ...s.shapes, [id]: next } }
    })
  },

  moveVertex: (id, index, pos) => {
    set((s) => {
      const shape = s.shapes[id]
      if (!shape || index < 0 || index >= shape.points.length) return s
      const points = shape.points.slice()
      points[index] = pos
      const next = { ...shape, points } as Shape
      next.attributes = syncCoreAttributes(next)
      return { shapes: { ...s.shapes, [id]: next } }
    })
  },

  addVertex: (id, afterIndex, pos) => {
    set((s) => {
      const shape = s.shapes[id]
      if (!shape) return s
      const n = shape.points.length
      const a = shape.points[afterIndex % n]
      const b = shape.points[(afterIndex + 1) % n]
      const point = pos ?? midpoint(a, b)
      const points = shape.points.slice()
      points.splice(afterIndex + 1, 0, point)
      const next = { ...shape, points } as Shape
      next.attributes = syncCoreAttributes(next)
      return { shapes: { ...s.shapes, [id]: next } }
    })
  },

  removeVertex: (id, index) => {
    set((s) => {
      const shape = s.shapes[id]
      if (!shape || shape.points.length <= 3) return s
      const points = shape.points.filter((_, i) => i !== index)
      const next = { ...shape, points } as Shape
      next.attributes = syncCoreAttributes(next)
      return { shapes: { ...s.shapes, [id]: next } }
    })
  },

  translateShape: (id, dLat, dLng) => {
    set((s) => {
      const shape = s.shapes[id]
      if (!shape) return s
      const updated: Record<string, Shape> = {}
      // translate the shape and all its descendants
      const stack = [id]
      while (stack.length) {
        const cur = stack.pop()!
        const sh = s.shapes[cur]
        if (!sh) continue
        updated[cur] = {
          ...sh,
          points: sh.points.map((p) => ({
            lat: p.lat + dLat,
            lng: p.lng + dLng,
          })),
        } as Shape
        for (const childId of s.order) {
          if (s.shapes[childId]?.parentId === cur) stack.push(childId)
        }
      }
      return { shapes: { ...s.shapes, ...updated } }
    })
  },

  setName: (id, name) =>
    set((s) => {
      const shape = s.shapes[id]
      if (!shape) return s
      const next = { ...shape, name } as Shape
      next.attributes = syncCoreAttributes(next)
      return { shapes: { ...s.shapes, [id]: next } }
    }),

  setStyle: (id, style) =>
    set((s) => {
      const shape = s.shapes[id]
      if (!shape) return s
      return {
        shapes: {
          ...s.shapes,
          [id]: { ...shape, style: { ...shape.style, ...style } } as Shape,
        },
      }
    }),

  setAttribute: (id, key, value) =>
    set((s) => {
      const shape = s.shapes[id]
      if (!shape) return s
      return {
        shapes: {
          ...s.shapes,
          [id]: {
            ...shape,
            attributes: { ...shape.attributes, [key]: value },
          } as Shape,
        },
      }
    }),

  renameAttribute: (id, oldKey, newKey) =>
    set((s) => {
      const shape = s.shapes[id]
      if (!shape || oldKey === newKey || !newKey) return s
      const attrs: Attributes = {}
      for (const [k, v] of Object.entries(shape.attributes)) {
        attrs[k === oldKey ? newKey : k] = v
      }
      return {
        shapes: { ...s.shapes, [id]: { ...shape, attributes: attrs } as Shape },
      }
    }),

  removeAttribute: (id, key) =>
    set((s) => {
      const shape = s.shapes[id]
      if (!shape) return s
      const attrs = { ...shape.attributes }
      delete attrs[key]
      return {
        shapes: { ...s.shapes, [id]: { ...shape, attributes: attrs } as Shape },
      }
    }),

  setLocked: (id, locked) =>
    set((s) => {
      const shape = s.shapes[id]
      if (!shape) return s
      return { shapes: { ...s.shapes, [id]: { ...shape, locked } as Shape } }
    }),

  setVisible: (id, visible) =>
    set((s) => {
      const shape = s.shapes[id]
      if (!shape) return s
      return { shapes: { ...s.shapes, [id]: { ...shape, visible } as Shape } }
    }),

  remove: (ids) =>
    set((s) => {
      const toRemove = new Set<string>()
      const stack = [...ids]
      while (stack.length) {
        const cur = stack.pop()!
        toRemove.add(cur)
        for (const childId of s.order) {
          if (s.shapes[childId]?.parentId === cur) stack.push(childId)
        }
      }
      const shapes = { ...s.shapes }
      for (const id of toRemove) delete shapes[id]
      return {
        shapes,
        order: s.order.filter((id) => !toRemove.has(id)),
        selection: s.selection.filter((id) => !toRemove.has(id)),
      }
    }),

  childrenOf: (id) => {
    const s = get()
    return s.order
      .filter((cid) => s.shapes[cid]?.parentId === id)
      .map((cid) => s.shapes[cid])
  },
}))

/** Convenience selector: the single selected shape, if exactly one. */
export function useSingleSelected(): Shape | null {
  return useEditor((s) =>
    s.selection.length === 1 ? (s.shapes[s.selection[0]] ?? null) : null,
  )
}

export type { ShapeType }
