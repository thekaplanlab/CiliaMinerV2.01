#!/usr/bin/env python3
"""
CSV to JSON Converter for CiliaMiner Next.js Application
Converts all CSV data files to optimized JSON format
"""

import pandas as pd
import json
import os
import sys
from pathlib import Path
import numpy as np

def clean_dataframe(df):
    """Clean and prepare dataframe for JSON conversion"""
    # Replace NaN values with appropriate defaults
    df = df.replace({np.nan: None})
    
    # Convert numeric columns to appropriate types
    for col in df.columns:
        if df[col].dtype == 'object':
            # Try to convert to numeric if possible
            try:
                df[col] = pd.to_numeric(df[col], errors='ignore')
            except:
                pass
    
    return df

def convert_csv_to_json(csv_path, output_dir):
    """Convert a single CSV file to JSON"""
    try:
        # Read CSV file
        df = pd.read_csv(csv_path, encoding='utf-8')
        
        # Clean data
        df = clean_dataframe(df)
        
        # Convert to JSON
        json_data = df.to_dict('records')
        
        # Create output filename
        csv_name = Path(csv_path).stem
        json_path = Path(output_dir) / f"{csv_name}.json"
        
        # Write JSON file
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"✅ Converted {csv_path} -> {json_path} ({len(json_data)} records)")
        return True
        
    except Exception as e:
        print(f"❌ Error converting {csv_path}: {str(e)}")
        return False

def create_data_index(data_dir, output_dir):
    """Create a data index file with metadata about all datasets"""
    index = {
        "datasets": {},
        "total_files": 0,
        "last_updated": pd.Timestamp.now().isoformat()
    }
    
    json_files = list(Path(output_dir).glob("*.json"))
    
    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            dataset_name = json_file.stem
            index["datasets"][dataset_name] = {
                "filename": json_file.name,
                "record_count": len(data),
                "columns": list(data[0].keys()) if data else [],
                "size_kb": round(json_file.stat().st_size / 1024, 2)
            }
            index["total_files"] += 1
            
        except Exception as e:
            print(f"❌ Error indexing {json_file}: {str(e)}")
    
    # Write index file
    index_path = Path(output_dir) / "data_index.json"
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Created data index: {index_path}")
    return index

def main():
    # Define paths
    csv_source_dir = Path("../CiliaMiner/data")
    json_output_dir = Path("../src/data")
    
    # Create output directory if it doesn't exist
    json_output_dir.mkdir(parents=True, exist_ok=True)
    
    print("🚀 Starting CSV to JSON conversion for CiliaMiner...")
    print(f"📁 Source: {csv_source_dir.absolute()}")
    print(f"📁 Output: {json_output_dir.absolute()}")
    print("-" * 50)
    
    # List of CSV files to convert (in priority order)
    csv_files = [
        "homosapiens_ciliopathy.csv",           # Main gene database
        "purelist.csv",                         # Primary ciliopathies
        "secondarylist.csv",                    # Secondary ciliopathies
        "atypical_ciliopathy.csv",              # Atypical ciliopathies
        "potential_ciliopathy_genes.csv",       # Potential candidates
        "ortholog_human_mmusculus.csv",         # Mouse orthologs
        "ortholog_human_drerio.csv",            # Zebrafish orthologs
        "ortholog_human_xlaevis.csv",           # Frog orthologs
        "ortholog_human_drosophila.csv",        # Fruit fly orthologs
        "ortholog_human_celegans.csv",          # Worm orthologs
        "ortholog_human_creinhardtii.csv",      # Algae orthologs
        "symptome_primary.csv",                 # Primary clinical features
        "symptome_secondary.csv",               # Secondary clinical features
        "publication_table.csv",                # Publication data
        "bar_plot.csv",                         # Localization data
        "gene_numbers_d.csv",                   # Disease classification
        "searching_gene.csv",                   # Searchable genes
        "gene_localisations_ciliacarta.csv"     # Gene localizations
    ]
    
    # Convert each CSV file
    successful_conversions = 0
    total_files = len(csv_files)
    
    for csv_file in csv_files:
        csv_path = csv_source_dir / csv_file
        if csv_path.exists():
            if convert_csv_to_json(csv_path, json_output_dir):
                successful_conversions += 1
        else:
            print(f"⚠️  File not found: {csv_path}")
    
    print("-" * 50)
    print(f"📊 Conversion Summary: {successful_conversions}/{total_files} files converted successfully")
    
    # Create data index
    if successful_conversions > 0:
        print("\n🔍 Creating data index...")
        index = create_data_index(csv_source_dir, json_output_dir)
        
        print("\n🎉 Conversion completed successfully!")
        print(f"📁 JSON files saved to: {json_output_dir.absolute()}")
        print(f"📋 Data index: {json_output_dir / 'data_index.json'}")
    else:
        print("\n❌ No files were converted successfully. Please check the source directory.")

if __name__ == "__main__":
    main()
