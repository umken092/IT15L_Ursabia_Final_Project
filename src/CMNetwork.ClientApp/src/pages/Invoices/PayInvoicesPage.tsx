import React, { useEffect, useState } from 'react'
import { customerPortalService, type CustomerInvoicesResponse } from '../../services/customerPortalService'

const PayInvoicesPage: React.FC = () => {
  const [data, setData] = useState<CustomerInvoicesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])

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

  const handleSelectInvoice = (invoiceId: string) => {
    setSelectedInvoices((prev) =>
      prev.includes(invoiceId) ? prev.filter((id) => id !== invoiceId) : [...prev, invoiceId]
    )
  }

  const handlePayment = async () => {
    if (selectedInvoices.length === 0) {
      setError('Please select at least one invoice to pay.')
      return
    }

    try {
      setProcessing(true)
      setError(null)
      const totalAmount = data
        ?.invoices.filter((inv) => selectedInvoices.includes(inv.id))
        .reduce((sum, inv) => sum + inv.totalAmount, 0) ?? 0

      const result = await customerPortalService.createPaymentIntent(selectedInvoices, totalAmount)
      globalThis.location.href = result.redirectUrl
    } catch (err) {
      setError('Unable to process payment. Please try again.')
      console.error('Error processing payment:', err)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return <div className="p-4">Loading invoices...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>
  }

  if (!data) {
    return <div className="p-4">No invoice data available.</div>
  }

  const pendingInvoices = data.invoices.filter((inv) => inv.status !== 'Paid')
  const totalSelected = data.invoices
    .filter((inv) => selectedInvoices.includes(inv.id))
    .reduce((sum, inv) => sum + inv.totalAmount, 0)

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-2">Pay Invoices</h1>
      <p className="text-gray-600 mb-6">Customer: {data.customerName} ({data.customerCode})</p>
      
      {error && <div className="mb-4 p-4 bg-red-100 text-red-800 rounded">{error}</div>}

      {pendingInvoices.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-500">No pending invoices to pay.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input type="checkbox" readOnly />
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Invoice Number</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Due Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedInvoices.includes(invoice.id)}
                        onChange={() => handleSelectInvoice(invoice.id)}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{invoice.invoiceNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(invoice.invoiceDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(invoice.dueDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-semibold">${invoice.totalAmount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 rounded-lg shadow p-6">
            <p className="text-lg font-semibold text-gray-900">
              Total to Pay: <span className="text-blue-600">${totalSelected.toFixed(2)}</span>
            </p>
            <button
              onClick={handlePayment}
              disabled={processing || selectedInvoices.length === 0}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {processing ? 'Processing...' : 'Proceed to Payment'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default PayInvoicesPage
