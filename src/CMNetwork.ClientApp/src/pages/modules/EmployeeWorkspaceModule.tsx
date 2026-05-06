import { useEffect, useMemo, useState } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { expenseClaimsService, payslipsService } from '../../services/extendedOperationsService'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'

export type EmployeeWorkspaceKey = 'expense-claims' | 'payslips' | 'profile'

interface EmployeeWorkspaceModuleProps {
  moduleKey: EmployeeWorkspaceKey
}

interface ExpenseClaim {
  id: string
  claimNumber: string
  date: string
  category: string
  amount: number
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected'
}

interface ApiExpenseClaim {
  id: string
  claimNumber: string
  claimDate: string
  category: string
  amount: number
  status: number
}

interface Payslip {
  id: string
  payslipNumber: string
  periodStart: string
  periodEnd: string
  grossPay: number
  netPay: number
  deductions: number
  taxDeduction: number
  sssDeduction: number
  philHealthDeduction: number
  pagIbigDeduction: number
  otherDeductions: number
}

interface ApiPayslip {
  id: string
  payslipNumber: string
  periodStart: string
  periodEnd: string
  grossPay: number
  netPay: number
  taxDeduction: number
  sssDeduction: number
  philHealthDeduction: number
  pagIbigDeduction: number
  otherDeductions: number
}

const fallbackClaims: ExpenseClaim[] = [
  { id: 'claim-1', claimNumber: '#24015', date: '2024-05-20', category: 'Travel', amount: 85, status: 'Submitted' },
  { id: 'claim-2', claimNumber: '#24016', date: '2024-05-15', category: 'Meals', amount: 22.5, status: 'Approved' },
  { id: 'claim-3', claimNumber: '#24017', date: '2024-05-10', category: 'Office Supplies', amount: 120, status: 'Draft' },
  { id: 'claim-4', claimNumber: '#24018', date: '2024-05-06', category: 'Transport', amount: 35, status: 'Submitted' },
  { id: 'claim-5', claimNumber: '#24019', date: '2024-05-02', category: 'Training', amount: 600, status: 'Approved' },
]

const fallbackPayslips: Payslip[] = [
  {
    id: 'payslip-1',
    payslipNumber: 'PS-2024-03',
    periodStart: '2024-03-01',
    periodEnd: '2024-03-31',
    grossPay: 5500,
    netPay: 4250,
    deductions: 1250,
    taxDeduction: 875,
    sssDeduction: 300,
    philHealthDeduction: 50,
    pagIbigDeduction: 25,
    otherDeductions: 0,
  },
  {
    id: 'payslip-2',
    payslipNumber: 'PS-2024-02',
    periodStart: '2024-02-01',
    periodEnd: '2024-02-29',
    grossPay: 5500,
    netPay: 4250,
    deductions: 1250,
    taxDeduction: 875,
    sssDeduction: 300,
    philHealthDeduction: 50,
    pagIbigDeduction: 25,
    otherDeductions: 0,
  },
]

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

const formatShortPeriod = (start: string, end: string) => {
  const startDate = new Date(start)
  const endDate = new Date(end)
  return `${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`
}

const formatMonthYear = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const derivePhoneNumber = (email: string) => {
  const seed = email.length.toString().padStart(3, '0')
  return `+1 555-0${seed}`
}

