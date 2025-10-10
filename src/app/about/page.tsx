'use client'

import React from 'react'
import Layout from '@/components/Layout'
import { 
  Users, 
  Database, 
  FileText, 
  Award, 
  Globe, 
  Code,
  ExternalLink,
  Mail,
  Github,
  Linkedin
} from 'lucide-react'

export default function AboutPage() {
  // Note: Update these with actual team information
  const teamMembers: Array<{
    name: string;
    role: string;
    institution: string;
    email: string;
    research: string;
  }> = []

  // Note: Add key publications when available
  const publications: Array<{
    title: string;
    authors: string;
    journal: string;
    year: number;
    doi: string;
    pmid: string;
  }> = []

  const databaseStats = [
    { label: 'Total Genes', value: '500+', icon: Database },
    { label: 'Ciliopathies', value: '50+', icon: FileText },
    { label: 'Organisms', value: '6', icon: Globe },
    { label: 'Publications', value: '1000+', icon: Award }
  ]

  const acknowledgments = [
    'National Institutes of Health (NIH) for funding support',
    'Ciliopathy research community for data contributions',
    'Open source software community for development tools',
    'Patients and families affected by ciliopathies'
  ]

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-primary to-primary-dark text-white">
          <div className="container mx-auto px-6 py-16">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                About CiliaMiner
              </h1>
              <p className="text-xl md:text-2xl text-primary-light mb-8">
                A comprehensive database and research platform for ciliopathy genetics, 
                clinical features, and cross-species orthologs
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {databaseStats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <stat.icon className="h-8 w-8 mx-auto mb-2 text-primary-light" />
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-sm text-primary-light">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 py-12">
          {/* Mission Statement */}
          <section className="mb-16">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Our Mission
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed">
                CiliaMiner aims to accelerate ciliopathy research by providing researchers, 
                clinicians, and students with comprehensive, curated data on ciliopathy genes, 
                clinical features, and cross-species orthologs. Our platform integrates data 
                from multiple sources to create a unified resource for understanding these 
                complex genetic disorders.
              </p>
            </div>
          </section>

          {/* Team Section */}
          {teamMembers.length > 0 && (
            <section className="mb-16">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                  Research Team
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {teamMembers.map((member, index) => (
                    <div key={index} className="bg-white rounded-lg shadow-lg p-6">
                      <div className="text-center mb-4">
                        <div className="w-20 h-20 bg-primary rounded-full mx-auto mb-4 flex items-center justify-center">
                          <Users className="h-10 w-10 text-white" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-1">
                          {member.name}
                        </h3>
                        <p className="text-primary font-medium mb-2">{member.role}</p>
                        <p className="text-gray-600 text-sm mb-3">{member.institution}</p>
                      </div>
                      <div className="space-y-3">
                        <p className="text-gray-700 text-sm">
                          <strong>Research Focus:</strong> {member.research}
                        </p>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-500" />
                          <a 
                            href={`mailto:${member.email}`}
                            className="text-primary hover:text-primary-dark text-sm"
                          >
                            {member.email}
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Database Features */}
          <section className="mb-16">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                Database Features
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                    <Database className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Comprehensive Gene Database
                  </h3>
                  <p className="text-gray-700">
                    Curated information on 500+ ciliopathy genes with detailed annotations 
                    including subcellular localization, disease associations, and references.
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                    <Globe className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Cross-Species Orthologs
                  </h3>
                  <p className="text-gray-700">
                    Ortholog data across 7 model organisms including mouse, zebrafish, 
                    fruit fly, and others for comparative genomics research.
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Clinical Features Database
                  </h3>
                  <p className="text-gray-700">
                    Detailed clinical feature classifications and symptom-disease 
                    relationships for clinical research and diagnosis.
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                    <Code className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Advanced Search & Analytics
                  </h3>
                  <p className="text-gray-700">
                    Powerful search capabilities with filters, data export options, 
                    and interactive visualizations for data exploration.
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                    <Award className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Quality Assurance
                  </h3>
                  <p className="text-gray-700">
                    Rigorous data curation and validation processes ensuring 
                    accuracy and reliability of all information.
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                    <Github className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Open Source Platform
                  </h3>
                  <p className="text-gray-700">
                    Built with modern web technologies and open source principles, 
                    ensuring accessibility and community contributions.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Publications */}
          {publications.length > 0 && (
            <section className="mb-16">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                  Key Publications
                </h2>
                <div className="space-y-6">
                  {publications.map((pub, index) => (
                    <div key={index} className="bg-white rounded-lg shadow-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {pub.title}
                      </h3>
                      <p className="text-gray-700 mb-3">
                        {pub.authors} • {pub.journal} • {pub.year}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <a
                          href={`https://doi.org/${pub.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1 bg-primary text-white text-sm rounded-md hover:bg-primary-dark transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                          DOI: {pub.doi}
                        </a>
                        <span className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-md">
                          {pub.pmid}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Acknowledgments */}
          <section className="mb-16">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                Acknowledgments
              </h2>
              <div className="bg-white rounded-lg shadow-lg p-8">
                <ul className="space-y-3">
                  {acknowledgments.map((ack, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-gray-700">{ack}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Contact & Support */}
          <section className="mb-16">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Get in Touch
              </h2>
              <p className="text-lg text-gray-700 mb-8">
                Have questions, suggestions, or want to contribute to CiliaMiner? 
                We'd love to hear from you!
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="mailto:info@ciliaminer.org"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                  <Mail className="h-5 w-5" />
                  Contact Us
                </a>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                For questions or suggestions about CiliaMiner, please reach out to our team.
              </p>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  )
}
