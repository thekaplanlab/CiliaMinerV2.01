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
} from 'recharts'
import { BarPlotData, GeneNumber } from '@/types'

// Aligned with tailwind config: primary #FF4500, secondary #74b3ce, accent #bd552e
const COLORS = [
  '#FF4500', '#74b3ce', '#bd552e', '#4ECDC4', '#96CEB4',
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

export function CiliaMinerPieChart({ data, dataKey = "Gene_numbers", nameKey = "Disease", height = 350, title }: PieChartProps) {
  const TOP_N = 8
  const THRESHOLD_PCT = 0.03

  const processedData = React.useMemo(() => {
    const total = data.reduce((sum, d) => sum + (d[dataKey as keyof GeneNumber] as number), 0)
    if (total === 0) return data

    const sorted = [...data].sort(
      (a, b) => (b[dataKey as keyof GeneNumber] as number) - (a[dataKey as keyof GeneNumber] as number)
    )

    const major: GeneNumber[] = []
    let otherSum = 0

    sorted.forEach((item, i) => {
      const val = item[dataKey as keyof GeneNumber] as number
      if (i < TOP_N && val / total >= THRESHOLD_PCT) {
        major.push(item)
      } else {
        otherSum += val
      }
    })

    if (otherSum > 0) {
      major.push({ Disease: 'Other', Gene_numbers: otherSum } as GeneNumber)
    }
    return major
  }, [data, dataKey])

  const renderCustomLabel = ({ cx, cy, midAngle, outerRadius, percent }: any) => {
    if (percent < 0.04) return null
    const RADIAN = Math.PI / 180
    const radius = outerRadius + 20
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text x={x} y={y} fill="#374151" textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central" fontSize="12" fontWeight="600">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg max-w-xs">
          <p className="text-sm font-semibold text-gray-900">{payload[0].name}</p>
          <p className="text-sm text-gray-600">
            Count: <span className="font-medium text-primary">{payload[0].value.toLocaleString()}</span>
          </p>
          <p className="text-sm text-gray-600">
            Percentage: <span className="font-medium">{(payload[0].percent * 100).toFixed(1)}%</span>
          </p>
        </div>
      )
    }
    return null
  }

  const truncateLabel = (label: string, maxLength: number = 30) => {
    if (!label) return ''
    return label.length > maxLength ? label.substring(0, maxLength) + '…' : label
  }

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={processedData}
            cx="50%"
            cy="45%"
            labelLine={true}
            label={renderCustomLabel}
            outerRadius={Math.min(height * 0.3, 110)}
            innerRadius={Math.min(height * 0.12, 40)}
            fill="#8884d8"
            dataKey={dataKey}
            nameKey={nameKey}
            paddingAngle={2}
          >
            {processedData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={10}
            formatter={(value: string) => (
              <span className="text-gray-700">{truncateLabel(value)}</span>
            )}
            wrapperStyle={{ fontSize: '12px', paddingTop: '12px', lineHeight: '22px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

interface PublicationBarChartProps {
  data: Array<{
    gene: string
    count: number
  }>
  title?: string
  maxItems?: number
}

export function PublicationBarChart({ data, title, maxItems = 15 }: PublicationBarChartProps) {
  const chartData = React.useMemo(() => {
    const aggregated = new Map<string, number>()
    data.forEach(d => {
      aggregated.set(d.gene, (aggregated.get(d.gene) || 0) + d.count)
    })
    return Array.from(aggregated.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxItems)
      .map(([gene, count]) => ({ gene, count }))
  }, [data, maxItems])

  const chartHeight = Math.max(350, chartData.length * 32)

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 60, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#666' }}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          />
          <YAxis
            type="category"
            dataKey="gene"
            tick={{ fontSize: 12, fill: '#374151', fontWeight: 500 }}
            width={75}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255, 69, 0, 0.08)' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                    <p className="text-sm font-semibold text-gray-900">{payload[0].payload.gene}</p>
                    <p className="text-sm text-gray-600">
                      Publications: <span className="font-medium text-primary">{(payload[0].value as number).toLocaleString()}</span>
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            label={{
              position: 'right',
              fill: '#374151',
              fontSize: 11,
              fontWeight: 600,
              formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v,
            }}
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={index === 0 ? '#FF4500' : index < 3 ? '#FF6B3D' : '#FF8A65'} />
            ))}
          </Bar>
        </BarChart>
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
