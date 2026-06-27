/**
 * Top toolbar: tool switcher (select / frame / rect / polygon / hand) plus the
 * SVG export action. Figma-style compact icon bar.
 */

import { downloadSvg, exportSvg } from '../lib/exportSvg'
import { useEditor, type Tool } from '../store'

const TOOLS: { id: Tool; label: string; icon: string; hint: string }[] = [
  { id: 'select', label: 'Tanlash', icon: '⌖', hint: 'Tanlash / ko\'chirish (V)' },
  { id: 'hand', label: 'Qo\'l', icon: '✋', hint: 'Xaritani surish (H)' },
  { id: 'frame', label: 'Frame', icon: '⬚', hint: 'Frame chizish (F)' },
  { id: 'rect', label: 'Rectangle', icon: '▭', hint: 'Rectangle chizish (R)' },
]

export function Toolbar() {
  const tool = useEditor((s) => s.tool)
  const setTool = useEditor((s) => s.setTool)
  const shapes = useEditor((s) => s.shapes)
  const order = useEditor((s) => s.order)

  const handleExport = () => {
    const svg = exportSvg(shapes, order)
    downloadSvg(svg)
  }

  const count = order.length

  return (
    <div className="toolbar">
      <div className="toolbar-brand">
        <span className="brand-dot" />
        SVG Map Editor
      </div>

      <div className="toolbar-tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tool-btn ${tool === t.id ? 'active' : ''}`}
            title={t.hint}
            onClick={() => setTool(t.id)}
          >
            <span className="tool-icon">{t.icon}</span>
            <span className="tool-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-right">
        <span className="shape-count">{count} obyekt</span>
        <button
          className="export-btn"
          onClick={handleExport}
          disabled={count === 0}
          title="SVG sifatida yuklab olish"
        >
          ⬇ SVG eksport
        </button>
      </div>
    </div>
  )
}