export const EmployeeWorkspaceModule = ({ moduleKey }: EmployeeWorkspaceModuleProps) => {
  const user = useAuthStore((state) => state.user)
  const pushToast = useNotificationStore((state) => state.push)

  const [claims, setClaims] = useState<ExpenseClaim[]>(fallbackClaims)
  const [payslips, setPayslips] = useState<Payslip[]>(fallbackPayslips)
  const [claimsLoading, setClaimsLoading] = useState(false)
  const [payslipsLoading, setPayslipsLoading] = useState(false)
  const [claimSearch, setClaimSearch] = useState('')
  const [claimStatusFilter, setClaimStatusFilter] = useState<'all' | ExpenseClaim['status']>('all')
  const [claimDateFilter, setClaimDateFilter] = useState<'all' | '30' | '90'>('all')
  const [profileEditing, setProfileEditing] = useState(false)
  const [notificationPrefs, setNotificationPrefs] = useState({ email: true, sms: false, inApp: true })
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName ?? 'Employee User',
    email: user?.email ?? 'employee@cmnetwork.com',
    phone: derivePhoneNumber(user?.email ?? 'employee@cmnetwork.com'),
    address: '123 Corporate Drive, Suite 400, Cityville',
    department: user?.departmentId ? 'Assigned Department' : 'Accounting',
  })

  useEffect(() => {
    if (moduleKey !== 'expense-claims') {
      return
    }

    const loadClaims = async () => {
      try {
        setClaimsLoading(true)
        const response = await expenseClaimsService.getClaims()
        const items = (response.data as ApiExpenseClaim[]) ?? []
        const statusMap: Record<number, ExpenseClaim['status']> = {
          1: 'Draft',
          2: 'Submitted',
          3: 'Approved',
          4: 'Rejected',
        }

        if (items.length > 0) {
          setClaims(items.map((item) => ({
            id: item.id,
            claimNumber: item.claimNumber,
            date: item.claimDate,
            category: item.category,
            amount: item.amount,
            status: statusMap[item.status] ?? 'Draft',
          })))
        }
      } catch {
        setClaims(fallbackClaims)
      } finally {
        setClaimsLoading(false)
      }
    }

    void loadClaims()
  }, [moduleKey])

  useEffect(() => {
    if (moduleKey !== 'payslips') {
      return
    }

    const loadPayslips = async () => {
      try {
        setPayslipsLoading(true)
        const response = await payslipsService.getPayslips()
        const items = (response.data as ApiPayslip[]) ?? []

        if (items.length > 0) {
          setPayslips(items.map((item) => ({
            id: item.id,
            payslipNumber: item.payslipNumber,
            periodStart: item.periodStart,
            periodEnd: item.periodEnd,
            grossPay: item.grossPay,
            netPay: item.netPay,
            deductions: item.taxDeduction + item.sssDeduction + item.philHealthDeduction + item.pagIbigDeduction + item.otherDeductions,
            taxDeduction: item.taxDeduction,
            sssDeduction: item.sssDeduction,
            philHealthDeduction: item.philHealthDeduction,
            pagIbigDeduction: item.pagIbigDeduction,
            otherDeductions: item.otherDeductions,
          })))
        }
      } catch {
        setPayslips(fallbackPayslips)
      } finally {
        setPayslipsLoading(false)
      }
    }

    void loadPayslips()
  }, [moduleKey])

  useEffect(() => {
    setProfileForm({
      fullName: user?.fullName ?? 'Employee User',
      email: user?.email ?? 'employee@cmnetwork.com',
      phone: derivePhoneNumber(user?.email ?? 'employee@cmnetwork.com'),
      address: '123 Corporate Drive, Suite 400, Cityville',
      department: user?.departmentId ? 'Assigned Department' : 'Accounting',
    })
  }, [user])

  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      const searchMatches = claimSearch.trim().length === 0
        || claim.claimNumber.toLowerCase().includes(claimSearch.toLowerCase())
        || claim.category.toLowerCase().includes(claimSearch.toLowerCase())

      const statusMatches = claimStatusFilter === 'all' || claim.status === claimStatusFilter

      const dateMatches = (() => {
        if (claimDateFilter === 'all') {
          return true
        }

        const claimDate = new Date(claim.date).getTime()
        const threshold = Date.now() - Number(claimDateFilter) * 24 * 60 * 60 * 1000
        return claimDate >= threshold
      })()

      return searchMatches && statusMatches && dateMatches
    })
  }, [claimDateFilter, claimSearch, claimStatusFilter, claims])

  const pendingClaimTotal = useMemo(
    () => claims.filter((claim) => claim.status === 'Submitted').reduce((sum, claim) => sum + claim.amount, 0),
    [claims],
  )

  const approvedClaimTotal = useMemo(
    () => claims.filter((claim) => claim.status === 'Approved').reduce((sum, claim) => sum + claim.amount, 0),
    [claims],
  )

  const draftClaimCount = useMemo(
    () => claims.filter((claim) => claim.status === 'Draft').length,
    [claims],
  )

  const latestPayslip = payslips[0] ?? fallbackPayslips[0]
  const ytdDeductions = useMemo(() => ({
    tax: payslips.reduce((sum, item) => sum + item.taxDeduction, 0),
    sss: payslips.reduce((sum, item) => sum + item.sssDeduction, 0),
    philHealth: payslips.reduce((sum, item) => sum + item.philHealthDeduction, 0),
    pagIbig: payslips.reduce((sum, item) => sum + item.pagIbigDeduction, 0),
    other: payslips.reduce((sum, item) => sum + item.otherDeductions, 0),
  }), [payslips])

  const totalDeductionValue = Object.values(ytdDeductions).reduce((sum, value) => sum + value, 0)

  const profileCompletion = useMemo(() => {
    const values = Object.values(profileForm)
    const filledCount = values.filter((value) => value.trim().length > 0).length
    return Math.round((filledCount / values.length) * 100)
  }, [profileForm])

  const handleDownloadPayslip = async (payslipId: string) => {
    try {
      const response = await payslipsService.downloadPayslip(payslipId)
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data as BlobPart])
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${payslipId}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch {
      pushToast('info', 'Payslip download will be available when the API provides a file response.')
    }
  }

  const handleSaveProfile = () => {
    setProfileEditing(false)
    pushToast('success', 'Profile changes saved.')
  }

  const handleClaimAction = () => {
    pushToast('info', 'New claim dialog can be connected here next.')
  }

  if (moduleKey === 'expense-claims') {
    return (
      <section className="employee-suite employee-module-scene">
        <div className="employee-module-header">
          <div>
            <h1 className="employee-module-title">Expense Claims</h1>
            <p className="employee-module-subtitle">Track submissions, pending reimbursements, and drafts in one place.</p>
          </div>
          <Button themeColor="primary" className="employee-cta" onClick={handleClaimAction}>New Claim</Button>
        </div>

        <div className="employee-stat-grid">
          <article className="employee-stat-card">
            <div className="employee-stat-chip pending" data-tooltip="Pending \u2014 total value of expense claims submitted and awaiting approver action.">PD</div>
            <div>
              <div className="employee-stat-label">Total Pending</div>
              <div className="employee-stat-value">{formatCurrency(pendingClaimTotal)}</div>
            </div>
          </article>
          <article className="employee-stat-card">
            <div className="employee-stat-chip success" data-tooltip="Approved \u2014 total value of expense claims that have been approved.">AP</div>
            <div>
              <div className="employee-stat-label">Total Approved</div>
              <div className="employee-stat-value">{formatCurrency(approvedClaimTotal)}</div>
            </div>
          </article>
          <article className="employee-stat-card">
            <div className="employee-stat-chip neutral" data-tooltip="Drafts \u2014 number of expense claims saved but not yet submitted.">DR</div>
            <div>
              <div className="employee-stat-label">Drafts</div>
              <div className="employee-stat-value">{draftClaimCount}</div>
            </div>
          </article>
        </div>

        <div className="employee-surface-card">
          <div className="employee-toolbar">
            <input
              className="employee-search"
              placeholder="Search by claim number or category"
              value={claimSearch}
              onChange={(event) => setClaimSearch(event.target.value)}
            />
            <select className="employee-filter" value={claimDateFilter} onChange={(event) => setClaimDateFilter(event.target.value as 'all' | '30' | '90')}>
              <option value="all">Date Range</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
            <select className="employee-filter" value={claimStatusFilter} onChange={(event) => setClaimStatusFilter(event.target.value as 'all' | ExpenseClaim['status'])}>
              <option value="all">Status</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="employee-table-wrap">
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Claim #</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(claimsLoading ? fallbackClaims : filteredClaims).map((claim) => (
                  <tr key={claim.id}>
                    <td>{claim.claimNumber}</td>
                    <td>{claim.date}</td>
                    <td>{claim.category}</td>
                    <td>{formatCurrency(claim.amount)}</td>
                    <td><span
                      className={`employee-status-pill ${claim.status.toLowerCase()}`}
                      data-tooltip={
                        claim.status === 'Approved'
                          ? 'Approved \u2014 claim has been approved and is queued for reimbursement.'
                          : claim.status === 'Submitted'
                            ? 'Pending \u2014 claim has been submitted and is awaiting approver review.'
                            : claim.status === 'Rejected'
                              ? 'Rejected \u2014 claim was declined; review notes for the reason.'
                              : 'Draft \u2014 claim is still being prepared and has not been submitted.'
                      }
                    >{claim.status === 'Submitted' ? 'Pending' : claim.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    )
  }

  if (moduleKey === 'payslips') {
    const payslipRows = payslipsLoading ? fallbackPayslips : payslips

    return (
      <section className="employee-suite employee-module-scene" style={{ display: 'grid', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: '#0f172a' }}>Payslips</h1>
            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>Review your earnings, deductions, and tax contributions for the current fiscal year.</p>
          </div>
          <button
            type="button"
            style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            onClick={() => handleDownloadPayslip(latestPayslip.id)}
          >
            Download PDF
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #E0E4E8', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <span style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '4px 8px', textTransform: 'uppercase' }}>Latest Payment</span>
                <h2 style={{ margin: '10px 0 4px', fontSize: 24, color: '#0f172a' }}>{formatMonthYear(latestPayslip.periodEnd)}</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Period: {formatShortPeriod(latestPayslip.periodStart, latestPayslip.periodEnd)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#64748b', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Net Pay</div>
                <div style={{ color: '#1D63C1', fontSize: 32, fontWeight: 800 }}>{formatCurrency(latestPayslip.netPay)}</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ color: '#64748b', fontSize: 12 }}>Gross Pay</div>
                <div style={{ color: '#0f172a', fontWeight: 700 }}>{formatCurrency(latestPayslip.grossPay)}</div>
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: 12 }}>Deductions</div>
                <div style={{ color: '#dc2626', fontWeight: 700 }}>-{formatCurrency(latestPayslip.deductions)}</div>
              </div>
            </div>
          </div>

          <aside style={{ background: '#fff', border: '1px solid #E0E4E8', borderRadius: 12, padding: 20 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 600, color: '#0f172a' }}>Tax and Deductions YTD</h2>
            {[
              ['Income Tax', ytdDeductions.tax],
              ['Social Security', ytdDeductions.sss],
              ['PhilHealth', ytdDeductions.philHealth],
              ['Pag-IBIG', ytdDeductions.pagIbig],
              ['Other Deductions', ytdDeductions.other],
            ].map(([label, value]) => {
              const amount = Number(value)
              const percentage = totalDeductionValue === 0 ? 0 : Math.round((amount / totalDeductionValue) * 100)
              return (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#475569', marginBottom: 4 }}>
                    <span>{label}</span>
                    <span>{formatCurrency(amount)} ({percentage}%)</span>
                  </div>
                  <div style={{ height: 8, background: '#e2e8f0', borderRadius: 999 }}>
                    <div style={{ height: 8, width: `${percentage}%`, background: '#2563eb', borderRadius: 999 }} />
                  </div>
                </div>
              )
            })}
          </aside>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E0E4E8', borderRadius: 12, padding: 20 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 600, color: '#0f172a' }}>Payslip History</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Gross Pay</th>
                  <th>Deductions</th>
                  <th>Net Pay</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payslipRows.map((payslip) => (
                  <tr key={payslip.id}>
                    <td>{formatShortPeriod(payslip.periodStart, payslip.periodEnd)}</td>
                    <td>{formatCurrency(payslip.grossPay)}</td>
                    <td style={{ color: '#dc2626' }}>{formatCurrency(payslip.deductions)}</td>
                    <td style={{ color: '#1D63C1', fontWeight: 700 }}>{formatCurrency(payslip.netPay)}</td>
                    <td>
                      <button
                        type="button"
                        className="employee-inline-link"
                        onClick={() => handleDownloadPayslip(payslip.id)}
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="employee-suite employee-module-scene">
      <div className="employee-profile-header">
        <div>
          <h1 className="employee-module-title">Welcome, {profileForm.fullName} - Employee Profile</h1>
          <p className="employee-module-subtitle">Keep personal details and notification preferences current.</p>
        </div>
        <div className="employee-profile-progress">
          <span>Profile Completion</span>
          <strong>{profileCompletion}%</strong>
        </div>
      </div>
      <div className="employee-bar-track employee-profile-track">
        <div className="employee-bar-fill" style={{ width: `${profileCompletion}%` }} />
      </div>

      <div className="employee-profile-grid">
        <div className="employee-surface-card">
          <h2 className="employee-section-title">Personal Information</h2>
          <div className="employee-profile-form">
            {[
              ['Full Name', 'fullName'],
              ['Email', 'email'],
              ['Phone', 'phone'],
              ['Address', 'address'],
              ['Department', 'department'],
            ].map(([label, field]) => (
              <label key={field} className="employee-profile-field">
                <span>{label}</span>
                <input
                  value={profileForm[field as keyof typeof profileForm]}
                  onChange={(event) => setProfileForm((current) => ({ ...current, [field]: event.target.value }))}
                  disabled={!profileEditing}
                />
              </label>
            ))}
          </div>
          <div className="employee-profile-actions">
            <Button themeColor="primary" onClick={() => (profileEditing ? handleSaveProfile() : setProfileEditing(true))}>
              {profileEditing ? 'Save Changes' : 'Edit Profile'}
            </Button>
            <Button disabled={!profileEditing} onClick={() => setProfileEditing(false)}>Cancel</Button>
          </div>
        </div>

        <div className="employee-surface-card employee-security-card">
          <h2 className="employee-section-title">Security Settings</h2>
          <div className="employee-security-stack">
            <div>
              <strong>Multi-Factor Authentication (MFA)</strong>
              <p>Enabled (Standard)</p>
            </div>
            <div>
              <strong>Last Password Change</strong>
              <p>Apr 15, 2026</p>
            </div>
            <button type="button" className="employee-inline-link" onClick={() => pushToast('info', 'Password self-service flow can be connected here next.')}>Change Password</button>
          </div>
        </div>

        <div className="employee-surface-card employee-notification-card">
          <h2 className="employee-section-title">Notification Preferences</h2>
          <div className="employee-notification-stack">
            <label><input type="checkbox" checked={notificationPrefs.email} onChange={() => setNotificationPrefs((current) => ({ ...current, email: !current.email }))} /> Email Notifications</label>
            <label><input type="checkbox" checked={notificationPrefs.sms} onChange={() => setNotificationPrefs((current) => ({ ...current, sms: !current.sms }))} /> SMS Alerts</label>
            <label><input type="checkbox" checked={notificationPrefs.inApp} onChange={() => setNotificationPrefs((current) => ({ ...current, inApp: !current.inApp }))} /> In-App Notifications</label>
            <button type="button" className="employee-inline-link" onClick={() => pushToast('success', 'Notification preferences saved locally.')}>Manage Preferences</button>
          </div>
        </div>

        <div className="employee-surface-card employee-activity-card">
          <h2 className="employee-section-title">Recent Activity</h2>
          <ul className="employee-timeline">
            {[
              { when: 'Today, 10:30 AM', text: 'Profile picture updated.' },
              { when: 'Yesterday, 4:15 PM', text: 'Address changed.' },
              { when: 'Apr 20, 2026', text: 'MFA enabled.' },
              { when: 'Apr 15, 2026', text: 'Password updated.' },
            ].map((item) => (
              <li key={`${item.when}-${item.text}`}>
                <strong>{item.when}</strong>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}