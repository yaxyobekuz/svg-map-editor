/**
 * App shell: a Figma-style three-column layout —
 *   [ Layers ] [  Map canvas + toolbar  ] [ Templates / Properties ]
 * Plus global keyboard shortcuts for tools and deletion.
 */

import { useEffect } from 'react'
import './App.css'
import { LayersPanel } from './components/LayersPanel'
import { MapCanvas } from './components/MapCanvas'
import { PropertiesPanel } from './components/PropertiesPanel'
import { TemplatesPanel } from './components/TemplatesPanel'
import { Toolbar } from './components/Toolbar'
import { useEditor, type Tool } from './store'

const SHORTCUTS: Record<string, Tool> = {
  v: 'select',
  h: 'hand',
  f: 'frame',
  r: 'rect',
}

function useKeyboardShortcuts() {
  const setTool = useEditor((s) => s.setTool)
  const remove = useEditor((s) => s.remove)
  const removeVertex = useEditor((s) => s.removeVertex)
  const clearSelection = useEditor((s) => s.clearSelection)
  const exitVertexEdit = useEditor((s) => s.exitVertexEdit)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ignore while typing in inputs
      const t = e.target as HTMLElement
      if (
        t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.isContentEditable
      ) {
        return
      }

      const { selection, editingId, activeVertex } = useEditor.getState()

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // in vertex-edit mode, Delete removes the active vertex
        if (editingId && activeVertex != null) {
          e.preventDefault()
          removeVertex(editingId, activeVertex)
          useEditor.getState().setActiveVertex(null)
          return
        }
        if (selection.length) {
          e.preventDefault()
          remove(selection)
        }
        return
      }
      if (e.key === 'Escape') {
        if (editingId) {
          exitVertexEdit()
        } else {
          clearSelection()
          setTool('select')
        }
        return
      }
      const tool = SHORTCUTS[e.key.toLowerCase()]
      if (tool && !e.metaKey && !e.ctrlKey) {
        setTool(tool)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTool, remove, removeVertex, clearSelection, exitVertexEdit])
}

export default function App() {
  useKeyboardShortcuts()

  return (
    <div className="app">
      <Toolbar />
      <div className="app-body">
        <LayersPanel />
        <main className="stage">
          <MapCanvas />
        </main>
        <aside className="panel panel-right">
          <TemplatesPanel />
          <div className="panel-divider" />
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  )
}
