#!/usr/bin/env python3
"""
build_search_index.py
=====================

Rebuilds the lightweight search index used by the home-page search box.

Reads:   public/data/ciliopathy_genes_v15.json
         (or pass --src to point at a different master file)
Writes:  public/data/search_index.json

Usage from repo root:
    python3 scripts/build_search_index.py
    python3 scripts/build_search_index.py --src public/data/ciliopathy_genes_v15.json

This script is idempotent. Re-running it overwrites the index with the
current master file. Run it whenever you replace or update the master
JSON.
"""
import argparse
import json
import os
import sys


def build(src_path: str, out_path: str) -> None:
    with open(src_path) as f:
        master = json.load(f)

    genes_in = master.get('genes') or {}
    disease_synonyms = master.get('disease_synonyms', {}) or {}
    disease_classifications = master.get('disease_classifications', {}) or {}
    diseases_by_class = master.get('diseases_by_class', {}) or {}
    metadata = master.get('metadata', {}) or {}

    # -- gene side --
    genes_index = []
    disease_gene_counts = {}  # disease -> set of gene symbols

    for symbol, g in genes_in.items():
        raw_syns = g.get('synonyms', []) or []
        seen = {symbol.upper()}
        syns = []
        for s in raw_syns:
            if not s:
                continue
            su = s.strip()
            if not su:
                continue
            if su.upper() == symbol.upper():
                continue
            if su.startswith('ENSG'):
                continue  # noisy, not what users type
            if su.upper() in seen:
                continue
            seen.add(su.upper())
            syns.append(su)

        diseases = g.get('ciliopathies', []) or []
        classes = g.get('ciliopathy_classes', []) or []

        for d in diseases:
            disease_gene_counts.setdefault(d, set()).add(symbol)

        entry = {
            'g': symbol,
            's': syns,
            'd': diseases,
            'c': classes,
            'n': len(diseases),
        }
        omim = g.get('omim_id')
        if omim:
            entry['o'] = str(omim)
        genes_index.append(entry)

    # -- disease side --
    all_disease_names = set(disease_classifications.keys())
    all_disease_names |= set(disease_synonyms.keys())
    all_disease_names |= set(disease_gene_counts.keys())
    for dlist in diseases_by_class.values():
        if isinstance(dlist, list):
            all_disease_names.update(dlist)

    diseases_index = []
    for d in sorted(all_disease_names):
        syn_block = disease_synonyms.get(d, {}) or {}
        entry = {
            'n': d,
            'c': disease_classifications.get(d, 'Unclassified'),
            's': syn_block.get('synonyms', []) or [],
            'a': syn_block.get('abbreviation', '') or '',
            'g': len(disease_gene_counts.get(d, set())),
        }
        op = syn_block.get('omim_preferred')
        if op:
            entry['op'] = op
        diseases_index.append(entry)

    # -- stats --
    class_set = set(filter(None, [d['c'] for d in diseases_index]))
    stats = {
        'total_genes':           len(genes_index),
        'total_diseases':        len(diseases_index),
        'total_classes':         len(class_set),
        'version':               metadata.get('version', ''),
        'generated_at':          metadata.get('generated_at', metadata.get('last_updated', '')),
        'principle':             (metadata.get('classification_rule') or {}).get('principle', ''),
        'class_counts':          metadata.get('disease_class_counts', {}),
        'per_class_gene_counts': metadata.get('per_class_gene_counts', {}),
    }

    index = {
        'stats': stats,
        'genes': genes_index,
        'diseases': diseases_index,
    }

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(index, f, separators=(',', ':'), ensure_ascii=False)

    size = os.path.getsize(out_path)
    print(f'wrote {out_path}')
    print(f'  genes:    {len(genes_index)}')
    print(f'  diseases: {len(diseases_index)}')
    print(f'  size:     {size:,} bytes')


def main() -> int:
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    default_src = os.path.join(repo_root, 'public', 'data', 'ciliopathy_genes_v15.json')
    default_out = os.path.join(repo_root, 'public', 'data', 'search_index.json')

    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--src', default=default_src, help=f'master JSON (default: {default_src})')
    p.add_argument('--out', default=default_out, help=f'output index (default: {default_out})')
    args = p.parse_args()

    if not os.path.exists(args.src):
        print(f'error: master file not found: {args.src}', file=sys.stderr)
        return 1

    build(args.src, args.out)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
