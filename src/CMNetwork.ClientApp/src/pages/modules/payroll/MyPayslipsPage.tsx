import { Button } from '@progress/kendo-react-buttons'
import { apiClient } from '../../../services/apiClient'
import type { PayslipSummaryDto } from './types'
import { formatCurrency } from './types'

interface MyPayslipsPageProps {
  payslips: PayslipSummaryDto[]
  loading: boolean
  onRefresh: () => Promise<void>
}

export const MyPayslipsPage = ({ payslips, loading, onRefresh }: MyPayslipsPageProps) => {
  const downloadPayslip = async (id: string) => {
    const response = await apiClient.get<Blob>(`/payroll/payslips/${id}`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(response.data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `payslip-${id}.pdf`
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <article className="card">
      <header className="card-head">
        <h3 className="card-title">My Payslips</h3>
        <p className="card-subtitle">Employee self-service view using issued payroll records</p>
      </header>

      <Button onClick={() => void onRefresh()} disabled={loading} style={{ marginBottom: '0.75rem' }}>Refresh</Button>

      <div style={{ overflowX: 'auto' }}>
        <table className="table-like" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Payslip #</th>
              <th>Pay Period</th>
              <th>Gross</th>
              <th>Net</th>
              <th>Generated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {payslips.map((payslip) => (
              <tr key={payslip.id}>
                <td>{payslip.payslipNumber}</td>
                <td>{payslip.payPeriod}</td>
                <td>{formatCurrency(payslip.grossPay)}</td>
                <td>{formatCurrency(payslip.netPay)}</td>
                <td>{new Date(payslip.generatedAtUtc).toLocaleString()}</td>
                <td>
                  <Button onClick={() => void downloadPayslip(payslip.id)} disabled={loading}>Download PDF</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}
