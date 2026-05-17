import React, { useEffect, useState } from 'react'
import { customerPortalService, type CustomerInvoicesResponse } from '../../services/customerPortalService'

const ViewInvoicesPage: React.FC = () => {
  const [data, setData] = useState<CustomerInvoicesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true)
        const invoices = await customerPortalService.getMyInvoices()
        setData(invoices)
        setError(null)
      } catch (err) {
        setError('Unable to load invoices.')
        console.error('Error loading invoices:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchInvoices()
  }, [])

  if (loading) {
    return <div className="p-4">Loading invoices...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>
  }

  if (!data) {
    return <div className="p-4">No invoice data available.</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-2">View Invoices</h1>
      <p className="text-gray-600 mb-6">Customer: {data.customerName} ({data.customerCode})</p>
      
      {data.invoices.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">No invoices found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Invoice Number</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Due Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{invoice.invoiceNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(invoice.invoiceDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(invoice.dueDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-semibold">${invoice.totalAmount.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm">
                    {(() => {
                      if (invoice.status === 'Paid') {
                        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">{invoice.status}</span>
                      }
                      if (invoice.status === 'Pending') {
                        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">{invoice.status}</span>
                      }
                      return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{invoice.status}</span>
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ViewInvoicesPage
