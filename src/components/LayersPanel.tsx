/**
 * Left sidebar: the layer tree (Figma-style). Shows the hierarchy of frames and
 * their children, with select / visibility / lock toggles.
 */

import { useEditor } from '../store'
import type { Shape } from '../types'

const TYPE_ICON: Record<Shape['type'], string> = {
  frame: '⬚',
  rect: '▭',
}

export function LayersPanel() {
  const shapes = useEditor((s) => s.shapes)
  const order = useEditor((s) => s.order)

  // top-level shapes, in z-order (reversed so topmost is first, like Figma)
  const roots = [...order]
    .map((id) => shapes[id])
    .filter((s): s is Shape => !!s && s.parentId == null)
    .reverse()

  return (
    <aside className="panel panel-left">
      <div className="panel-header">Qatlamlar</div>
      <div className="layer-tree">
        {roots.length === 0 && (
          <div className="empty-hint">
            Hali obyekt yo'q. Frame yoki rectangle chizing, yoki o'ngdan shablon
            tashlang.
          </div>
        )}
        {roots.map((s) => (
          <LayerRow key={s.id} shape={s} depth={0} />
        ))}
      </div>
    </aside>
  )
}

function LayerRow({ shape, depth }: { shape: Shape; depth: number }) {
  const order = useEditor((s) => s.order)
  const shapes = useEditor((s) => s.shapes)
  const selection = useEditor((s) => s.selection)
  const toggleSelect = useEditor((s) => s.toggleSelect)
  const setVisible = useEditor((s) => s.setVisible)
  const setLocked = useEditor((s) => s.setLocked)

  const children = order
    .map((id) => shapes[id])
    .filter((c): c is Shape => !!c && c.parentId === shape.id)

  const selected = selection.includes(shape.id)

  return (
    <>
      <div
        className={`layer-row ${selected ? 'selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={(e) => toggleSelect(shape.id, e.shiftKey)}
      >
        <span className="layer-icon">{TYPE_ICON[shape.type]}</span>
        <span className="layer-name">{shape.name}</span>
        <button
          className="layer-toggle"
          title={shape.visible ? 'Yashirish' : "Ko'rsatish"}
          onClick={(e) => {
            e.stopPropagation()
            setVisible(shape.id, !shape.visible)
          }}
        >
          {shape.visible ? '👁' : '🚫'}
        </button>
        <button
          className="layer-toggle"
          title={shape.locked ? 'Qulfni ochish' : 'Qulflash'}
          onClick={(e) => {
            e.stopPropagation()
            setLocked(shape.id, !shape.locked)
          }}
        >
          {shape.locked ? '🔒' : '🔓'}
        </button>
      </div>
      {children.map((c) => (
        <LayerRow key={c.id} shape={c} depth={depth + 1} />
      ))}
    </>
  )
}
