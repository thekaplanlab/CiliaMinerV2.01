'use client'

import React from 'react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts'
import { BarPlotData, GeneNumber, PublicationData } from '@/types'

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
]

interface BarPlotProps {
  data: BarPlotData[]
  dataKey?: string
  nameKey?: string
  height?: number
  title?: string
  colors?: string[]
}

export function BarPlot({ data, dataKey = "value", nameKey = "name", height = 300, title, colors }: BarPlotProps) {
  // Truncate long labels for better display
  const truncateLabel = (label: string, maxLength: number = 20) => {
    if (!label) return ''
    return label.length > maxLength ? label.substring(0, maxLength) + '...' : label
  }

  // Prepare data with truncated labels
  const processedData = data.map(item => ({
    ...item,
    displayName: truncateLabel(item[nameKey as keyof typeof item] as string)
  }))

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart 
          data={processedData} 
          margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="displayName"
            angle={-45}
            textAnchor="end"
            height={100}
            interval={0}
            tick={{ fontSize: 11, fill: '#666' }}
          />
          <YAxis tick={{ fontSize: 11, fill: '#666' }} />
          <Tooltip 
            cursor={{ fill: 'rgba(255, 69, 0, 0.1)' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const originalData = data.find(d => truncateLabel(d[nameKey as keyof typeof d] as string) === payload[0].payload.displayName)
                return (
                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                    <p className="text-sm font-semibold text-gray-900">
                      {originalData?.[nameKey as keyof typeof originalData] as string}
                    </p>
                    <p className="text-sm text-gray-600">
                      Count: <span className="font-medium text-primary">{payload[0].value}</span>
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar 
            dataKey={dataKey} 
            radius={[4, 4, 0, 0]}
            label={{ 
              position: 'top', 
              fill: '#374151',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            {processedData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={colors && colors.length > 0 ? colors[index % colors.length] : '#FF4500'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface PieChartProps {
  data: GeneNumber[]
  dataKey?: string
  nameKey?: string
  height?: number
  title?: string
}

export function CiliaMinerPieChart({ data, dataKey = "Gene_numbers", nameKey = "Disease", height = 300, title }: PieChartProps) {
  // Custom label renderer for better visibility
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
    // Only show label if percentage is above 5% to avoid clutter
    if (percent < 0.05) return null
    
    const RADIAN = Math.PI / 180
    const radius = outerRadius + 25
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="#374151"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize="11"
        fontWeight="500"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-semibold text-gray-900">
            {payload[0].name}
          </p>
          <p className="text-sm text-gray-600">
            Count: <span className="font-medium text-primary">{payload[0].value}</span>
          </p>
          <p className="text-sm text-gray-600">
            Percentage: <span className="font-medium">{(payload[0].percent * 100).toFixed(1)}%</span>
          </p>
        </div>
      )
    }
    return null
  }

  // Truncate legend labels
  const truncateLabel = (label: string, maxLength: number = 25) => {
    if (!label) return ''
    return label.length > maxLength ? label.substring(0, maxLength) + '...' : label
  }

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            labelLine={true}
            label={renderCustomLabel}
            outerRadius={Math.min(height * 0.25, 80)}
            fill="#8884d8"
            dataKey={dataKey}
            nameKey={nameKey}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={60}
            formatter={(value: string) => truncateLabel(value)}
            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

interface BubbleChartProps {
  data: Array<{
    year: number
    count: number
    gene: string
  }>
  title?: string
}

export function BubbleChart({ data, title }: BubbleChartProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <CartesianGrid />
          <XAxis 
            type="number" 
            dataKey="year" 
            name="Year"
            domain={['dataMin', 'dataMax']}
          />
          <YAxis 
            type="number" 
            dataKey="count" 
            name="Publication Count"
          />
          <ZAxis dataKey="count" range={[50, 400]} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Legend />
          <Scatter 
            name="Publications" 
            data={data} 
            fill="#FF4500"
            shape="circle"
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

interface ChartGridProps {
  children: React.ReactNode
  title?: string
}

export function ChartGrid({ children, title }: ChartGridProps) {
  return (
    <div className="space-y-6">
      {title && (
        <h2 className="text-2xl font-bold text-gray-900 text-center">
          {title}
        </h2>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {children}
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
}

export function StatCard({ title, value, description, icon: Icon, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    red: 'bg-red-100 text-red-600'
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center">
        {Icon && (
          <div className="flex-shrink-0">
            <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
        )}
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>
      </div>
    </div>
  )
}
