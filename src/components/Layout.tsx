'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Search, Database, Activity, FileText, Upload } from 'lucide-react'

const navigation = [
  { name: 'Homepage', href: '/', icon: Search },
  { name: 'Gene Search', href: '/gene-search', icon: Search },
  { name: 'Advanced Search', href: '/advanced-search', icon: Search },
  { name: 'Data Explorer', href: '/data-explorer', icon: Database },
  { name: 'Ciliopathy Classification', href: '/ciliopathy-classification', icon: Database },
  { name: 'Genes & Orthologs', href: '/genes-orthologs', icon: Activity },
  { name: 'Organism Orthologs', href: '/organism-orthologs', icon: Activity },
  { name: 'Symptoms & Diseases', href: '/symptoms-diseases', icon: FileText },
  { name: 'Submit Gene', href: '/submit-gene', icon: Upload },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [pathname, setPathname] = useState('/')

  useEffect(() => {
    setPathname(window.location.pathname)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-primary">
                CiliaMiner
              </h1>
              <p className="ml-4 text-sm text-gray-600">
                Ciliopathy Genes and Ciliopathies
              </p>
            </div>
            <div className="text-sm text-gray-500">
              Last Update: 27.02.2025
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-primary shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center px-3 py-4 text-sm font-medium transition-colors duration-200',
                    isActive
                      ? 'text-white border-b-2 border-white'
                      : 'text-orange-100 hover:text-white hover:bg-orange-700'
                  )}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">CiliaMiner</h3>
              <p className="text-gray-300 text-sm">
                An integrated database for ciliopathy genes and ciliopathies.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Citation</h3>
              <p className="text-gray-300 text-sm">
                Turan, M. G., et al. (2023). CiliaMiner: an integrated database for ciliopathy genes and ciliopathies. Database, 2023, baad047.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Contact</h3>
              <p className="text-gray-300 text-sm">
                For questions and suggestions, please contact the Kaplan Lab.
              </p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-700 text-center text-gray-400 text-sm">
            <p>&copy; 2025 CiliaMiner. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
