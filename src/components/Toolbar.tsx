/**
 * Top toolbar: brand, grid/snap toggles and the SVG export action. The tool
 * switcher (select / hand / frame / rect) lives in a separate floating bar
 * pinned to the bottom-center of the canvas (see ToolBar below), Figma-style.
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
  const shapes = useEditor((s) => s.shapes)
  const order = useEditor((s) => s.order)
  const gridVisible = useEditor((s) => s.gridVisible)
  const snapEnabled = useEditor((s) => s.snapEnabled)
  const toggleGrid = useEditor((s) => s.toggleGrid)
  const toggleSnap = useEditor((s) => s.toggleSnap)

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

      <div className="toolbar-toggles">
        <button
          className={`toggle-btn ${gridVisible ? 'active' : ''}`}
          title="Grid (to'r) ko'rsatish"
          onClick={toggleGrid}
        >
          <span className="tool-icon">▦</span>
          <span className="tool-label">Grid</span>
        </button>
        <button
          className={`toggle-btn ${snapEnabled ? 'active' : ''}`}
          title="Nuqtalarni grid kesishmalariga yopishtirish (magnit)"
          onClick={toggleSnap}
        >
          <span className="tool-icon">🧲</span>
          <span className="tool-label">Snap</span>
        </button>
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

/**
 * Floating tool switcher pinned to the bottom-center of the canvas, Figma-style.
 */
export function ToolBar() {
  const tool = useEditor((s) => s.tool)
  const setTool = useEditor((s) => s.setTool)

  return (
    <div className="floating-toolbar">
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
  )
}
