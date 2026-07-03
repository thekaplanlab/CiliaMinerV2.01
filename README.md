# CiliaMiner search redesign — patch v2

This patch redesigns `/advanced-search` and adds dedicated detail pages
for genes and diseases. Everything is backed by the v15 master JSON.

## What's in the bundle

```
ciliaminer-update/
├── src/
│   ├── app/
│   │   ├── page.tsx                       ← REPLACED  (home — already deployed in v1)
│   │   ├── advanced-search/
│   │   │   └── page.tsx                   ← REPLACED  (Google-style results list w/ tabs)
│   │   ├── gene/[symbol]/
│   │   │   └── page.tsx                   ← NEW       (gene detail page)
│   │   └── disease/[name]/
│   │       └── page.tsx                   ← NEW       (disease detail page)
│   └── lib/
│       ├── searchIndex.ts                 ← REPLACED  (suggestion hrefs now go to detail pages)
│       └── masterData.ts                  ← NEW       (lazy loader for the full v15 JSON)
├── public/data/
│   ├── ciliopathy_genes_v15.json          ← (same file as v1, unchanged)
│   └── search_index.json                  ← (same file as v1, unchanged)
└── scripts/
    └── build_search_index.py              ← (same file as v1, unchanged)
```

## What changed in this round

* **Home page** — gene/disease suggestions now link directly to the
  appropriate detail page (`/gene/<symbol>` or `/disease/<name>`)
  instead of `/advanced-search?q=...`. The "Search" button still
  routes to `/advanced-search?q=...` for free-text queries.

* **/advanced-search** — completely rewritten. No more xlsx pipeline.
  - Single search bar at top (same look as the home page)
  - Tabs: **All · Genes · Diseases** with live counts
  - Google-style result cards: gene cards show diseases + class + OMIM
    + synonyms; disease cards show class + gene count + abbreviation
    + synonyms. Each card links to its detail page.
  - 20 results per page, with previous / next pager
  - Full keyboard handling on the bar's autocomplete (↑/↓/Enter/Esc)

* **/gene/[symbol]** — new detail page. Renders:
  - Big mono gene symbol header, plain-English description
  - External-ID strip: OMIM, Ensembl, UniProt, NCBI Gene (each opens
    in a new tab to the canonical source)
  - **Associated ciliopathies** list — each linked to its disease page
  - **Functional summary** paragraph with PubMed IDs auto-linked
  - **At a glance** grid: localization, functional category,
    protein complex, pan/idio class, synonyms
  - **Phenotypes**: human + mouse (when available)
  - **References**: every PMID as a PubMed link
  - Curation notes (when present)

* **/disease/[name]** — new detail page. Renders:
  - Disease name, class label, OMIM preferred name, abbreviation
  - Classification rationale (one-liner from the v15 master)
  - Synonym chips + notes
  - **Associated genes** grid — clickable, monospace, sorted alphabetically

* **masterData.ts** — lazy loader. The full 1.1 MB master file is only
  fetched the first time someone opens a detail page. Cached
  module-globally so subsequent detail pages are instant.

## Install

From `/var/www/CiliaMiner/CiliaMinerV2.01/`:

```bash
# 1. Upload the zip to the server (run on your Mac):
#    scp ciliaminer-update.zip root@161.97.146.90:/var/www/CiliaMiner/CiliaMinerV2.01/

# 2. On the server, unzip and replace files in-place:
cd /var/www/CiliaMiner/CiliaMinerV2.01
unzip -o ciliaminer-update.zip
# This drops new files under ciliaminer-update/ — move them into the project:
cp -r ciliaminer-update/. .
rm -rf ciliaminer-update ciliaminer-update.zip

# 3. Rebuild and restart
rm -rf .next
npm run build
pm2 reload all
```

## What to test once it's deployed

1. **Home page**: type `BBS1` → click the dropdown item → should land on `/gene/BBS1`
2. **Home page**: type `Joubert` → click the dropdown item → should land on `/disease/Joubert%20Syndrome`
3. **Free-text search**: home page → type `obesity` → click Search button → should land on `/advanced-search?q=obesity` with mixed results
4. **Tabs**: on the results page, click `Genes` / `Diseases` — URL should update to `?q=...&type=...` and counts should match
5. **Pagination**: `/advanced-search?q=cep` should have ~20+ genes; pager at the bottom should let you flip pages
6. **Detail pages**: click a gene card on the results page → detail page loads. Click an "Associated ciliopathy" → goes to the disease page. Click a gene chip on a disease page → goes back to the gene page.
7. **External links**: on any gene detail page, click the OMIM/Ensembl/UniProt/NCBI links — each should open the right external page in a new tab.

## Inner pages still on the old pipeline

These pages still read from the old xlsx and aren't part of this patch:
* `/ciliopathy-classification`
* `/genes-orthologs`
* `/symptoms-diseases`
* `/analysis`
* `/about`

They'll keep working as before. Migrating them is the next chunk of work.
