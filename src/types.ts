/**
 * Core data model for the SVG map editor.
 *
 * KEY DESIGN PRINCIPLE: every shape is stored in GEOGRAPHIC coordinates
 * (lat/lng), never in screen pixels. The map background (Google Maps) owns the
 * projection; on every pan/zoom we re-project each shape's geo coords into
 * screen pixels for rendering. This is what keeps drawings "glued" to the map.
 */

/** A geographic point. */
export interface LatLng {
  lat: number
  lng: number
}

/** A screen-space point in CSS pixels, relative to the map container. */
export interface Point {
  x: number
  y: number
}

/**
 * The kinds of editor entities a user can place on the map.
 * Both are vertex-based: a `rect` simply starts life as four corners. Every
 * shape's outline is an editable ring of points (move/add/delete vertices),
 * Figma-style — so any element can become an arbitrary building footprint.
 */
export type ShapeType = 'frame' | 'rect'

/**
 * Free-form, user/template-defined attributes attached to any entity.
 * Drives the "Figma-like attributes" requirement and makes the exported SVG
 * easy to query (id, frame-name, type, total-path, ...). Values are strings so
 * they round-trip cleanly to SVG `data-*` attributes and the properties panel.
 */
export type Attributes = Record<string, string>

/** Fields shared by every entity. */
interface ShapeBase {
  id: string
  type: ShapeType
  name: string
  /** Parent frame id, or null for top-level entities. */
  parentId: string | null
  /** Whether the shape is locked from editing/selection. */
  locked: boolean
  /** Whether the shape is rendered. */
  visible: boolean
  /** Free-form attributes (id/type/name are mirrored in here for export). */
  attributes: Attributes
  /** Visual style. */
  style: ShapeStyle
}

export interface ShapeStyle {
  fill: string
  fillOpacity: number
  stroke: string
  strokeWidth: number
}

/**
 * A FRAME: a container defined by an editable ring of geographic vertices.
 * Templates (e.g. "House") are frames that hold child shapes. Children store
 * their own absolute geo coords, so a frame can be moved by translating all of
 * its descendants together. Starts as a 4-corner rectangle but its vertices can
 * be moved / added / removed.
 */
export interface FrameShape extends ShapeBase {
  type: 'frame'
  /** Outline as an ordered, closed ring of vertices (>= 3). */
  points: LatLng[]
  /** Whether children are clipped to the frame bounds (Figma-style). */
  clipsContent: boolean
}

/**
 * A RECTANGLE: an editable ring of geographic vertices. Created as 4 corners,
 * but vertices can be moved / added / removed to form any polygon footprint.
 */
export interface RectShape extends ShapeBase {
  type: 'rect'
  /** Outline as an ordered, closed ring of vertices (>= 3). */
  points: LatLng[]
}

export type Shape = FrameShape | RectShape

/**
 * A geographic axis-aligned bounding box. Computed on demand from a shape's
 * vertices (for projection, frame hit-testing, and box resize).
 * north > south, and east > west (we keep things simple and ignore the
 * antimeridian — these maps are local-scale).
 */
export interface GeoBounds {
  north: number
  south: number
  east: number
  west: number
}

// ---------------------------------------------------------------------------
// Templates (right sidebar palette)
// ---------------------------------------------------------------------------

/**
 * A template is a reusable group of shapes (with attributes) that gets stamped
 * onto the map via drag & drop. Coordinates inside a template are expressed in
 * METERS relative to the template's top-left origin, so the same template can
 * be dropped anywhere and scaled into real geo coords at drop time.
 */
export interface Template {
  id: string
  name: string
  /** Short description shown in the palette. */
  description: string
  /** Overall footprint in meters (width = east-west, height = north-south). */
  size: { width: number; height: number }
  /** Shapes that make up the template, in meter-space. */
  nodes: TemplateNode[]
}

export interface TemplateNode {
  type: ShapeType
  name: string
  /** Local rect in meters from the template origin (top-left = 0,0). */
  rect: { x: number; y: number; width: number; height: number }
  attributes: Attributes
  style: ShapeStyle
  /** Index into the same `nodes` array of this node's parent, or null. */
  parentIndex: number | null
}
