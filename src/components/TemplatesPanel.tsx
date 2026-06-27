/**
 * Right sidebar (top): the template palette. Each template is a draggable card;
 * dragging it onto the map drops the template at the cursor's geo location.
 *
 * A small SVG thumbnail previews each template's structure (frame + children).
 */

import { TEMPLATES } from '../lib/templates'
import type { Template } from '../types'

export function TemplatesPanel() {
  const onDragStart = (e: React.DragEvent, template: Template) => {
    e.dataTransfer.setData('application/x-template', template.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="templates-panel">
      <div className="panel-header">Shablonlar</div>
      <p className="panel-subhint">Xaritaga sudrab tashlang</p>
      <div className="template-grid">
        {TEMPLATES.map((t) => (
          <div
            key={t.id}
            className="template-card"
            draggable
            onDragStart={(e) => onDragStart(e, t)}
            title={t.description}
          >
            <div className="template-thumb">
              <TemplateThumb template={t} />
            </div>
            <div className="template-meta">
              <div className="template-name">{t.name}</div>
              <div className="template-size">
                {t.size.width}×{t.size.height}m
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TemplateThumb({ template }: { template: Template }) {
  const { width, height } = template.size
  const pad = 1
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    >
      {template.nodes.map((n, i) => {
        if (!n.rect) return null
        return (
          <rect
            key={i}
            x={n.rect.x}
            y={n.rect.y}
            width={n.rect.width}
            height={n.rect.height}
            fill={n.style.fill}
            fillOpacity={n.style.fillOpacity}
            stroke={n.style.stroke}
            strokeWidth={0.3}
            strokeDasharray={n.type === 'frame' ? '0.8 0.5' : undefined}
          />
        )
      })}
    </svg>
  )
}
