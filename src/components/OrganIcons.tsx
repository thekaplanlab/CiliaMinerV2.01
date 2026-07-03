/**
 * OrganIcons — filled SVG icons for the 16 organ systems.
 *
 * Solid silhouettes (fill=currentColor, stroke=none) modelled after the
 * reference design — readable at 16-20 px in the sidebar. All use
 * currentColor, so a parent `text-amber-600` colours every icon at once;
 * change one classname to recolour the whole set.
 */

import React from 'react'

type IconProps = { className?: string }

const SVG_BASE = {
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  stroke: 'none' as const,
  'aria-hidden': true,
}

// ── 16 organ icons ─────────────────────────────────────────────────────

function EarIcon({ className }: IconProps) {
  return (
    <svg className={className} {...SVG_BASE}>
      <path d="M9 2.5C6.2 2.5 4 4.7 4 8.2c0 2 .8 3 1.6 4.2.7 1 1.4 2.1 1.4 3.6 0 2.3 2 4.5 4.5 4.5 2 0 3.5-1.6 3.5-3.5 0-1.6-.8-2.5-.8-3.5 0-1 1-1.5 2.3-2.5 1.4-1 2.5-2.5 2.5-4.5C19 4 16.5 2.5 13 2.5c-1 0-2 .3-3 .8-.4-.5-.8-.8-1-.8z" />
      <circle cx="11" cy="9.5" r="1.5" fill="#faf9f6" />
    </svg>
  )
}

function BrainIcon({ className }: IconProps) {
  return (
    <svg className={className} {...SVG_BASE}>
      <path d="M8.5 3.5C6 3.5 4 5.5 4 8c0 1 .3 1.8.8 2.5C3.7 11.2 3 12.3 3 13.7c0 2.4 1.9 4.3 4.3 4.3.3 1.4 1.6 2.5 3.2 2.5 1.5 0 2.5-.7 2.5-1.7V4.5c0-.5-.4-1-1-1-.6 0-1 .3-1.4.7-.5-.4-1.3-.7-2.1-.7zM15.5 3.5c-.8 0-1.6.3-2.1.7v15.6c0 1 1 1.7 2.5 1.7 1.6 0 2.9-1.1 3.2-2.5 2.4 0 4.3-1.9 4.3-4.3 0-1.4-.7-2.5-1.8-3.2.5-.7.8-1.5.8-2.5 0-2.5-2-4.5-4.5-4.5-.8 0-1.6.3-2.1.7-.4-.4-.8-.7-1.4-.7-.6 0-1 .5-1 1z" />
    </svg>
  )
}

function HeartIcon({ className }: IconProps) {
  return (
    <svg className={className} {...SVG_BASE}>
      <path d="M12 21S3 15.5 3 9.2C3 6.3 5.3 4 8.2 4c1.8 0 3 .9 3.8 2.1C12.8 4.9 14 4 15.8 4 18.7 4 21 6.3 21 9.2 21 15.5 12 21 12 21z" />
    </svg>
  )
}

