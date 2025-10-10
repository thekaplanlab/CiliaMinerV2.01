'use client'

import React, { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

export interface HeatmapData {
  x: string
  y: string
  value: number
  count?: number
  category?: string
}

interface HeatmapChartProps {
  data: HeatmapData[]
  title?: string
  xAxisLabel?: string
  yAxisLabel?: string
  valueLabel?: string
  className?: string
  colorScale?: 'sequential' | 'diverging' | 'categorical'
  showTooltip?: boolean
  showLegend?: boolean
  maxValue?: number
  minValue?: number
}

export function HeatmapChart({
  data,
  title,
  xAxisLabel,
  yAxisLabel,
  valueLabel = 'Value',
  className,
  colorScale = 'sequential',
  showTooltip = true,
  showLegend = true,
  maxValue,
  minValue
}: HeatmapChartProps) {
  const [hoveredCell, setHoveredCell] = useState<{ x: string; y: string; value: number } | null>(null)

  // Process data for heatmap visualization
  const { xValues, yValues, matrixData, valueRange } = useMemo(() => {
    if (!data || data.length === 0) {
      return { xValues: [], yValues: [], matrixData: [], valueRange: { min: 0, max: 1 } }
    }

    // Get unique x and y values
    const xValues = Array.from(new Set(data.map(d => d.x))).sort()
    const yValues = Array.from(new Set(data.map(d => d.y))).sort()

    // Create matrix data
    const matrixData = xValues.map(x => {
      const row: { x: string; [key: string]: number | string } = { x }
      yValues.forEach(y => {
        const cell = data.find(d => d.x === x && d.y === y)
        row[y] = cell ? cell.value : 0
      })
      return row
    })

    // Get value range for color scaling
    const values = data.map(d => d.value).filter(v => v !== null && v !== undefined)
    const min = minValue ?? Math.min(...values)
    const max = maxValue ?? Math.max(...values)
    
    return { xValues, yValues, matrixData, valueRange: { min, max } }
  }, [data, maxValue, minValue])

  // Color scale functions
  const getColor = (value: number) => {
    const { min, max } = valueRange
    if (max === min) return '#e5e7eb' // Gray for single values
    
    const normalizedValue = (value - min) / (max - min)
    
    switch (colorScale) {
      case 'sequential':
        // Blue to red sequential scale
        const intensity = Math.floor(normalizedValue * 255)
        return `rgb(${intensity}, ${100 + intensity * 0.6}, ${255 - intensity})`
      
      case 'diverging':
        // Red to white to blue diverging scale
        if (normalizedValue < 0.5) {
          const intensity = Math.floor(normalizedValue * 2 * 255)
          return `rgb(255, ${255 - intensity}, ${255 - intensity})`
        } else {
          const intensity = Math.floor((normalizedValue - 0.5) * 2 * 255)
          return `rgb(${255 - intensity}, ${255 - intensity}, 255)`
        }
      
      case 'categorical':
        // Categorical color palette
        const colors = [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
          '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ]
        const colorIndex = Math.floor(normalizedValue * colors.length)
        return colors[colorIndex % colors.length]
      
      default:
        return '#8884d8'
    }
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-64 bg-gray-50 rounded-lg", className)}>
        <p className="text-gray-500">No data available for heatmap</p>
      </div>
    )
  }

  return (
    <div className={cn("w-full", className)}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
          {title}
        </h3>
      )}
      
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Heatmap Grid */}
        <div className="overflow-x-auto max-w-full">
          <div 
            className="inline-block border border-gray-200 rounded-lg overflow-hidden"
            style={{
              display: 'grid',
              gridTemplateColumns: `minmax(150px, auto) repeat(${yValues.length}, minmax(60px, 80px))`,
              gridTemplateRows: `minmax(100px, auto) repeat(${xValues.length}, minmax(40px, 50px))`,
              gap: '1px',
              backgroundColor: '#e5e7eb'
            }}
          >
            {/* Empty corner cell */}
            <div className="bg-gray-100 p-2"></div>
            
            {/* Y-axis labels (top row) */}
            {yValues.map((y) => (
              <div
                key={y}
                className="bg-gray-100 p-2 text-[10px] font-medium text-gray-700 text-center flex items-end justify-center border-b border-gray-200"
                style={{ 
                  writingMode: 'vertical-rl', 
                  textOrientation: 'mixed',
                  transform: 'rotate(180deg)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={y}
              >
                {y.length > 30 ? y.substring(0, 30) + '...' : y}
              </div>
            ))}
            
            {/* X-axis labels and data cells */}
            {xValues.map((x, xIndex) => (
              <React.Fragment key={x}>
                {/* X-axis label */}
                <div 
                  className="bg-gray-100 p-2 text-[10px] font-medium text-gray-700 flex items-center border-r border-gray-200"
                  title={x}
                >
                  <span className="truncate">
                    {x.length > 25 ? x.substring(0, 25) + '...' : x}
                  </span>
                </div>
                
                {/* Data cells for this row */}
                {yValues.map((y, yIndex) => {
                  const rawValue = matrixData[xIndex]?.[y] || 0
                  const value = typeof rawValue === 'number' ? rawValue : 0
                  const isHovered = hoveredCell?.x === x && hoveredCell?.y === y
                  
                  return (
                    <div
                      key={`${x}-${y}`}
                      className={cn(
                        "relative p-1 text-[10px] text-center flex items-center justify-center cursor-pointer transition-all duration-200 font-semibold",
                        isHovered ? "ring-2 ring-blue-500 ring-inset shadow-lg z-10" : "hover:shadow-md hover:z-10"
                      )}
                      style={{
                        backgroundColor: value > 0 ? getColor(value) : '#f9fafb',
                        color: value > 0 ? (value > (valueRange.max + valueRange.min) / 2 ? 'white' : '#1f2937') : '#d1d5db'
                      }}
                      onMouseEnter={() => setHoveredCell({ x, y, value })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {value > 0 ? value : ''}
                      
                      {/* Tooltip */}
                      {showTooltip && isHovered && (
                        <div className="absolute z-50 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg shadow-xl whitespace-nowrap -top-16 left-1/2 transform -translate-x-1/2 max-w-xs">
                          <div className="space-y-1">
                            <div className="font-semibold border-b border-gray-700 pb-1">
                              {x.length > 40 ? x.substring(0, 40) + '...' : x}
                            </div>
                            <div className="text-gray-300">
                              {y.length > 40 ? y.substring(0, 40) + '...' : y}
                            </div>
                            <div className="text-blue-300 font-semibold">
                              {valueLabel}: {value}
                            </div>
                          </div>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        
        {/* Axis Labels */}
        <div className="mt-4 text-center">
          <div className="text-sm text-gray-600 mb-2">
            {xAxisLabel && <span className="mr-4">{xAxisLabel}</span>}
            {yAxisLabel && <span>{yAxisLabel}</span>}
          </div>
        </div>
        
        {/* Legend */}
        {showLegend && (
          <div className="mt-6 flex items-center justify-center">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Value Range:</span>
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded border border-gray-300"
                  style={{ backgroundColor: getColor(valueRange.min) }}
                />
                <span className="text-sm text-gray-700">{valueRange.min}</span>
                <div className="w-16 h-4 rounded border border-gray-300 overflow-hidden">
                  <div 
                    className="w-full h-full"
                    style={{
                      background: `linear-gradient(to right, ${getColor(valueRange.min)}, ${getColor(valueRange.max)})`
                    }}
                  />
                </div>
                <span className="text-sm text-gray-700">{valueRange.max}</span>
                <div 
                  className="w-4 h-4 rounded border border-gray-300"
                  style={{ backgroundColor: getColor(valueRange.max) }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Specialized heatmap for disease vs. clinical features
export function DiseaseFeatureHeatmap({ 
  data, 
  className 
}: { 
  data: HeatmapData[]
  className?: string 
}) {
  const [selectedDiseases, setSelectedDiseases] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  
  // Get unique diseases and features
  const allDiseases = useMemo(() => 
    Array.from(new Set(data.map(d => d.x))).sort().slice(0, 15), // Limit to top 15
    [data]
  )
  
  const allFeatures = useMemo(() => 
    Array.from(new Set(data.map(d => d.y))).sort().slice(0, 20), // Limit to top 20
    [data]
  )
  
  // Filter data based on selected diseases
  const filteredData = useMemo(() => {
    if (selectedDiseases.length === 0) {
      return data.filter(d => 
        allDiseases.includes(d.x) && allFeatures.includes(d.y)
      )
    }
    return data.filter(d => 
      selectedDiseases.includes(d.x) && allFeatures.includes(d.y)
    )
  }, [data, selectedDiseases, allDiseases, allFeatures])
  
  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search diseases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedDiseases(allDiseases)}
            className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
          >
            Show All
          </button>
          <button
            onClick={() => setSelectedDiseases([])}
            className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
          >
            Reset
          </button>
        </div>
      </div>
      
      {/* Disease chips */}
      <div className="flex flex-wrap gap-2">
        {allDiseases
          .filter(d => d.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(disease => (
            <button
              key={disease}
              onClick={() => {
                setSelectedDiseases(prev => 
                  prev.includes(disease)
                    ? prev.filter(d => d !== disease)
                    : [...prev, disease]
                )
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedDiseases.length === 0 || selectedDiseases.includes(disease)
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {disease.length > 30 ? disease.substring(0, 30) + '...' : disease}
            </button>
          ))}
      </div>
      
      {/* Heatmap */}
      <HeatmapChart
        data={filteredData}
        title=""
        xAxisLabel="Diseases"
        yAxisLabel="Clinical Features"
        valueLabel="Presence"
        className={className}
        colorScale="sequential"
      />
      
      <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
        <strong>Note:</strong> Showing top 15 diseases and top 20 clinical features. 
        Use the search and filters above to explore specific diseases. 
        Cells with value 1 indicate the presence of that clinical feature in the disease.
      </div>
    </div>
  )
}

// Specialized heatmap for gene localization
export function GeneLocalizationHeatmap({ 
  data, 
  className 
}: { 
  data: HeatmapData[]
  className?: string 
}) {
  // Limit to top 15 genes to prevent overcrowding
  const limitedData = useMemo(() => {
    const uniqueGenes = Array.from(new Set(data.map(d => d.x))).slice(0, 15)
    return data.filter(d => uniqueGenes.includes(d.x))
  }, [data])
  
  return (
    <div className="space-y-4">
      <div className="max-h-[400px] overflow-auto">
        <HeatmapChart
          data={limitedData}
          title=""
          xAxisLabel="Genes"
          yAxisLabel="Localizations"
          valueLabel="Present"
          className={className}
          colorScale="categorical"
        />
      </div>
      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
        Showing top 15 genes. Hover over cells for detailed information.
      </div>
    </div>
  )
}
