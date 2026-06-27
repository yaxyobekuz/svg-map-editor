/**
 * Right sidebar (bottom): properties + attributes of the selected shape.
 *
 * - Identity (name, type, id)
 * - Geometry readout (size in meters, total path)
 * - Style editor (fill, stroke, opacity, width)
 * - Free-form attribute table: add / edit / rename / remove key-value pairs.
 *   This is the heart of the "Figma-like attributes drive the SVG" requirement.
 */

import { useState } from 'react'
import { boundsFromPoints, metersPerDegLng, ringPathMeters } from '../lib/geo'
import { useEditor, useSingleSelected } from '../store'
import type { Shape } from '../types'

const METERS_PER_DEG_LAT = (Math.PI / 180) * 6_378_137

export function PropertiesPanel() {
  const shape = useSingleSelected()
  const selectionCount = useEditor((s) => s.selection.length)

  if (!shape) {
    return (
      <div className="properties-panel">
        <div className="panel-header">Xususiyatlar</div>
        <div className="empty-hint">
          {selectionCount > 1
            ? `${selectionCount} ta obyekt tanlandi`
            : 'Xususiyatlarini ko\'rish uchun obyekt tanlang'}
        </div>
      </div>
    )
  }

  return (
    <div className="properties-panel">
      <div className="panel-header">Xususiyatlar</div>
      <IdentitySection shape={shape} />
      <GeometrySection shape={shape} />
      <StyleSection shape={shape} />
      <AttributesSection shape={shape} />
    </div>
  )
}

function IdentitySection({ shape }: { shape: Shape }) {
  const setName = useEditor((s) => s.setName)
  return (
    <section className="prop-section">
      <label className="prop-field">
        <span>Nomi</span>
        <input
          value={shape.name}
          onChange={(e) => setName(shape.id, e.target.value)}
        />
      </label>
      <div className="prop-row">
        <div className="prop-field readonly">
          <span>Turi</span>
          <code>{shape.type}</code>
        </div>
        <div className="prop-field readonly">
          <span>ID</span>
          <code>{shape.id}</code>
        </div>
      </div>
    </section>
  )
}

function GeometrySection({ shape }: { shape: Shape }) {
  const b = boundsFromPoints(shape.points)
  const midLat = (b.north + b.south) / 2
  const widthM = Math.abs(b.east - b.west) * metersPerDegLng(midLat)
  const heightM = Math.abs(b.north - b.south) * METERS_PER_DEG_LAT
  const pathM = ringPathMeters(shape.points)

  return (
    <section className="prop-section">
      <div className="prop-section-title">Geometriya</div>
      <div className="prop-row">
        <div className="prop-field readonly">
          <span>Eni (bbox)</span>
          <code>{widthM.toFixed(2)}m</code>
        </div>
        <div className="prop-field readonly">
          <span>Bo'yi (bbox)</span>
          <code>{heightM.toFixed(2)}m</code>
        </div>
      </div>
      <div className="prop-row">
        <div className="prop-field readonly">
          <span>Nuqtalar</span>
          <code>{shape.points.length}</code>
        </div>
        <div className="prop-field readonly">
          <span>Total path</span>
          <code>{pathM.toFixed(2)}m</code>
        </div>
      </div>
      <p className="prop-hint">
        Nuqtalarni tahrirlash uchun obyektga 2 marta bosing.
      </p>
    </section>
  )
}

function StyleSection({ shape }: { shape: Shape }) {
  const setStyle = useEditor((s) => s.setStyle)
  const st = shape.style
  return (
    <section className="prop-section">
      <div className="prop-section-title">Uslub</div>
      <div className="prop-row">
        <label className="prop-field">
          <span>To'ldirish</span>
          <input
            type="color"
            value={st.fill}
            onChange={(e) => setStyle(shape.id, { fill: e.target.value })}
          />
        </label>
        <label className="prop-field">
          <span>Chegara</span>
          <input
            type="color"
            value={st.stroke}
            onChange={(e) => setStyle(shape.id, { stroke: e.target.value })}
          />
        </label>
      </div>
      <label className="prop-field">
        <span>Shaffoflik ({Math.round(st.fillOpacity * 100)}%)</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={st.fillOpacity}
          onChange={(e) =>
            setStyle(shape.id, { fillOpacity: Number(e.target.value) })
          }
        />
      </label>
      <label className="prop-field">
        <span>Chegara qalinligi ({st.strokeWidth})</span>
        <input
          type="range"
          min={0}
          max={6}
          step={0.5}
          value={st.strokeWidth}
          onChange={(e) =>
            setStyle(shape.id, { strokeWidth: Number(e.target.value) })
          }
        />
      </label>
    </section>
  )
}

/** Keys that are derived/managed and shouldn't be hand-edited as free text. */
const MANAGED_KEYS = new Set(['id', 'total-path', 'vertices'])

function AttributesSection({ shape }: { shape: Shape }) {
  const setAttribute = useEditor((s) => s.setAttribute)
  const renameAttribute = useEditor((s) => s.renameAttribute)
  const removeAttribute = useEditor((s) => s.removeAttribute)
  const [newKey, setNewKey] = useState('')

  const entries = Object.entries(shape.attributes)

  const addAttr = () => {
    const key = newKey.trim()
    if (!key || key in shape.attributes) return
    setAttribute(shape.id, key, '')
    setNewKey('')
  }

  return (
    <section className="prop-section">
      <div className="prop-section-title">Atributlar</div>
      <div className="attr-table">
        {entries.map(([key, value]) => {
          const managed = MANAGED_KEYS.has(key)
          return (
            <div className="attr-row" key={key}>
              <input
                className="attr-key"
                value={key}
                disabled={managed}
                onChange={(e) => renameAttribute(shape.id, key, e.target.value)}
              />
              <input
                className="attr-value"
                value={value}
                disabled={managed}
                onChange={(e) => setAttribute(shape.id, key, e.target.value)}
              />
              <button
                className="attr-remove"
                disabled={managed}
                title="O'chirish"
                onClick={() => removeAttribute(shape.id, key)}
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>
      <div className="attr-add">
        <input
          placeholder="yangi atribut nomi"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addAttr()}
        />
        <button onClick={addAttr}>+ qo'shish</button>
      </div>
    </section>
  )
}
