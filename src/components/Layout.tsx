'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Home, Search, SlidersHorizontal, Database, Activity, FileText, Upload, Menu, X, Info, Brain } from 'lucide-react'

const navigation = [
  { name: 'Homepage', href: '/', icon: Home },
  { name: 'Gene Search', href: '/gene-search', icon: Search },
  { name: 'Advanced Search', href: '/advanced-search', icon: SlidersHorizontal },
  { name: 'Ciliopathy Classification', href: '/ciliopathy-classification', icon: Database },
  { name: 'Genes & Orthologs', href: '/genes-orthologs', icon: Activity },
  { name: 'Symptoms & Diseases', href: '/symptoms-diseases', icon: FileText },
  { name: 'Analysis', href: '/analysis', icon: Brain },
  { name: 'Submit Gene', href: '/submit-gene', icon: Upload },
  { name: 'About', href: '/about', icon: Info },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const currentPath = pathname === '/' || !pathname ? '/' : pathname

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const NavLinks = ({ className = '', onLinkClick }: { className?: string; onLinkClick?: () => void }) => (
    <>
      {navigation.map((item) => {
        const isActive = currentPath === item.href
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onLinkClick}
            className={cn(
              'flex items-center px-3 py-3 text-sm font-medium transition-colors duration-200 rounded-lg',
              isActive
                ? 'text-white bg-orange-700'
                : 'text-orange-100 hover:text-white hover:bg-orange-700',
              className
            )}
          >
            <item.icon className="mr-2 h-4 w-4 flex-shrink-0" aria-hidden />
            {item.name}
          </Link>
        )
      })}
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Skip to main content - visible on focus */}
      <a
        href="#main-content"
        className="sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:w-auto focus:h-auto focus:m-0 focus:overflow-visible focus:[clip:auto] focus:bg-white focus:text-primary focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        Skip to main content
      </a>

      {/* Navigation */}
      <nav className="bg-primary shadow-lg" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Brand - always visible */}
            <Link href="/" className="flex items-center px-3 py-4 text-xl font-bold text-white">
              CiliaMiner
            </Link>

            {/* Desktop nav - hidden below lg */}
            <div className="hidden lg:flex lg:items-center lg:space-x-1">
              <NavLinks className="py-4" />
            </div>

            {/* Mobile menu button - visible below lg */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden flex items-center justify-center p-3 text-white hover:bg-orange-700 rounded-lg transition-colors"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile menu - slide-out panel */}
          <div
            id="mobile-menu"
            className={cn(
              'lg:hidden overflow-hidden transition-all duration-200 ease-in-out',
              mobileMenuOpen ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'
            )}
          >
            <div className="py-4 space-y-1">
              <NavLinks onLinkClick={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <Link href="/about" className="text-primary hover:text-orange-400 text-sm mt-2 inline-block">
                Learn more about us
              </Link>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Citation</h3>
              <p className="text-gray-300 text-sm">
                Turan, M. G., et al. (2023). CiliaMiner: an integrated database for ciliopathy genes and ciliopathies. Database, 2023, baad047.
              </p>
              <a
                href="https://doi.org/10.1093/database/baad047"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-orange-400 text-sm mt-2 inline-block"
              >
                View on DOI
              </a>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Contact</h3>
              <p className="text-gray-300 text-sm">
                For questions and suggestions, please contact the Kaplan Lab.
              </p>
              <a
                href="mailto:info@ciliaminer.org"
                className="text-primary hover:text-orange-400 text-sm mt-2 inline-block"
              >
                info@ciliaminer.org
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-700 text-center text-gray-400 text-sm">
            <p>&copy; {new Date().getFullYear()} CiliaMiner. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
