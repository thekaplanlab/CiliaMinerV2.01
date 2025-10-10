#!/usr/bin/env python3
"""
Script to combine multiple JSON files from a directory into a single JSON file.
Each JSON file should have the same schema structure.
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Any
import argparse


def load_json_files(directory: str) -> List[Dict[str, Any]]:
    """
    Load all JSON files from the specified directory.
    
    Args:
        directory: Path to the directory containing JSON files
        
    Returns:
        List of dictionaries containing the data from all JSON files
    """
    json_data = []
    directory_path = Path(directory)
    
    if not directory_path.exists():
        print(f"Error: Directory '{directory}' does not exist!")
        return json_data
    
    # Get all .json files in the directory
    json_files = sorted(directory_path.glob("*.json"))
    
    if not json_files:
        print(f"Warning: No JSON files found in '{directory}'")
        return json_data
    
    print(f"Found {len(json_files)} JSON files")
    
    # Load each JSON file
    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                json_data.append(data)
                print(f"✓ Loaded: {json_file.name}")
        except json.JSONDecodeError as e:
            print(f"✗ Error decoding {json_file.name}: {e}")
        except Exception as e:
            print(f"✗ Error loading {json_file.name}: {e}")
    
    return json_data


def combine_as_array(json_data: List[Dict[str, Any]], output_file: str):
    """
    Combine all JSON data into a single array and save to file.
    
    Args:
        json_data: List of dictionaries to combine
        output_file: Path to the output file
    """
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)
        print(f"\n✓ Successfully combined {len(json_data)} files into '{output_file}'")
        print(f"Output format: Array with {len(json_data)} items")
    except Exception as e:
        print(f"✗ Error writing output file: {e}")


def combine_as_object(json_data: List[Dict[str, Any]], output_file: str, key_field: str = "gene_name"):
    """
    Combine all JSON data into a single object with keys based on a specific field.
    
    Args:
        json_data: List of dictionaries to combine
        output_file: Path to the output file
        key_field: Field to use as the key in the combined object
    """
    combined_data = {}
    
    for item in json_data:
        if key_field in item:
            key = item[key_field]
            combined_data[key] = item
        else:
            print(f"Warning: Item missing '{key_field}' field, skipping...")
    
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(combined_data, f, indent=2, ensure_ascii=False)
        print(f"\n✓ Successfully combined {len(json_data)} files into '{output_file}'")
        print(f"Output format: Object with {len(combined_data)} keys (based on '{key_field}' field)")
    except Exception as e:
        print(f"✗ Error writing output file: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Combine multiple JSON files into a single JSON file",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Combine as array
  python combine_json_files.py -d ./gene_panels -o combined.json
  
  # Combine as object with gene_name as key
  python combine_json_files.py -d ./gene_panels -o combined.json -f object -k gene_name
        """
    )
    
    parser.add_argument(
        '-d', '--directory',
        required=True,
        help='Directory containing JSON files to combine'
    )
    
    parser.add_argument(
        '-o', '--output',
        required=True,
        help='Output file path for the combined JSON'
    )
    
    parser.add_argument(
        '-f', '--format',
        choices=['array', 'object'],
        default='array',
        help='Output format: "array" (list of objects) or "object" (dictionary with keys) - default: array'
    )
    
    parser.add_argument(
        '-k', '--key',
        default='gene_name',
        help='Field to use as key when format is "object" - default: gene_name'
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("JSON Files Combiner")
    print("=" * 60)
    print(f"Input directory: {args.directory}")
    print(f"Output file: {args.output}")
    print(f"Output format: {args.format}")
    if args.format == 'object':
        print(f"Key field: {args.key}")
    print("=" * 60)
    print()
    
    # Load all JSON files
    json_data = load_json_files(args.directory)
    
    if not json_data:
        print("No data to combine. Exiting.")
        return
    
    # Combine based on format
    if args.format == 'array':
        combine_as_array(json_data, args.output)
    else:
        combine_as_object(json_data, args.output, args.key)
    
    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


if __name__ == "__main__":
    main()

