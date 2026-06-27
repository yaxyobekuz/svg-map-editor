/**
 * Built-in templates shown in the right sidebar palette.
 *
 * A template's geometry is expressed in METERS from its top-left origin, so the
 * same template can be dropped anywhere on the map and converted to real geo
 * coordinates at the drop point (see `store.dropTemplate`).
 */

import type { ShapeStyle, Template } from '../types'

const FRAME_STYLE: ShapeStyle = {
  fill: '#3b82f6',
  fillOpacity: 0.04,
  stroke: '#3b82f6',
  strokeWidth: 1.5,
}

const ROOF_STYLE: ShapeStyle = {
  fill: '#ef4444',
  fillOpacity: 0.35,
  stroke: '#ef4444',
  strokeWidth: 1.5,
}

const LAND_STYLE: ShapeStyle = {
  fill: '#22c55e',
  fillOpacity: 0.2,
  stroke: '#22c55e',
  strokeWidth: 1.5,
}

export const TEMPLATES: Template[] = [
  {
    id: 'house',
    name: 'Uy',
    description: 'Frame + tom (rectangle). Uy hududini belgilash uchun.',
    size: { width: 12, height: 10 },
    nodes: [
      {
        type: 'frame',
        name: 'Uy',
        rect: { x: 0, y: 0, width: 12, height: 10 },
        parentIndex: null,
        style: FRAME_STYLE,
        attributes: {
          type: 'house',
          'frame-name': 'Uy',
          category: 'building',
        },
      },
      {
        type: 'rect',
        name: 'Tom',
        // inset 1m from the frame edge — the roof footprint
        rect: { x: 1, y: 1, width: 10, height: 8 },
        parentIndex: 0,
        style: ROOF_STYLE,
        attributes: {
          type: 'roof',
          material: 'unknown',
          floors: '1',
        },
      },
    ],
  },
  {
    id: 'house-with-land',
    name: 'Uy + Yer',
    description: 'Frame ichida yer uchastkasi va tom.',
    size: { width: 20, height: 18 },
    nodes: [
      {
        type: 'frame',
        name: 'Uchastka',
        rect: { x: 0, y: 0, width: 20, height: 18 },
        parentIndex: null,
        style: FRAME_STYLE,
        attributes: {
          type: 'parcel',
          'frame-name': 'Uchastka',
          category: 'building',
        },
      },
      {
        type: 'rect',
        name: 'Yer',
        rect: { x: 1, y: 1, width: 18, height: 16 },
        parentIndex: 0,
        style: LAND_STYLE,
        attributes: { type: 'land' },
      },
      {
        type: 'rect',
        name: 'Tom',
        rect: { x: 4, y: 4, width: 10, height: 8 },
        parentIndex: 0,
        style: ROOF_STYLE,
        attributes: { type: 'roof', floors: '1' },
      },
    ],
  },
  {
    id: 'road',
    name: "Yo'l",
    description: "Uzun frame — yo'l/ko'cha segmentini belgilash uchun.",
    size: { width: 40, height: 6 },
    nodes: [
      {
        type: 'frame',
        name: "Yo'l",
        rect: { x: 0, y: 0, width: 40, height: 6 },
        parentIndex: null,
        style: {
          fill: '#a855f7',
          fillOpacity: 0.15,
          stroke: '#a855f7',
          strokeWidth: 1.5,
        },
        attributes: { type: 'road', 'frame-name': "Yo'l", lanes: '2' },
      },
    ],
  },
  {
    id: 'empty-frame',
    name: "Bo'sh Frame",
    description: "Bo'sh konteyner frame.",
    size: { width: 15, height: 15 },
    nodes: [
      {
        type: 'frame',
        name: 'Frame',
        rect: { x: 0, y: 0, width: 15, height: 15 },
        parentIndex: null,
        style: FRAME_STYLE,
        attributes: { type: 'frame', 'frame-name': 'Frame' },
      },
    ],
  },
]

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id)
}
