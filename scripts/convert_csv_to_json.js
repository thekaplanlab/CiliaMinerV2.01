#!/usr/bin/env node
/**
 * CSV to JSON Converter for CiliaMiner Next.js Application
 * Converts all CSV data files to optimized JSON format using papaparse
 */

const fs = require('fs');
const path = require('path');

// Create scripts directory if it doesn't exist
const scriptsDir = path.join(__dirname);
const dataDir = path.join(__dirname, '..', 'src', 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function cleanData(data) {
    /** Clean and prepare data for JSON conversion */
    return data.map(row => {
        const cleanedRow = {};
        for (const [key, value] of Object.entries(row)) {
            // Replace empty strings with null
            if (value === '' || value === undefined) {
                cleanedRow[key] = null;
            } else {
                // Try to convert to number if possible
                const numValue = Number(value);
                if (!isNaN(numValue) && value !== '') {
                    cleanedRow[key] = numValue;
                } else {
                    cleanedRow[key] = value;
                }
            }
        }
        return cleanedRow;
    });
}

function convertCsvToJson(csvPath, outputDir) {
    /** Convert a single CSV file to JSON */
    try {
        // Read CSV file
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        
        // Simple CSV parsing (since papaparse is client-side only)
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length === 0) return false;
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || null;
            });
            data.push(row);
        }
        
        // Clean data
        const cleanedData = cleanData(data);
        
        // Create output filename
        const csvName = path.basename(csvPath, '.csv');
        const jsonPath = path.join(outputDir, `${csvName}.json`);
        
        // Write JSON file
        fs.writeFileSync(jsonPath, JSON.stringify(cleanedData, null, 2), 'utf-8');
        
        console.log(`✅ Converted ${csvPath} -> ${jsonPath} (${cleanedData.length} records)`);
        return true;
        
    } catch (error) {
        console.log(`❌ Error converting ${csvPath}: ${error.message}`);
        return false;
    }
}

function createDataIndex(outputDir) {
    /** Create a data index file with metadata about all datasets */
    const index = {
        datasets: {},
        total_files: 0,
        last_updated: new Date().toISOString()
    };
    
    const jsonFiles = fs.readdirSync(outputDir).filter(file => file.endsWith('.json'));
    
    for (const jsonFile of jsonFiles) {
        try {
            const jsonPath = path.join(outputDir, jsonFile);
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            
            const datasetName = path.basename(jsonFile, '.json');
            index.datasets[datasetName] = {
                filename: jsonFile,
                record_count: data.length,
                columns: data.length > 0 ? Object.keys(data[0]) : [],
                size_kb: Math.round(fs.statSync(jsonPath).size / 1024 * 100) / 100
            };
            index.total_files += 1;
            
        } catch (error) {
            console.log(`❌ Error indexing ${jsonFile}: ${error.message}`);
        }
    }
    
    // Write index file
    const indexPath = path.join(outputDir, 'data_index.json');
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    
    console.log(`✅ Created data index: ${indexPath}`);
    return index;
}

function main() {
    // Define paths
    const csvSourceDir = path.join(__dirname, '..', '..', 'CiliaMiner', 'data');
    
    console.log('🚀 Starting CSV to JSON conversion for CiliaMiner...');
    console.log(`📁 Source: ${path.resolve(csvSourceDir)}`);
    console.log(`📁 Output: ${path.resolve(dataDir)}`);
    console.log('-'.repeat(50));
    
    // List of CSV files to convert (in priority order)
    const csvFiles = [
        'homosapiens_ciliopathy.csv',           // Main gene database
        'purelist.csv',                         // Primary ciliopathies
        'secondarylist.csv',                    // Secondary ciliopathies
        'atypical_ciliopathy.csv',              // Atypical ciliopathies
        'potential_ciliopathy_genes.csv',       // Potential candidates
        'ortholog_human_mmusculus.csv',         // Mouse orthologs
        'ortholog_human_drerio.csv',            // Zebrafish orthologs
        'ortholog_human_xlaevis.csv',           // Frog orthologs
        'ortholog_human_drosophila.csv',        // Fruit fly orthologs
        'ortholog_human_celegans.csv',          // Worm orthologs
        'ortholog_human_creinhardtii.csv',      // Algae orthologs
        'symptome_primary.csv',                 // Primary clinical features
        'symptome_secondary.csv',               // Secondary clinical features
        'publication_table.csv',                // Publication data
        'bar_plot.csv',                         // Localization data
        'gene_numbers_d.csv',                   // Disease classification
        'searching_gene.csv',                   // Searchable genes
        'gene_localisations_ciliacarta.csv'     // Gene localizations
    ];
    
    // Convert each CSV file
    let successfulConversions = 0;
    const totalFiles = csvFiles.length;
    
    for (const csvFile of csvFiles) {
        const csvPath = path.join(csvSourceDir, csvFile);
        if (fs.existsSync(csvPath)) {
            if (convertCsvToJson(csvPath, dataDir)) {
                successfulConversions += 1;
            }
        } else {
            console.log(`⚠️  File not found: ${csvPath}`);
        }
    }
    
    console.log('-'.repeat(50));
    console.log(`📊 Conversion Summary: ${successfulConversions}/${totalFiles} files converted successfully`);
    
    // Create data index
    if (successfulConversions > 0) {
        console.log('\n🔍 Creating data index...');
        const index = createDataIndex(dataDir);
        
        console.log('\n🎉 Conversion completed successfully!');
        console.log(`📁 JSON files saved to: ${path.resolve(dataDir)}`);
        console.log(`📋 Data index: ${path.join(dataDir, 'data_index.json')}`);
    } else {
        console.log('\n❌ No files were converted successfully. Please check the source directory.');
    }
}

// Run the conversion
main();
