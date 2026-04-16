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

// Editorial palette — ink, ochre, oxblood, paper tones.
// Ordered so the eye lands on #1 first.
const INK = '#1C2631'
const ACCENT = '#8B2635'
const OCHRE = '#C48A3A'

const COLORS = [
  INK,
  ACCENT,
  OCHRE,
  '#47515F',
  '#6B7687',
  '#A54050',
  '#E3B35E',
  '#98A1AF',
  '#C3C9D3',
  '#E4E7EC',
]

const AXIS_TICK = { fontSize: 11, fill: '#6B7687', fontFamily: 'var(--font-mono)' } as const
const GENE_TICK = { fontSize: 12, fill: '#1C2631', fontWeight: 500, fontFamily: 'var(--font-mono)' } as const
const GRID = '#E4E7EC'

interface BarPlotProps {
  data: BarPlotData[]
  dataKey?: string
  nameKey?: string
  height?: number
  title?: string
  colors?: string[]
}

export function BarPlot({ data, dataKey = "value", nameKey = "name", height = 300, title, colors }: BarPlotProps) {
  const truncateLabel = (label: string, maxLength: number = 20) => {
    if (!label) return ''
    return label.length > maxLength ? label.substring(0, maxLength) + '…' : label
  }

  const processedData = data.map(item => ({
    ...item,
    displayName: truncateLabel(item[nameKey as keyof typeof item] as string)
  }))

  return (
    <div className="w-full">
      {title && <h3 className="eyebrow mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={processedData} margin={{ top: 20, right: 20, left: 0, bottom: 100 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="displayName"
            angle={-45}
            textAnchor="end"
            height={100}
            interval={0}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: GRID }}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(139, 38, 53, 0.06)' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const originalData = data.find(
                  d => truncateLabel(d[nameKey as keyof typeof d] as string) === payload[0].payload.displayName
                )
                return (
                  <div className="bg-surface px-3 py-2 border border-primary-200 rounded-sm shadow-sm">
                    <p className="text-sm font-medium text-primary-800">
                      {originalData?.[nameKey as keyof typeof originalData] as string}
                    </p>
                    <p className="text-xs text-primary-500 font-mono mt-0.5">
                      Count <span className="text-accent font-semibold">{payload[0].value}</span>
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar
            dataKey={dataKey}
            radius={[2, 2, 0, 0]}
            label={{
              position: 'top',
              fill: '#1C2631',
              fontSize: 10,
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {processedData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colors && colors.length > 0 ? colors[index % colors.length] : INK}
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
    const radius = outerRadius + 18
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="#1C2631"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize="10"
        fontWeight="500"
        fontFamily="var(--font-mono)"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface px-3 py-2 border border-primary-200 rounded-sm shadow-sm max-w-xs">
          <p className="text-sm font-medium text-primary-800">{payload[0].name}</p>
          <p className="text-xs text-primary-500 font-mono mt-0.5">
            {payload[0].value.toLocaleString()} genes · {(payload[0].percent * 100).toFixed(1)}%
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
      {title && <h3 className="eyebrow mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={processedData}
            cx="50%"
            cy="45%"
            labelLine={{ stroke: '#C3C9D3', strokeWidth: 0.5 }}
            label={renderCustomLabel}
            outerRadius={Math.min(height * 0.3, 110)}
            innerRadius={Math.min(height * 0.18, 55)}
            dataKey={dataKey}
            nameKey={nameKey}
            paddingAngle={1}
            stroke="#FAF6EC"
            strokeWidth={2}
          >
            {processedData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            iconType="square"
            iconSize={8}
            formatter={(value: string) => (
              <span className="text-primary-600 text-xs">{truncateLabel(value)}</span>
            )}
            wrapperStyle={{ fontSize: '11px', paddingTop: '12px', lineHeight: '20px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

interface PublicationBarChartProps {
  data: Array<{ gene: string; count: number }>
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
  const maxCount = chartData[0]?.count || 0

  return (
    <div className="w-full">
      {title && <h3 className="eyebrow mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 60, left: 12, bottom: 5 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <YAxis
            type="category"
            dataKey="gene"
            tick={GENE_TICK}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            cursor={{ fill: 'rgba(139, 38, 53, 0.06)' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-surface px-3 py-2 border border-primary-200 rounded-sm shadow-sm">
                    <p className="text-sm font-mono font-semibold text-primary-800">{payload[0].payload.gene}</p>
                    <p className="text-xs text-primary-500 font-mono mt-0.5">
                      {(payload[0].value as number).toLocaleString()} publications
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar
            dataKey="count"
            radius={[0, 2, 2, 0]}
            label={{
              position: 'right',
              fill: '#47515F',
              fontSize: 10,
              fontWeight: 500,
              fontFamily: 'var(--font-mono)',
              formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v),
            }}
          >
            {chartData.map((d, index) => {
              // Ink gradient based on magnitude — #1 is accent (oxblood),
              // others are ink scaled by relative weight.
              const fill = index === 0 ? ACCENT : INK
              const opacity = index === 0 ? 1 : 0.4 + (d.count / maxCount) * 0.5
              return <Cell key={`cell-${index}`} fill={fill} fillOpacity={opacity} />
            })}
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
      {title && <h2 className="font-display text-title text-primary-800 text-center">{title}</h2>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{children}</div>
    </div>
  )
}

// StatCard — large serif numerals, editorial eyebrow label.
// The "color" prop is preserved for API compatibility but is ignored
// in favor of the unified ink+accent system.
const ACCENT_BY_COLOR = {
  blue: '#1C2631',
  green: '#1C2631',
  purple: '#1C2631',
  orange: '#8B2635',
  red: '#8B2635',
} as const

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  color?: keyof typeof ACCENT_BY_COLOR
  href?: string
}

export function StatCard({ title, value, description, icon: Icon, color = 'blue', href }: StatCardProps) {
  const valueColor = ACCENT_BY_COLOR[color] || '#1C2631'

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <p className="eyebrow">{title}</p>
        {Icon && <Icon className="h-4 w-4 text-primary-300" />}
      </div>
      <div className="flex-1 flex flex-col justify-end">
        <p
          className="font-display text-[2.5rem] leading-[1] tracking-tight tabular-nums"
          style={{ color: valueColor }}
        >
          {value}
        </p>
        {description && (
          <p className="text-xs text-primary-400 mt-1.5 font-mono">{description}</p>
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <a
        href={href}
        className="card card-hover group cursor-pointer block min-h-[140px]"
      >
        {content}
      </a>
    )
  }

  return <div className="card min-h-[140px]">{content}</div>
}
