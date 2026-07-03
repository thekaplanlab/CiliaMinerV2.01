/**
 * /gene/[symbol] — server component wrapper.
 *
 * This file is a server component (no 'use client') so it can export
 * generateStaticParams(), which Next.js requires under output: 'export'.
 *
 * At build time we read public/data/ciliopathy_genes_v15.json from disk and
 * emit one static page per gene symbol. At runtime the (static) page mounts
 * the client component, which fetches the same JSON over HTTP and renders.
 */

import { promises as fs } from 'fs'
import path from 'path'
import GeneDetailClient from './GeneDetailClient'

interface RawMaster {
  genes: Record<string, unknown>
}

async function readMaster(): Promise<RawMaster> {
  const file = path.join(process.cwd(), 'public', 'data', 'ciliopathy_genes_v15.json')
  const raw = await fs.readFile(file, 'utf-8')
  return JSON.parse(raw)
}

export async function generateStaticParams() {
  const master = await readMaster()
  return Object.keys(master.genes || {}).map((symbol) => ({ symbol }))
}

// dynamicParams=false ensures that unknown symbols 404 at build time rather
// than trying to render on-demand (which output: 'export' can't do anyway).
export const dynamicParams = false

interface PageProps {
  // In Next 15+, params is a Promise.
  params: Promise<{ symbol: string }>
}

export default async function GenePage({ params }: PageProps) {
  const { symbol } = await params
  return <GeneDetailClient symbol={symbol} />
}
