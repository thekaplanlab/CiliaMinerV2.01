'use client'

import React, { useState, useRef } from 'react'
import Layout from '@/components/Layout'
import { Send, CheckCircle } from 'lucide-react'

export default function SubmitGenePage() {
  const errorRef = useRef<HTMLDivElement>(null)
  const [formData, setFormData] = useState({
    geneName: '',
    geneId: '',
    organism: '',
    disease: '',
    publication: '',
    evidence: '',
    contactEmail: '',
    additionalInfo: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError('')
    
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL
      
      if (!API_URL) {
        setIsSubmitting(false)
        setSubmitError('Submission service is not configured. Please contact the CiliaMiner team directly at info@ciliaminer.org.')
        return
      }
      
      const response = await fetch(`${API_URL}/api/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gene_name: formData.geneName,
          gene_id: formData.geneId || null,
          organism: formData.organism,
          disease: formData.disease || null,
          publication: formData.publication || null,
          evidence: formData.evidence,
          contact_email: formData.contactEmail || null,
          additional_info: formData.additionalInfo || null,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Submission failed')
      }
      
      const result = await response.json()
      console.log('Submission successful:', result)
      
      setIsSubmitting(false)
      setIsSubmitted(true)
    } catch (error) {
      console.error('Submission error:', error)
      setIsSubmitting(false)
      setSubmitError('Failed to submit. Please try again or contact support at info@ciliaminer.org.')
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const organisms = [
    'Homo sapiens',
    'Mus musculus',
    'Danio rerio',
    'Xenopus laevis',
    'Drosophila melanogaster',
    'Caenorhabditis elegans',
    'Chlamydomonas reinhardtii',
    'Other'
  ]

  const evidenceTypes = [
    'Genetic association studies',
    'Functional studies',
    'Expression analysis',
    'Protein interaction data',
    'Animal model studies',
    'Clinical case reports',
    'Literature review',
    'Other'
  ]

  const handleSubmitAnother = () => {
    setIsSubmitted(false)
    setFormData({
      geneName: '',
      geneId: '',
      organism: '',
      disease: '',
      publication: '',
      evidence: '',
      contactEmail: '',
      additionalInfo: ''
    })
  }

  if (isSubmitted) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-12">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" aria-hidden />
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Thank You!
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Your submission has been received successfully. Our team will review the information and get back to you if needed.
          </p>
          <button
            onClick={handleSubmitAnother}
            className="px-6 py-3 bg-primary hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
          >
            Submit another gene
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Submit Your Gene
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Help us expand the CiliaMiner database by submitting newly published ciliopathy genes, 
            disease associations, or suggestions for improvements.
          </p>
        </div>

        {/* Error banner - sticky at top when present */}
        {submitError && (
          <div
            ref={errorRef}
            className="sticky top-0 z-10 bg-red-50 border border-red-200 rounded-lg p-4"
            role="alert"
          >
            <p className="text-red-700 text-sm">{submitError}</p>
          </div>
        )}

        {/* Submission Form */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Gene Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="geneName" className="block text-sm font-medium text-gray-700 mb-2">
                  Gene Name *
                </label>
                <input
                  type="text"
                  id="geneName"
                  name="geneName"
                  value={formData.geneName}
                  onChange={handleInputChange}
                  required
                  className="input-field"
                  placeholder="e.g., BBS1, CEP290"
                />
              </div>
              
              <div>
                <label htmlFor="geneId" className="block text-sm font-medium text-gray-700 mb-2">
                  Gene ID
                </label>
                <input
                  type="text"
                  id="geneId"
                  name="geneId"
                  value={formData.geneId}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="e.g., ENSG00000174444"
                />
              </div>
            </div>

            {/* Organism and Disease */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="organism" className="block text-sm font-medium text-gray-700 mb-2">
                  Organism *
                </label>
                <select
                  id="organism"
                  name="organism"
                  value={formData.organism}
                  onChange={handleInputChange}
                  required
                  className="input-field"
                >
                  <option value="">Select an organism</option>
                  {organisms.map((org) => (
                    <option key={org} value={org}>{org}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="disease" className="block text-sm font-medium text-gray-700 mb-2">
                  Associated Disease
                </label>
                <input
                  type="text"
                  id="disease"
                  name="disease"
                  value={formData.disease}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="e.g., Bardet-Biedl Syndrome"
                />
              </div>
            </div>

            {/* Publication and Evidence */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="publication" className="block text-sm font-medium text-gray-700 mb-2">
                  Publication Reference
                </label>
                <input
                  type="text"
                  id="publication"
                  name="publication"
                  value={formData.publication}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="e.g., PMID:12345678 or DOI:10.1000/..."
                />
              </div>
              
              <div>
                <label htmlFor="evidence" className="block text-sm font-medium text-gray-700 mb-2">
                  Type of Evidence *
                </label>
                <select
                  id="evidence"
                  name="evidence"
                  value={formData.evidence}
                  onChange={handleInputChange}
                  required
                  className="input-field"
                >
                  <option value="">Select evidence type</option>
                  {evidenceTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Contact Email
              </label>
              <input
                type="email"
                id="contactEmail"
                name="contactEmail"
                value={formData.contactEmail}
                onChange={handleInputChange}
                className="input-field"
                placeholder="your.email@example.com"
              />
              <p className="text-sm text-gray-500 mt-1">
                Optional: We'll only use this to contact you if we need additional information.
              </p>
            </div>

            {/* Additional Information */}
            <div>
              <label htmlFor="additionalInfo" className="block text-sm font-medium text-gray-700 mb-2">
                Additional Information
              </label>
              <textarea
                id="additionalInfo"
                name="additionalInfo"
                value={formData.additionalInfo}
                onChange={handleInputChange}
                rows={4}
                className="input-field"
                placeholder="Any additional details, comments, or suggestions..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex items-center px-8 py-3 text-lg font-medium rounded-lg transition-colors duration-200 ${
                  isSubmitting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-primary hover:bg-orange-600 text-white'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    Submit Gene
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Guidelines */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Submission Guidelines</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">What to Submit:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Newly identified ciliopathy genes</li>
                <li>• Updated disease associations</li>
                <li>• Additional clinical features</li>
                <li>• Ortholog information</li>
                <li>• Database improvements</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Requirements:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Gene name and organism</li>
                <li>• Evidence type</li>
                <li>• Publication reference (if available)</li>
                <li>• Clear description of findings</li>
                <li>• Contact information (optional)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
          <p className="text-gray-600 mb-4">
            If you have questions about submitting genes or need assistance, 
            please contact the CiliaMiner team.
          </p>
          <div className="text-sm text-gray-500">
            <strong>Email:</strong> <a href="mailto:info@ciliaminer.org" className="text-primary hover:underline">info@ciliaminer.org</a>
          </div>
        </div>
      </div>
    </Layout>
  )
}
