import { beforeEach, describe, expect, it } from 'vitest'
import { exportSvg } from './lib/exportSvg'
import { useEditor } from './store'

function reset() {
  useEditor.setState({
    shapes: {},
    order: [],
    selection: [],
    tool: 'select',
    editingId: null,
    activeVertex: null,
  })
}

const BOUNDS = { north: 41.3, south: 41.29, east: 69.21, west: 69.2 }

describe('store: template drop', () => {
  beforeEach(reset)

  it('drops the House template as a frame containing a rect child', () => {
    const ids = useEditor.getState().dropTemplate('house', {
      lat: 41.3,
      lng: 69.2,
    })
    expect(ids.length).toBe(2)
    const { shapes } = useEditor.getState()
    const frame = shapes[ids[0]]
    const roof = shapes[ids[1]]
    expect(frame.type).toBe('frame')
    expect(roof.type).toBe('rect')
    expect(roof.parentId).toBe(frame.id)
    // every shape is a vertex ring (rect starts as 4 corners)
    expect(frame.points.length).toBe(4)
    expect(roof.points.length).toBe(4)
    // attributes carry through + are augmented
    expect(frame.attributes.type).toBe('house')
    expect(frame.attributes.id).toBe(frame.id)
    expect(frame.attributes.vertices).toBe('4')
    expect(frame.attributes['total-path']).toMatch(/m$/)
  })

  it('selects the root frame after drop', () => {
    const ids = useEditor.getState().dropTemplate('house', { lat: 41, lng: 69 })
    expect(useEditor.getState().selection).toEqual([ids[0]])
  })
})

describe('store: vertex operations', () => {
  beforeEach(reset)

  it('addVertex inserts a point and updates the vertices attribute', () => {
    const id = useEditor.getState().addRect(BOUNDS)
    useEditor.getState().addVertex(id, 0)
    const shape = useEditor.getState().shapes[id]
    expect(shape.points.length).toBe(5)
    expect(shape.attributes.vertices).toBe('5')
  })

  it('moveVertex repositions a single point', () => {
    const id = useEditor.getState().addRect(BOUNDS)
    useEditor.getState().moveVertex(id, 0, { lat: 41.5, lng: 69.5 })
    const shape = useEditor.getState().shapes[id]
    expect(shape.points[0]).toEqual({ lat: 41.5, lng: 69.5 })
  })

  it('removeVertex deletes a point but refuses to go below 3', () => {
    const id = useEditor.getState().addRect(BOUNDS)
    useEditor.getState().removeVertex(id, 0) // 4 -> 3
    expect(useEditor.getState().shapes[id].points.length).toBe(3)
    useEditor.getState().removeVertex(id, 0) // 3 -> stays 3
    expect(useEditor.getState().shapes[id].points.length).toBe(3)
  })
})

describe('store: resizeToBounds scales the ring', () => {
  beforeEach(reset)

  it('doubles the bbox width when resized', () => {
    const id = useEditor.getState().addRect(BOUNDS)
    const newBounds = { ...BOUNDS, east: BOUNDS.west + (BOUNDS.east - BOUNDS.west) * 2 }
    useEditor.getState().resizeToBounds(id, newBounds)
    const shape = useEditor.getState().shapes[id]
    const lngs = shape.points.map((p) => p.lng)
    expect(Math.max(...lngs)).toBeCloseTo(newBounds.east, 9)
  })
})

describe('store: translate moves children with parent', () => {
  beforeEach(reset)

  it('translating a frame moves its child rect by the same delta', () => {
    const ids = useEditor.getState().dropTemplate('house', { lat: 41, lng: 69 })
    const before = useEditor.getState().shapes[ids[1]].points[0].lat
    useEditor.getState().translateShape(ids[0], 0.001, 0.002)
    const after = useEditor.getState().shapes[ids[1]].points[0].lat
    expect(after).toBeCloseTo(before + 0.001, 9)
  })
})

describe('store: remove cascades to children', () => {
  beforeEach(reset)

  it('removing a frame removes its children too', () => {
    const ids = useEditor.getState().dropTemplate('house', { lat: 41, lng: 69 })
    useEditor.getState().remove([ids[0]])
    const { shapes, order } = useEditor.getState()
    expect(order.length).toBe(0)
    expect(shapes[ids[0]]).toBeUndefined()
    expect(shapes[ids[1]]).toBeUndefined()
  })
})

describe('store: vertex-edit mode', () => {
  beforeEach(reset)

  it('enter/exit toggles editingId; selecting another shape exits', () => {
    const a = useEditor.getState().addRect(BOUNDS)
    const b = useEditor.getState().addRect(BOUNDS)
    useEditor.getState().enterVertexEdit(a)
    expect(useEditor.getState().editingId).toBe(a)
    useEditor.getState().toggleSelect(b, false)
    expect(useEditor.getState().editingId).toBeNull()
  })
})

describe('exportSvg', () => {
  beforeEach(reset)

  it('emits polygons, nests rect children in the frame group, includes data attrs', () => {
    useEditor.getState().dropTemplate('house', { lat: 41.3, lng: 69.2 })
    const { shapes, order } = useEditor.getState()
    const svg = exportSvg(shapes, order)
    expect(svg).toContain('<svg')
    expect(svg).toContain('<polygon')
    expect(svg).toContain('data-frame-id=')
    expect(svg).toContain('data-type="house"')
    expect(svg).toContain('data-type="roof"')
    const groupIdx = svg.indexOf('data-frame-id')
    const roofIdx = svg.indexOf('data-type="roof"')
    expect(roofIdx).toBeGreaterThan(groupIdx)
  })

  it('reflects an edited polygon footprint (added vertex) in the output', () => {
    const id = useEditor.getState().addRect(BOUNDS)
    useEditor.getState().addVertex(id, 0)
    const { shapes, order } = useEditor.getState()
    const svg = exportSvg(shapes, order)
    // 5 vertices => 5 coordinate pairs in the polygon points attribute
    const m = svg.match(/<polygon points="([^"]+)"/)
    expect(m).toBeTruthy()
    const pairs = m![1].trim().split(/\s+/)
    expect(pairs.length).toBe(5)
  })

  it('escapes special characters in attribute values', () => {
    const id = useEditor.getState().addRect(BOUNDS)
    useEditor.getState().setName(id, 'A & B <test>')
    const { shapes, order } = useEditor.getState()
    const svg = exportSvg(shapes, order)
    expect(svg).toContain('A &amp; B &lt;test&gt;')
    expect(svg).not.toContain('A & B <test>')
  })

  it('returns a minimal svg when there is nothing to export', () => {
    const svg = exportSvg({}, [])
    expect(svg).toContain('<svg')
    expect(svg).toContain('width="100"')
  })
})
