'use client'

/**
 * SvgBarChart — horizontal bar chart rendered as inline SVG, with
 * per-chart "Download SVG" and "Download PNG" buttons.
 *
 * Why inline SVG (not a chart library):
 *   - what the user sees is exactly what they download (no canvas re-render)
 *   - vector output is editable in Illustrator / Inkscape for figure prep
 *   - no extra dependency, ~200 lines self-contained
 *
 * Download mechanics:
 *   - SVG: serialize the ref'd element, prepend chart title, ship as
 *     standalone .svg with embedded stylesheet
 *   - PNG: serialize → Image → 2x canvas → toBlob('image/png'), white
 *     background fill so the result drops cleanly into white slides
 */

import React, { useRef } from 'react'
import { Download, Image as ImageIcon } from 'lucide-react'

export interface SvgBarChartProps {
  title:     string
  entries:   ReadonlyArray<readonly [string, number]>
  max:       number
  filename:  string                                        // basename for downloads, no extension
  hrefBase?: (label: string) => string                     // optional click-through per row
  color?:    string                                        // bar fill, default red-800
}

export function SvgBarChart({
  title, entries, max, filename, hrefBase, color = '#991b1b',
}: SvgBarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  // ── Geometry ─────────────────────────────────────────────────────
  const padding    = { top: 8, right: 50, bottom: 8, left: 200 }
  const barHeight  = 18
  const gap        = 6
  const rowHeight  = barHeight + gap
  const innerWidth = 230
  const width      = padding.left + innerWidth + padding.right
  const chartHeight = padding.top + Math.max(1, entries.length) * rowHeight + padding.bottom
  // Extra space at top for the title row that's inserted on download
  const TITLE_HEIGHT = 28

  function truncate(s: string, n = 30): string {
    return s.length > n ? s.slice(0, n - 1) + '…' : s
  }

  // ── Build a standalone SVG string (with title bar + xmlns) ──────
  function buildStandaloneSvgString(): string | null {
    if (!svgRef.current) return null
    const ns = 'http://www.w3.org/2000/svg'
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement

    // Shift the existing viewBox down to make room for the title row
    const newHeight = chartHeight + TITLE_HEIGHT
    clone.setAttribute('viewBox', `0 -${TITLE_HEIGHT} ${width} ${newHeight}`)
    clone.setAttribute('width',  String(width))
    clone.setAttribute('height', String(newHeight))
    clone.setAttribute('xmlns',   ns)

    // Insert title text
    const titleEl = document.createElementNS(ns, 'text')
    titleEl.setAttribute('x',           String(width / 2))
    titleEl.setAttribute('y',           '-10')
    titleEl.setAttribute('text-anchor', 'middle')
    titleEl.setAttribute('font-size',   '13')
    titleEl.setAttribute('font-weight', '600')
    titleEl.setAttribute('font-family', "'Plus Jakarta Sans', system-ui, sans-serif")
    titleEl.setAttribute('fill',        '#1c1917')
    titleEl.textContent = title
    clone.insertBefore(titleEl, clone.firstChild)

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
           new XMLSerializer().serializeToString(clone)
  }

  function triggerDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href = url; a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  function downloadSvg() {
    const xml = buildStandaloneSvgString()
    if (!xml) return
    triggerDownload(new Blob([xml], { type: 'image/svg+xml' }), `${filename}.svg`)
  }

  function downloadPng() {
    const xml = buildStandaloneSvgString()
    if (!xml) return
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const img  = new Image()
    const totalHeight = chartHeight + TITLE_HEIGHT
    img.onload = () => {
      const scale  = 2
      const canvas = document.createElement('canvas')
      canvas.width  = width * scale
      canvas.height = totalHeight * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); return }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((png) => {
        URL.revokeObjectURL(url)
        if (png) triggerDownload(png, `${filename}.png`)
      }, 'image/png')
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }

  // ── Empty state ─────────────────────────────────────────────────
  if (entries.length === 0) {
    return <p className="text-xs text-stone-400 italic">No data to display.</p>
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-end gap-1 mb-2">
        <button
          type="button"
          onClick={downloadSvg}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-50 hover:bg-white border border-stone-200 hover:border-red-800 hover:text-red-800 transition rounded text-[11px] font-semibold text-stone-700"
          title="Download as SVG (vector — for posters, papers, Illustrator)"
          aria-label={`Download ${title} as SVG`}
        >
          <Download className="w-3 h-3" aria-hidden="true" />
          <span>SVG</span>
        </button>
        <button
          type="button"
          onClick={downloadPng}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-50 hover:bg-white border border-stone-200 hover:border-red-800 hover:text-red-800 transition rounded text-[11px] font-semibold text-stone-700"
          title="Download as PNG (raster — for slides, docs)"
          aria-label={`Download ${title} as PNG`}
        >
          <ImageIcon className="w-3 h-3" aria-hidden="true" />
          <span>PNG</span>
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${chartHeight}`}
        width="100%"
        style={{ display: 'block', maxHeight: `${chartHeight}px` }}
        role="img"
        aria-label={`${title} bar chart`}
      >
        <style>
          {`
            .bar { fill: ${color}; opacity: 0.85; }
            .bar:hover { opacity: 1; }
            .lbl, .val { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: 11px; }
            .lbl { fill: #44403c; }
            .val { fill: #78716c; font-variant-numeric: tabular-nums; }
            .lbl-link { cursor: pointer; }
            .lbl-link:hover { fill: ${color}; }
            .grid { stroke: #e7e5e4; stroke-width: 0.5; }
          `}
        </style>
        {/* Light vertical grid lines at 25/50/75/100% */}
        {[0.25, 0.5, 0.75, 1.0].map((frac, i) => (
          <line
            key={i}
            x1={padding.left + frac * innerWidth}
            x2={padding.left + frac * innerWidth}
            y1={padding.top}
            y2={padding.top + entries.length * rowHeight - gap}
            className="grid"
          />
        ))}
        {entries.map(([label, value], i) => {
          const y       = padding.top + i * rowHeight
          const barW    = max > 0 ? (value / max) * innerWidth : 0
          const display = truncate(label)
          const labelEl = (
            <text
              x={padding.left - 8}
              y={barHeight / 2}
              dy="0.35em"
              textAnchor="end"
              className={hrefBase ? 'lbl lbl-link' : 'lbl'}
            >
              <title>{label}</title>
              {display}
            </text>
          )
          return (
            <g key={`${label}-${i}`} transform={`translate(0, ${y})`}>
              {hrefBase ? <a href={hrefBase(label)}>{labelEl}</a> : labelEl}
              <rect
                x={padding.left}
                y={0}
                width={Math.max(1, barW)}
                height={barHeight}
                className="bar"
                rx={1}
              />
              <text
                x={padding.left + barW + 4}
                y={barHeight / 2}
                dy="0.35em"
                className="val"
              >
                {value}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
