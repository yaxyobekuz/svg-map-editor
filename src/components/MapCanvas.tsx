/**
 * The center stage: the Google Maps satellite background with the interactive
 * SVG editing overlay stacked on top. Also handles dropping templates from the
 * right sidebar onto the map (drag & drop), placing them at the cursor's geo
 * position.
 */

import { useEffect, useRef, useState } from 'react'
import { useGoogleMap } from '../lib/useGoogleMap'
import { useEditor } from '../store'
import { SvgOverlay } from './SvgOverlay'

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)
  const { projector, version, status, error } = useGoogleMap(mapDivRef)
  const dropTemplate = useEditor((s) => s.dropTemplate)

  const [size, setSize] = useState({ width: 0, height: 0 })

  // Track the container size for the SVG overlay.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)
    setSize({ width: el.clientWidth, height: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-template')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  const onDrop = (e: React.DragEvent) => {
    const templateId = e.dataTransfer.getData('application/x-template')
    if (!templateId || !projector) return
    e.preventDefault()
    const rect = containerRef.current!.getBoundingClientRect()
    const px = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    const topLeft = projector.toLatLng(px)
    if (topLeft) dropTemplate(templateId, topLeft)
  }

  return (
    <div
      ref={containerRef}
      className="map-canvas"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Google Maps mounts here */}
      <div ref={mapDivRef} className="map-bg" />

      {/* SVG editor overlay */}
      <SvgOverlay
        projector={projector}
        version={version}
        width={size.width}
        height={size.height}
      />

      {status === 'no-key' && <NoKeyNotice />}
      {status === 'error' && <ErrorNotice error={error} />}
      {status === 'loading' && (
        <div className="map-status">Xarita yuklanmoqda…</div>
      )}
    </div>
  )
}

function NoKeyNotice() {
  return (
    <div className="map-overlay-notice">
      <div className="notice-card">
        <h2>Google Maps API kaliti kerak</h2>
        <p>
          Suniy yo'ldosh xaritasini ko'rsatish uchun Google Maps API kalitini
          kiriting.
        </p>
        <ol>
          <li>
            <code>.env.example</code> faylini <code>.env.local</code> ga nusxa
            oling
          </li>
          <li>
            <code>VITE_GOOGLE_MAPS_API_KEY=...</code> qatoriga kalitingizni
            qo'ying
          </li>
          <li>Dev serverni qayta ishga tushiring</li>
        </ol>
        <p className="notice-hint">
          Kalit yo'q bo'lsa ham, editor vositalarini sinab ko'rishingiz mumkin —
          faqat fonda xarita ko'rinmaydi.
        </p>
      </div>
    </div>
  )
}

function ErrorNotice({ error }: { error?: string }) {
  return (
    <div className="map-overlay-notice">
      <div className="notice-card error">
        <h2>Xarita yuklanmadi</h2>
        <p>{error ?? "Noma'lum xatolik"}</p>
        <p className="notice-hint">
          API kalitingiz to'g'riligini va "Maps JavaScript API" yoqilganligini
          tekshiring.
        </p>
      </div>
    </div>
  )
}
