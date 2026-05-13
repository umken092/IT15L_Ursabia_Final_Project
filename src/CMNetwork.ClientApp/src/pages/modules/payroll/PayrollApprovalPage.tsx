import { Button } from '@progress/kendo-react-buttons'
import type { PayrollRegisterDto, PayrollRunDto } from './types'
import { formatCurrency, payrollFlowSteps, runStatusLabel } from './types'

interface PayrollApprovalPageProps {
  loading: boolean
  runs: PayrollRunDto[]
  selectedRunId: string
  register: PayrollRegisterDto | null
  onSelectRun: (runId: string) => void
  onLoadRegister: () => Promise<void>
  onApprove: () => Promise<void>
  onReject: () => Promise<void>
  onReopen: () => Promise<void>
  reopenGuidance: string
}

export const PayrollApprovalPage = ({
  loading,
  runs,
  selectedRunId,
  register,
  onSelectRun,
  onLoadRegister,
  onApprove,
  onReject,
  onReopen,
  reopenGuidance,
}: PayrollApprovalPageProps) => {
  const approvalCandidates = runs.filter((run) => run.status === 2)

  const showSuccessBanner = (message: string) => (
    <div className="success-banner">
      <p>{message}</p>
    </div>
  )

  return (
    <>
      {register?.status === 3 && showSuccessBanner('Payroll approved successfully!')}
      {register?.status === 4 && showSuccessBanner('Payroll rejected successfully!')}
      <article className="card">
        <header className="card-head">
          <h3 className="card-title">Payroll Approval</h3>
          <p className="card-subtitle">CFO review and disposition of submitted payroll runs</p>
        </header>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <select value={selectedRunId} onChange={(e) => onSelectRun(e.target.value)} style={{ flex: 1 }}>
            <option value="">Select submitted run</option>
            {approvalCandidates.map((run) => (
              <option key={run.id} value={run.id}>{`${run.payPeriodLabel} | ${run.id.slice(0, 8)}`}</option>
            ))}
          </select>
          <Button onClick={() => void onLoadRegister()} disabled={loading || !selectedRunId}>Load Register</Button>
        </div>

        {register && (
          <>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {payrollFlowSteps.map((step) => {
                const isActive = register.status === step.status
                return (
                  <span
                    key={step.status}
                    style={{
                      borderRadius: '999px',
                      border: `1px solid ${isActive ? '#1d4ed8' : '#d1d5db'}`,
                      background: isActive ? '#dbeafe' : '#f9fafb',
                      color: isActive ? '#1e3a8a' : '#374151',
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    {step.label}
                  </span>
                )
              })}
            </div>

            <p className="card-subtitle" style={{ marginTop: 0 }}>
              {register.payPeriod} | {runStatusLabel(register.status)}
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-like" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Gross</th>
                    <th>Tax</th>
                    <th>SSS</th>
                    <th>PhilHealth</th>
                    <th>Pag-IBIG</th>
                    <th>Deductions</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {register.lineItems.map((item) => (
                    <tr key={item.employeeId}>
                      <td>{item.employeeName}</td>
                      <td>{formatCurrency(item.grossPay)}</td>
                      <td>{formatCurrency(item.trainTax)}</td>
                      <td>{formatCurrency(item.sssFee)}</td>
                      <td>{formatCurrency(item.philHealthFee)}</td>
                      <td>{formatCurrency(item.pagIbigFee)}</td>
                      <td>{formatCurrency(item.totalDeductions)}</td>
                      <td>{formatCurrency(item.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: '0.75rem' }}>
              Total Net Pay <strong>{formatCurrency(register.totals.totalNetPay)}</strong>
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button onClick={() => void onApprove()} disabled={loading || register.status !== 2}>Approve</Button>
              <Button onClick={() => void onReject()} disabled={loading || register.status !== 2}>Reject</Button>
              <Button onClick={() => void onReopen()} disabled={loading || !(register.status === 3 || register.status === 5)}>Re-open</Button>
            </div>
            <p className="card-subtitle" style={{ marginTop: '0.5rem', marginBottom: 0 }}>{reopenGuidance}</p>
          </>
        )}
      </article>
    </>
  )
}
