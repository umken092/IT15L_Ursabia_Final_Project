import { useEffect, useMemo, useState } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { useNavigate } from 'react-router-dom'
import { expenseClaimsService, payslipsService } from '../../services/extendedOperationsService'
import { useAuthStore } from '../../store/authStore'
import { formatMoney, useDisplayCurrency } from '../../store/currencyStore'

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

interface ApiPayslip {
	id: string
	netPay: number
}

const fallbackClaims: ExpenseClaim[] = [
	{ id: 'claim-1', claimNumber: '#24015', date: '2024-05-20', category: 'Business Lunch', amount: 85, status: 'Submitted' },
	{ id: 'claim-2', claimNumber: '#24016', date: '2024-05-15', category: 'Taxi Fare', amount: 22.5, status: 'Approved' },
	{ id: 'claim-3', claimNumber: '#24017', date: '2024-05-10', category: 'Office Supplies', amount: 120, status: 'Draft' },
	{ id: 'claim-4', claimNumber: '#24018', date: '2024-05-07', category: 'Travel Allowance', amount: 340, status: 'Submitted' },
	{ id: 'claim-5', claimNumber: '#24019', date: '2024-05-01', category: 'Conference Fee', amount: 680, status: 'Approved' },
]

const fallbackYtdEarnings = 12450

const formatCurrency = (value: number) => formatMoney(value, 'PHP')

const formatLongDate = (value: string) =>
	new Date(value).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	})

export const EmployeeDashboard = () => {
	useDisplayCurrency()
	const navigate = useNavigate()
	const user = useAuthStore((state) => state.user)

	const [claims, setClaims] = useState<ExpenseClaim[]>(fallbackClaims)
	const [ytdEarnings, setYtdEarnings] = useState(fallbackYtdEarnings)

	useEffect(() => {
		const load = async () => {
			try {
				const [claimsResponse, payslipsResponse] = await Promise.all([
					expenseClaimsService.getClaims(),
					payslipsService.getPayslips(),
				])

				const statusMap: Record<number, ExpenseClaim['status']> = {
					1: 'Draft',
					2: 'Submitted',
					3: 'Approved',
					4: 'Rejected',
				}

				const claimItems = (claimsResponse.data as ApiExpenseClaim[]) ?? []
				if (claimItems.length > 0) {
					setClaims(claimItems.map((item) => ({
						id: item.id,
						claimNumber: item.claimNumber,
						date: item.claimDate,
						category: item.category,
						amount: item.amount,
						status: statusMap[item.status] ?? 'Draft',
					})))
				}

				const payslipItems = (payslipsResponse.data as ApiPayslip[]) ?? []
				if (payslipItems.length > 0) {
					setYtdEarnings(payslipItems.reduce((sum, payslip) => sum + payslip.netPay, 0))
				}
			} catch {
				setClaims(fallbackClaims)
				setYtdEarnings(fallbackYtdEarnings)
			}
		}

		void load()
	}, [])

	const draftCount = useMemo(() => claims.filter((claim) => claim.status === 'Draft').length, [claims])
	const pendingCount = useMemo(() => claims.filter((claim) => claim.status === 'Submitted').length, [claims])
	const recentItems = useMemo(() => claims.slice(0, 4), [claims])

	return (
		<section className="employee-suite employee-dashboard-scene">
			<div className="employee-hero">
				<div>
					<h1 className="employee-hero-title">Welcome, {user?.fullName ?? 'Employee User'}</h1>
					<p className="employee-hero-subtitle">
						Current Status: {draftCount} Draft Expenses, {pendingCount} Pending Approvals, {formatCurrency(ytdEarnings)} YTD Earnings
					</p>
				</div>
				<Button themeColor="primary" className="employee-cta" onClick={() => navigate('/module/expense-claims')}>
					New Expense
				</Button>
			</div>

			<div className="employee-stat-grid">
				<article className="employee-stat-card">
					<div className="employee-stat-chip neutral" data-tooltip="Draft Expenses \u2014 expense entries you've started but not yet submitted for approval.">DE</div>
					<div className="employee-stat-label">Draft Expenses</div>
					<div className="employee-dashboard-value">{draftCount}</div>
					<div className="employee-mini-track"><span style={{ width: `${Math.min(100, draftCount * 18)}%` }} /></div>
					<p className="employee-card-caption">Invoices used as employee expense proxy</p>
				</article>

				<article className="employee-stat-card">
					<div className="employee-stat-chip pending" data-tooltip="Pending Approvals \u2014 submissions currently awaiting managerial review.">PA</div>
					<div className="employee-stat-label">Pending Approvals</div>
					<div className="employee-dashboard-value">{pendingCount}</div>
					<div className="employee-mini-track"><span style={{ width: `${Math.min(100, pendingCount * 18)}%` }} /></div>
					<p className="employee-card-caption">Awaiting managerial review</p>
				</article>

				<article className="employee-stat-card">
					<div className="employee-stat-chip success" data-tooltip="Year-to-Date Earnings \u2014 cumulative earnings recorded for the current fiscal year.">YT</div>
					<div className="employee-stat-label">Year-to-Date Earnings</div>
					<div className="employee-dashboard-currency">{formatCurrency(ytdEarnings)}</div>
					<p className="employee-card-caption">Total earnings this fiscal year</p>
				</article>
			</div>

			<div className="employee-surface-card">
				<h2 className="employee-section-title">Recent Activity</h2>
				<table className="employee-table">
					<thead>
						<tr>
							<th>Date</th>
							<th>Description</th>
							<th>Amount</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{recentItems.map((item) => (
							<tr key={item.id}>
								<td>{formatLongDate(item.date)}</td>
								<td>{item.category}</td>
								<td>{formatCurrency(item.amount)}</td>
								<td>{item.status === 'Submitted' ? 'Pending' : item.status}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	)
}