function FaceIcon({ className }: IconProps) {
  return (
    <svg className={className} {...SVG_BASE}>
      <path d="M15.5 2.5c-4.5-.8-8.5 1.5-9.5 6-.5 2-1 3-2 5 -.5 1 0 1.8 1 2 0 2.5 2.5 4.5 6 4.5 1.5 0 2.5-1 3-2 .5-1.5 2-2 3-3.5 1-1.5 1-3.5.5-5 -.5-1.7 0-3-.5-4.5-.4-1.4-1-2.5-1.5-2.5z" />
      <circle cx="9.5" cy="10.5" r="0.9" fill="#faf9f6" />
      <path d="M8 14.5c.7.5 1.7.5 2.5 0" stroke="#faf9f6" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function GlandIcon({ className }: IconProps) {
  return (
    <svg className={className} {...SVG_BASE}>
      <path d="M8 5C6 5 5 7 5 10c0 4 2 8 4.5 8 1.7 0 2.5-1.2 2.5-3v-3H9c-.5 0-1-.5-1-1s.5-1 1-1h3V9c0-2.5-1.5-4-4-4zM16 5c2 0 3 2 3 5 0 4-2 8-4.5 8-1.7 0-2.5-1.2-2.5-3v-3h3c.5 0 1-.5 1-1s-.5-1-1-1h-3V9c0-2.5 1.5-4 4-4z" />
    </svg>
  )
}

function EyeIcon({ className }: IconProps) {
  return (
    <svg className={className} {...SVG_BASE}>
      <path d="M2 12C5 7 8 4.5 12 4.5S19 7 22 12c-3 5-6 7.5-10 7.5S5 17 2 12z" />
      <circle cx="12" cy="12" r="3.5" fill="#faf9f6" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  )
}

function StomachIcon({ className }: IconProps) {
  return (
    <svg className={className} {...SVG_BASE}>
      <path d="M10 2.5v4H8C6 6.5 4.5 8 4.5 11c0 5 3 9 8 9 4 0 7-2 7-6 0-3.5-2.5-6-5.5-6h-.5V2.5h-3.5z" />
    </svg>
  )
}

function BloodIcon({ className }: IconProps) {
  return (
    <svg className={className} {...SVG_BASE}>
      <path d="M12 2.5S5 12 5 16c0 3.5 3 6.5 7 6.5s7-3 7-6.5C19 12 12 2.5 12 2.5z" />
      <circle cx="10.5" cy="15.5" r="1.5" fill="#faf9f6" />
      <circle cx="14" cy="13" r="1" fill="#faf9f6" />
    </svg>
  )
}

function LiverIcon({ className }: IconProps) {
  return (
    <svg className={className} {...SVG_BASE}>
      <path d="M3 8c0-2 2-3 4-3h11c2 0 3 1.5 3 3.5v3c0 2.5-2 4-4.5 4H8c-3 0-5-1.5-5-4.5z" />
      <rect x="10.5" y="5.5" width="1" height="10" fill="#faf9f6" />
    </svg>
  )
}

function FlaskIcon({ className }: IconProps) {
  return (
    <svg className={className} {...SVG_BASE}>
      <path d="M9 3v6L5.2 17c-.5 1 .3 2 1.3 2h11c1 0 1.8-1 1.3-2L15 9V3H9z" />
      <rect x="8" y="2" width="8" height="1.5" rx="0.4" />
      <rect x="6.5" y="14" width="11" height="1" fill="#faf9f6" />
    </svg>
  )
}

function KidneyIcon({ className }: IconProps) {
  return (
    <svg className={className} {...SVG_BASE}>
      <path d="M9 3.5C6 3.5 3.5 6.5 3.5 11c0 5 3 9.5 7.5 9.5 2.5 0 3.5-1.7 3.5-3.5 0-1.5-.5-2.5 0-3.5.5-1 1.5-2 1.5-4 0-3-2.5-6-5-6h-2z" />
      <path d="M12 12l1.5 1" stroke="#faf9f6" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function ReproductiveIcon({ className }: IconProps) {
  return (
    <svg className={className} {...SVG_BASE}>
      <path d="M6 7c0-2 1.5-3.5 3.5-3.5h5C16.5 3.5 18 5 18 7v3c0 5-3 8.5-6 8.5s-6-3.5-6-8.5V7z" />
      <circle cx="3.5" cy="5" r="1.3" />
      <circle cx="20.5" cy="5" r="1.3" />
      <path d="M6 7L3.5 5M18 7l2.5-2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function LungsIcon({ className }: IconProps) {
  return (
    <svg className={className} {...SVG_BASE}>
      <rect x="11.4" y="3.5" width="1.2" height="16" rx="0.4" />
      <path d="M8 7c-2.5 0-4.5 2-5.5 5C1.5 16 2.5 19 5 19c2 0 3.5-1 3.5-3V8c0-.5-.2-1-.5-1z" />
      <path d="M16 7c2.5 0 4.5 2 5.5 5 1 4 0 7-2.5 7-2 0-3.5-1-3.5-3V8c0-.5.2-1 .5-1z" />
    </svg>
  )
}

function BoneIcon({ className }: IconProps) {
  return (
    <svg className={className} {...SVG_BASE}>
      <path d="M5 8.5c0-1.7 1.3-3 3-3 1.1 0 1.6.5 2.1 1.1h3.8c.5-.6 1-1.1 2.1-1.1 1.7 0 3 1.3 3 3 0 1-.4 1.6-.9 2.1.5.5.9 1.1.9 2.1 0 1.7-1.3 3-3 3-1.1 0-1.6-.5-2.1-1.1H10.1c-.5.6-1 1.1-2.1 1.1-1.7 0-3-1.3-3-3 0-1 .4-1.6.9-2.1-.5-.5-.9-1.1-.9-2.1z" />
    </svg>
  )
}

function FingerprintIcon({ className }: IconProps) {
  // Stroked rather than filled — fingerprints are inherently linear.
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12c0-3.9 3.1-7 7-7s7 3.1 7 7c0 2.3-1.2 4-3.5 5" />
      <path d="M7.5 12c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5c0 2-1.5 3.5-3.5 4" />
      <path d="M10 12c0-1.1.9-2 2-2s2 .9 2 2c0 1.1-.6 1.8-1.5 2.2" />
    </svg>
  )
}

function VesselIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v16" />
      <path d="M12 8L8 11 5 10" />
      <path d="M12 8l4 3 3-1" />
      <path d="M12 14L8 17 5 16" />
      <path d="M12 14l4 3 3-1" />
    </svg>
  )
}

function CircleIcon({ className }: IconProps) {
  return (
    <svg className={className} {...SVG_BASE}>
      <circle cx="12" cy="12" r="6" />
    </svg>
  )
}

// ── Resolver ──────────────────────────────────────────────────────────

const MAP: Record<string, (p: IconProps) => React.ReactElement> = {
  Auditory:           EarIcon,
  CNS:                BrainIcon,
  Cardiac:            HeartIcon,
  Craniofacial:       FaceIcon,
  Endocrine:          GlandIcon,
  Eye:                EyeIcon,
  GI_Abdominal:       StomachIcon,
  Hematologic_Immune: BloodIcon,
  Hepatic:            LiverIcon,
  Methodology:        FlaskIcon,
  Renal:              KidneyIcon,
  Reproductive:       ReproductiveIcon,
  Respiratory:        LungsIcon,
  Skeletal:           BoneIcon,
  Skin_Hair_Nail:     FingerprintIcon,
  Vascular:           VesselIcon,
}

export function OrganIcon({
  organ, className = 'w-5 h-5',
}: { organ: string; className?: string }) {
  const Component = MAP[organ] ?? CircleIcon
  return <Component className={className} />
}
