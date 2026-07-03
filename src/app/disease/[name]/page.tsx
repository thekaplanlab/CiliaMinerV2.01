/**
 * /disease/[name] — server component wrapper.
 *
 * Mirror of /gene/[symbol]/page.tsx. Reads the v15 master at build time and
 * emits one static page per disease name. Disease names go through Next's
 * URL encoding automatically (spaces → %20, etc.).
 */

import { promises as fs } from 'fs'
import path from 'path'
import DiseaseDetailClient from './DiseaseDetailClient'

interface RawMaster {
  genes?: Record<string, { ciliopathies?: string[] }>
  disease_classifications?: Record<string, string>
  disease_synonyms?: Record<string, unknown>
  diseases_by_class?: Record<string, string[]>
}

async function readMaster(): Promise<RawMaster> {
  const file = path.join(process.cwd(), 'public', 'data', 'ciliopathy_genes_v15.json')
  const raw = await fs.readFile(file, 'utf-8')
  return JSON.parse(raw)
}

export async function generateStaticParams() {
  const master = await readMaster()
  const all = new Set<string>()
  for (const n of Object.keys(master.disease_classifications ?? {})) all.add(n)
  for (const n of Object.keys(master.disease_synonyms ?? {})) all.add(n)
  for (const dlist of Object.values(master.diseases_by_class ?? {})) {
    if (Array.isArray(dlist)) dlist.forEach((n) => all.add(n))
  }
  for (const g of Object.values(master.genes ?? {})) {
    (g?.ciliopathies ?? []).forEach((n: string) => all.add(n))
  }
  return Array.from(all).map((name) => ({ name }))
}

export const dynamicParams = false

interface PageProps {
  params: Promise<{ name: string }>
}

export default async function DiseasePage({ params }: PageProps) {
  const { name } = await params
  return <DiseaseDetailClient name={name} />
}
