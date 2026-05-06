import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardBody, CardHeader, CardTitle } from '@progress/kendo-react-layout'
import { Button } from '@progress/kendo-react-buttons'
import { Input, TextArea } from '@progress/kendo-react-inputs'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import {
  auditorReportsService,
  evidenceArchiveService,
  financialReadOnlyService,
  type EvidenceArchiveItem,
  type SodReport,
  type SodViolation,
  type UserActivityItem,
  type UserActivityResponse,
  type EntityHistoryItem,
} from '../../services/auditorReportsService'
import { auditLogsService } from '../../services/extendedOperationsService'
import { useNotificationStore } from '../../store/notificationStore'

type AuditorModuleKey =
  | 'sod-report'
  | 'user-activity-timeline'
  | 'general-ledger-inquiry'
  | 'trial-balance'
  | 'vendor-master'
  | 'customer-master'
  | 'balance-sheet'
  | 'income-statement'
  | 'ap-aging'
  | 'ar-aging'
  | 'evidence-archive'

const today = new Date().toISOString().slice(0, 10)
const monthsAgo = (n: number) => {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 10)
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

const fmtMoney = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toLocaleString(undefined, { style: 'currency', currency: 'PHP' })
}

const fmtBytes = (n: number) => {
  if (!n || n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

const humanizeWord = (value: string | null | undefined) => {
  if (!value) return ''
  return value
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replaceAll(/[_-]+/g, ' ')
    .trim()
}

const friendlyTimelineArea = (entity: string | null | undefined, category: string | null | undefined) => {
  const source = entity || category || ''
  if (!source) return 'system'

  const apiMatch = /^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i.exec(source)
  if (apiMatch) {
    const path = apiMatch[2].toLowerCase()
    if (path.includes('/general-ledger')) return 'General Ledger'
    if (path.includes('/dashboard')) return 'Dashboard'
    if (path.includes('/auth/')) return 'Sign-In & Access'
    if (path.includes('/audit-logs')) return 'Audit Log Viewer'
    if (path.includes('/vendors')) return 'Vendor Master'
    if (path.includes('/customers')) return 'Customer Master'
    return 'system area'
  }

  return humanizeWord(source)
}

const friendlyTimelineAction = (action: string | null | undefined) => {
  if (!action) return 'Updated'
  const map: Record<string, string> = {
    GET: 'Viewed',
    POST: 'Created',
    PUT: 'Updated',
    PATCH: 'Updated',
    DELETE: 'Deleted',
    LoginSucceeded: 'Signed in',
    LoginFailed: 'Failed sign-in attempt',
    Logout: 'Signed out',
    Exported: 'Exported',
    Reviewed: 'Reviewed',
  }
  return map[action] ?? humanizeWord(action)
}

const buildTimelineSummary = (item: UserActivityItem) => {
  const who = item.userEmail || item.performedBy || 'User'
  const verb = friendlyTimelineAction(item.action)
  const area = friendlyTimelineArea(item.entity, item.category)
  return `${who} ${verb} ${area}`
}

const Section: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <Card style={{ marginBottom: '1rem' }}>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      {subtitle && <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>{subtitle}</p>}
    </CardHeader>
    <CardBody>{children}</CardBody>
  </Card>
)

const StatRow: React.FC<{ items: { label: string; value: string }[] }> = ({ items }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
    {items.map((it) => (
      <div key={it.label} style={{ background: 'var(--surface-muted)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{it.label}</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{it.value}</div>
      </div>
    ))}
  </div>
)

const SimpleTable: React.FC<{ columns: { key: string; label: string; render?: (row: any) => React.ReactNode }[]; rows: any[]; emptyMessage?: string }> = ({ columns, rows, emptyMessage }) => {
  if (!rows || rows.length === 0) {
    return <p style={{ color: 'var(--muted)', margin: 0 }}>{emptyMessage ?? 'No data.'}</p>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <thead>
          <tr style={{ background: 'var(--surface-muted)' }}>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: 'left', padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id ?? idx} style={{ borderBottom: '1px solid var(--border)' }}>
              {columns.map((c) => (
                <td key={c.key} style={{ padding: '0.45rem 0.6rem' }}>
                  {c.render ? c.render(row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── 1. SoD Report ────────────────────────────────────────────────────────────
const SodReportView: React.FC = () => {
  const [from, setFrom] = useState(monthsAgo(3))
  const [to, setTo] = useState(today)
  const [data, setData] = useState<SodReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<SodViolation | null>(null)
  const notify = useNotificationStore((s) => s.push)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await auditorReportsService.sodReport({ from, to })
      setData(res)
    } catch (e: any) {
      notify('error', `Failed to load SoD report: ${e?.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }, [from, to, notify])

  useEffect(() => { void load() }, [load])

  return (
    <>
      <Section title="Segregation of Duties Report" subtitle="Detect users performing pairs of activities that should be split between roles.">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
            From
            <Input type="date" value={from} onChange={(e) => setFrom(String(e.value ?? today))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
            To
            <Input type="date" value={to} onChange={(e) => setTo(String(e.value ?? today))} />
          </label>
          <Button themeColor="primary" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
        </div>

        <StatRow items={[
          { label: 'Rules evaluated', value: String(data?.ruleCount ?? 0) },
          { label: 'Violations found', value: String(data?.violationCount ?? 0) },
          { label: 'Window', value: `${from} → ${to}` },
        ]} />

        <SimpleTable
          emptyMessage={loading ? 'Loading…' : 'No segregation-of-duties violations in this window.'}
          rows={data?.violations ?? []}
          columns={[
            { key: 'ruleCode', label: 'Rule' },
            { key: 'ruleTitle', label: 'Title' },
            { key: 'user', label: 'User', render: (r) => r.userEmail || r.user },
            { key: 'sideACount', label: 'Side A', render: (r) => `${r.sideACount} events` },
            { key: 'sideBCount', label: 'Side B', render: (r) => `${r.sideBCount} events` },
            { key: 'lastActivityUtc', label: 'Last activity', render: (r) => fmtDate(r.lastActivityUtc) },
            { key: 'actions', label: '', render: (r) => <Button size="small" onClick={() => setSelected(r)}>Details</Button> },
          ]}
        />
      </Section>

      {selected && (
        <Dialog title={`${selected.ruleCode} — ${selected.ruleTitle}`} onClose={() => setSelected(null)} width={720}>
          <p style={{ marginTop: 0 }}>{selected.description}</p>
          <p><strong>User:</strong> {selected.userEmail || selected.user}</p>
          <h4>Side A activity ({selected.sideACount})</h4>
          <SimpleTable
            rows={selected.sampleSideA}
            columns={[
              { key: 'createdUtc', label: 'When', render: (r) => fmtDate(r.createdUtc) },
              { key: 'entityName', label: 'Entity' },
              { key: 'action', label: 'Action' },
              { key: 'recordId', label: 'Record' },
            ]}
          />
          <h4>Side B activity ({selected.sideBCount})</h4>
          <SimpleTable
            rows={selected.sampleSideB}
            columns={[
              { key: 'createdUtc', label: 'When', render: (r) => fmtDate(r.createdUtc) },
              { key: 'entityName', label: 'Entity' },
              { key: 'action', label: 'Action' },
              { key: 'recordId', label: 'Record' },
            ]}
          />
          <DialogActionsBar>
            <Button onClick={() => setSelected(null)}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}
    </>
  )
}

// ─── 2. User Activity Timeline ────────────────────────────────────────────────
const UserActivityView: React.FC = () => {
  const [user, setUser] = useState('')
  const [from, setFrom] = useState(monthsAgo(1))
  const [to, setTo] = useState(today)
  const [data, setData] = useState<UserActivityResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const notify = useNotificationStore((s) => s.push)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await auditorReportsService.userActivity({ user: user || undefined, from, to, take: 500 })
      setData(res)
    } catch (e: any) {
      notify('error', `Failed to load activity: ${e?.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }, [user, from, to, notify])

  useEffect(() => { void load() }, [load])

  return (
    <Section title="User Activity Timeline" subtitle="Simple timeline of key user actions.">
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem', minWidth: 220 }}>
          User (email or name)
          <Input value={user} onChange={(e) => setUser(String(e.value ?? ''))} placeholder="e.g. jane.doe@cmnetwork.com" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
          From
          <Input type="date" value={from} onChange={(e) => setFrom(String(e.value ?? today))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
          To
          <Input type="date" value={to} onChange={(e) => setTo(String(e.value ?? today))} />
        </label>
        <Button themeColor="primary" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Search'}</Button>
      </div>

      <StatRow items={[
        { label: 'Events', value: String(data?.items?.length ?? 0) },
        { label: 'User filter', value: user || 'All users' },
        { label: 'Date range', value: `${from} to ${to}` },
      ]} />

      {data?.availableUsers?.length ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
          Recent users: {data.availableUsers.slice(0, 12).map((u) => (
            <button key={u} type="button" onClick={() => setUser(u)} style={{ marginRight: 6, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, padding: '0 6px', cursor: 'pointer' }}>{u}</button>
          ))}
        </p>
      ) : null}

      {!loading && (data?.items?.length ?? 0) === 0 ? <p style={{ margin: 0, color: 'var(--muted)' }}>No activity in this range.</p> : null}

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {(data?.items ?? []).map((item, idx) => (
          <div
            key={item.id}
            style={{
              padding: '0.7rem 0.8rem',
              borderBottom: idx === (data?.items?.length ?? 0) - 1 ? 'none' : '1px solid var(--border)',
              background: idx % 2 === 0 ? 'var(--surface-muted)' : 'transparent',
            }}
          >
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{fmtDate(item.createdUtc)}</div>
            <div style={{ fontWeight: 600 }}>{buildTimelineSummary(item)}</div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ─── 3. General Ledger Inquiry ────────────────────────────────────────────────
const GeneralLedgerInquiryView: React.FC = () => {
  const [from, setFrom] = useState(monthsAgo(3))
  const [to, setTo] = useState(today)
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const notify = useNotificationStore((s) => s.push)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await financialReadOnlyService.journals({ from, to, status: status || undefined })
      const items = Array.isArray(res) ? res : (res?.items ?? res?.journals ?? [])
      setRows(items)
    } catch (e: any) {
      notify('error', `Failed to load journals: ${e?.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }, [from, to, status, notify])

  useEffect(() => { void load() }, [load])

  return (
    <Section title="General Ledger Inquiry" subtitle="Read-only browsing of posted and draft journal entries.">
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
          From
          <Input type="date" value={from} onChange={(e) => setFrom(String(e.value ?? today))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
          To
          <Input type="date" value={to} onChange={(e) => setTo(String(e.value ?? today))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
          Status
          {/* eslint-disable-next-line jsx-a11y/no-onchange */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ padding: '0.35rem' }}
          >
            <option value="">All</option>
            <option value="Draft">Draft</option>
            <option value="Posted">Posted</option>
          </select>
        </label>
        <Button themeColor="primary" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
      </div>
      <SimpleTable
        emptyMessage={loading ? 'Loading…' : 'No journals.'}
        rows={rows}
        columns={[
          { key: 'entryNumber', label: 'Entry #' },
          { key: 'entryDate', label: 'Date', render: (r) => r.entryDate ?? '—' },
          { key: 'description', label: 'Description' },
          { key: 'status', label: 'Status' },
          { key: 'totalAmount', label: 'Amount', render: (r) => fmtMoney(r.totalAmount ?? r.amount) },
          { key: 'createdBy', label: 'Created by' },
        ]}
      />
    </Section>
  )
}

// ─── 4. Trial Balance ─────────────────────────────────────────────────────────
const TrialBalanceView: React.FC = () => {
  const [asOf, setAsOf] = useState(today)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const notify = useNotificationStore((s) => s.push)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await financialReadOnlyService.trialBalance({ asOfDate: asOf })
      const items = Array.isArray(res) ? res : (res?.items ?? res?.rows ?? res?.accounts ?? [])
      setRows(items)
    } catch (e: any) {
      notify('error', `Failed to load trial balance: ${e?.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }, [asOf, notify])

  useEffect(() => { void load() }, [load])

  const totals = useMemo(() => {
    let debit = 0, credit = 0
    rows.forEach((r) => {
      debit += Number(r.debit ?? r.totalDebit ?? 0)
      credit += Number(r.credit ?? r.totalCredit ?? 0)
    })
    return { debit, credit, diff: debit - credit }
  }, [rows])

  return (
    <Section title="Trial Balance" subtitle="As of selected date.">
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
          As of
          <Input type="date" value={asOf} onChange={(e) => setAsOf(String(e.value ?? today))} />
        </label>
        <Button themeColor="primary" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
      </div>
      <StatRow items={[
        { label: 'Total Debit', value: fmtMoney(totals.debit) },
        { label: 'Total Credit', value: fmtMoney(totals.credit) },
        { label: 'Difference', value: fmtMoney(totals.diff) },
      ]} />
      <SimpleTable
        emptyMessage={loading ? 'Loading…' : 'No accounts.'}
        rows={rows}
        columns={[
          { key: 'accountCode', label: 'Code', render: (r) => r.accountCode ?? r.code ?? r.account ?? '—' },
          { key: 'name', label: 'Account', render: (r) => r.name ?? r.accountName ?? '—' },
          { key: 'type', label: 'Type' },
          { key: 'debit', label: 'Debit', render: (r) => fmtMoney(r.debit ?? r.totalDebit) },
          { key: 'credit', label: 'Credit', render: (r) => fmtMoney(r.credit ?? r.totalCredit) },
        ]}
      />
    </Section>
  )
}

// ─── 5. Vendor Master / 6. Customer Master ────────────────────────────────────
const PartyMasterView: React.FC<{ kind: 'vendor' | 'customer' }> = ({ kind }) => {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [history, setHistory] = useState<EntityHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const notify = useNotificationStore((s) => s.push)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = kind === 'vendor'
        ? await financialReadOnlyService.vendors()
        : await financialReadOnlyService.customers()
      const items = Array.isArray(res) ? res : (res?.items ?? res?.vendors ?? res?.customers ?? [])
      setRows(items)
    } catch (e: any) {
      notify('error', `Failed to load ${kind}s: ${e?.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }, [kind, notify])

  useEffect(() => { void load() }, [load])

  const openHistory = async (row: any) => {
    setSelected(row)
    setHistoryLoading(true)
    try {
      const res = kind === 'vendor'
        ? await auditorReportsService.vendorHistory(row.id)
        : await auditorReportsService.customerHistory(row.id)
      setHistory(res.items)
    } catch (e: any) {
      notify('error', `History failed: ${e?.message ?? e}`)
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <>
      <Section
        title={kind === 'vendor' ? 'Vendor Master' : 'Customer Master'}
        subtitle={`Browse ${kind} records and review change history derived from the audit log.`}
      >
        <Button onClick={load} disabled={loading} themeColor="primary">{loading ? 'Loading…' : 'Refresh'}</Button>
        <div style={{ height: 12 }} />
        <SimpleTable
          rows={rows}
          emptyMessage={loading ? 'Loading…' : `No ${kind}s.`}
          columns={[
            { key: kind === 'vendor' ? 'vendorCode' : 'customerCode', label: 'Code' },
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'phoneNumber', label: 'Phone' },
            { key: 'city', label: 'City' },
            { key: 'country', label: 'Country' },
            { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') },
            { key: 'actions', label: '', render: (r) => <Button size="small" onClick={() => openHistory(r)}>History</Button> },
          ]}
        />
      </Section>

      {selected && (
        <Dialog title={`History — ${selected.name}`} onClose={() => { setSelected(null); setHistory([]) }} width={720}>
          {historyLoading ? <p>Loading…</p> : (
            <SimpleTable
              rows={history}
              emptyMessage="No audit-log activity for this record."
              columns={[
                { key: 'createdUtc', label: 'When', render: (r) => fmtDate(r.createdUtc) },
                { key: 'action', label: 'Action' },
                { key: 'category', label: 'Category' },
                { key: 'performedBy', label: 'User', render: (r) => r.userEmail || r.performedBy },
              ]}
            />
          )}
          <DialogActionsBar>
            <Button onClick={() => { setSelected(null); setHistory([]) }}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}
    </>
  )
}

// ─── 7. Balance Sheet / 8. Income Statement ───────────────────────────────────
const FinancialStatementView: React.FC<{ kind: 'balance-sheet' | 'income-statement' }> = ({ kind }) => {
  const [asOf, setAsOf] = useState(today)
  const [from, setFrom] = useState(monthsAgo(3))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const notify = useNotificationStore((s) => s.push)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = kind === 'balance-sheet'
        ? await financialReadOnlyService.balanceSheet({ asOfDate: asOf })
        : await financialReadOnlyService.incomeStatement({ from, to: asOf })
      setData(res)
    } catch (e: any) {
      notify('error', `Failed to load report: ${e?.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }, [kind, asOf, from, notify])

  useEffect(() => { void load() }, [load])

  const renderSection = (title: string, items: any[] | undefined) => (
    <div style={{ marginBottom: '1rem' }}>
      <h4 style={{ margin: '0 0 0.5rem' }}>{title}</h4>
      <SimpleTable
        rows={items ?? []}
        columns={[
          { key: 'accountCode', label: 'Code', render: (r) => r.accountCode ?? r.code ?? '—' },
          { key: 'name', label: 'Account', render: (r) => r.name ?? r.accountName ?? '—' },
          { key: 'amount', label: 'Amount', render: (r) => fmtMoney(r.amount ?? r.balance ?? r.total) },
        ]}
      />
    </div>
  )

  return (
    <Section
      title={kind === 'balance-sheet' ? 'Balance Sheet (Read-Only)' : 'Income Statement (Read-Only)'}
      subtitle={kind === 'balance-sheet' ? 'Snapshot of assets, liabilities, and equity.' : 'Revenue and expenses for the selected period.'}
    >
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
        {kind === 'income-statement' && (
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
            From
            <Input type="date" value={from} onChange={(e) => setFrom(String(e.value ?? today))} />
          </label>
        )}
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
          {kind === 'balance-sheet' ? 'As of' : 'To'}
          <Input type="date" value={asOf} onChange={(e) => setAsOf(String(e.value ?? today))} />
        </label>
        <Button themeColor="primary" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
      </div>

      {kind === 'balance-sheet' ? (
        <>
          {renderSection('Assets', data?.assets)}
          {renderSection('Liabilities', data?.liabilities)}
          {renderSection('Equity', data?.equity)}
          <StatRow items={[
            { label: 'Total Assets', value: fmtMoney(data?.totalAssets) },
            { label: 'Total Liabilities', value: fmtMoney(data?.totalLiabilities) },
            { label: 'Total Equity', value: fmtMoney(data?.totalEquity) },
          ]} />
        </>
      ) : (
        <>
          {renderSection('Revenue', data?.revenue)}
          {renderSection('Expenses', data?.expenses)}
          <StatRow items={[
            { label: 'Total Revenue', value: fmtMoney(data?.totalRevenue) },
            { label: 'Total Expenses', value: fmtMoney(data?.totalExpenses) },
            { label: 'Net Income', value: fmtMoney(data?.netIncome) },
          ]} />
        </>
      )}
    </Section>
  )
}

// ─── 9. AP Aging / 10. AR Aging ───────────────────────────────────────────────
// Pivot flat invoice items (one row per invoice) into one row per party with bucket columns.
// Backend returns: { vendorName/customerName, totalAmount, bucket: "Current"|"1-30 days"|... }
const pivotAgingItems = (items: any[], kind: 'ap' | 'ar') => {
  const map = new Map<string, { partyName: string; current: number; days30: number; days60: number; days90: number; over90: number }>()
  for (const inv of items) {
    const name: string = (kind === 'ap' ? inv.vendorName : inv.customerName) ?? inv.partyName ?? inv.name ?? 'Unknown'
    if (!map.has(name)) map.set(name, { partyName: name, current: 0, days30: 0, days60: 0, days90: 0, over90: 0 })
    const row = map.get(name)
    if (!row) continue
    const amt: number = inv.totalAmount ?? 0
    const bucket: string = inv.bucket ?? ''
    if (bucket === 'Current') row.current += amt
    else if (bucket === '1-30 days') row.days30 += amt
    else if (bucket === '31-60 days') row.days60 += amt
    else if (bucket === '61-90 days') row.days90 += amt
    else row.over90 += amt
  }
  return Array.from(map.values()).map((r) => ({
    ...r,
    total: r.current + r.days30 + r.days60 + r.days90 + r.over90,
  })).sort((a, b) => b.total - a.total)
}

const AgingView: React.FC<{ kind: 'ap' | 'ar' }> = ({ kind }) => {
  const [asOf, setAsOf] = useState(today)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const notify = useNotificationStore((s) => s.push)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = kind === 'ap'
        ? await financialReadOnlyService.apAging({ asOfDate: asOf })
        : await financialReadOnlyService.arAging({ asOfDate: asOf })
      const items: any[] = Array.isArray(res) ? res : (res?.items ?? res?.rows ?? res?.buckets ?? [])
      setRows(pivotAgingItems(items, kind))
    } catch (e: any) {
      notify('error', `Failed to load aging: ${e?.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }, [kind, asOf, notify])

  useEffect(() => { void load() }, [load])

  return (
    <Section
      title={kind === 'ap' ? 'AP Aging (Read-Only)' : 'AR Aging (Read-Only)'}
      subtitle={kind === 'ap' ? 'Outstanding payables by age bucket.' : 'Outstanding receivables by age bucket.'}
    >
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
          As of
          <Input type="date" value={asOf} onChange={(e) => setAsOf(String(e.value ?? today))} />
        </label>
        <Button themeColor="primary" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
      </div>
      <SimpleTable
        rows={rows}
        emptyMessage={loading ? 'Loading…' : 'No outstanding balances.'}
        columns={[
          { key: 'partyName', label: kind === 'ap' ? 'Vendor' : 'Customer', render: (r) => r.vendorName ?? r.customerName ?? r.partyName ?? r.name ?? '—' },
          { key: 'current', label: 'Current', render: (r) => fmtMoney(r.current) },
          { key: 'days30', label: '1–30', render: (r) => fmtMoney(r.days30 ?? r['1-30']) },
          { key: 'days60', label: '31–60', render: (r) => fmtMoney(r.days60 ?? r['31-60']) },
          { key: 'days90', label: '61–90', render: (r) => fmtMoney(r.days90 ?? r['61-90']) },
          { key: 'over90', label: '90+', render: (r) => fmtMoney(r.over90 ?? r['90+']) },
          { key: 'total', label: 'Total', render: (r) => fmtMoney(r.total) },
        ]}
      />
    </Section>
  )
}

// ─── 11. Evidence Archive ─────────────────────────────────────────────────────
const EvidenceArchiveView: React.FC = () => {
  const [items, setItems] = useState<EvidenceArchiveItem[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [auditLogsLoading, setAuditLogsLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ id: string; ok: boolean; expected: string; actual?: string } | null>(null)
  const notify = useNotificationStore((s) => s.push)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await evidenceArchiveService.list(200)
      setItems(res.items)
    } catch (e: any) {
      notify('error', `Failed to load archives: ${e?.message ?? e}`)
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => { void load() }, [load])

  const openCreate = async () => {
    setOpen(true)
    setTitle(''); setDescription(''); setSelectedIds(new Set())
    setAuditLogsLoading(true)
    try {
      const res: any = await auditLogsService.search({} as any)
      const list = Array.isArray(res) ? res : (res?.data?.items ?? res?.items ?? res?.data ?? [])
      setAuditLogs(list.slice(0, 200))
    } catch (e: any) {
      notify('error', `Failed to load audit logs: ${e?.message ?? e}`)
    } finally {
      setAuditLogsLoading(false)
    }
  }

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const submit = async () => {
    if (!title.trim()) { notify('error', 'Title is required.'); return }
    if (selectedIds.size === 0) { notify('error', 'Select at least one audit log.'); return }
    setSubmitting(true)
    try {
      const res = await evidenceArchiveService.create({ title: title.trim(), description: description.trim() || undefined, auditLogIds: Array.from(selectedIds) })
      notify('success', `Archive ${res.archiveNumber} created successfully`)
      setOpen(false)
      await load()
    } catch (e: any) {
      notify('error', `Create failed: ${e?.response?.data?.message ?? e?.message ?? e}`)
    } finally {
      setSubmitting(false)
    }
  }

  const verify = async (id: string) => {
    try {
      const res = await evidenceArchiveService.verify(id)
      setVerifyResult({ id, ...res })
    } catch (e: any) {
      notify('error', `Verify failed: ${e?.message ?? e}`)
    }
  }

  return (
    <>
      <Section title="Evidence Archive" subtitle="Package selected audit log entries into checksum-stamped JSON files for external review.">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Button themeColor="primary" onClick={openCreate}>New Archive</Button>
          <Button onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
        </div>
        <SimpleTable
          rows={items}
          emptyMessage={loading ? 'Loading…' : 'No archives yet.'}
          columns={[
            { key: 'archiveNumber', label: 'Number' },
            { key: 'title', label: 'Title' },
            { key: 'entryCount', label: 'Entries' },
            { key: 'fileSizeBytes', label: 'Size', render: (r) => fmtBytes(r.fileSizeBytes) },

            { key: 'generatedBy', label: 'By', render: (r) => r.generatedByEmail || r.generatedBy },
            { key: 'generatedUtc', label: 'When', render: (r) => fmtDate(r.generatedUtc) },
            { key: 'actions', label: '', render: (r) => (
              <span style={{ display: 'flex', gap: 4 }}>
                <a href={evidenceArchiveService.downloadUrl(r.id)} className="k-button k-button-md k-button-solid k-button-solid-base" target="_blank" rel="noreferrer">Download</a>
                <Button size="small" onClick={() => verify(r.id)}>Verify</Button>
              </span>
            ) },
          ]}
        />
      </Section>

      {open && (
        <Dialog title="Create Evidence Archive" onClose={() => setOpen(false)} width={840}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Title</div>
            <Input value={title} onChange={(e) => setTitle(String(e.value ?? ''))} />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Description</div>
            <TextArea value={description} onChange={(e) => setDescription(String(e.value ?? ''))} rows={2} />
          </label>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
            Select audit log entries to include ({selectedIds.size} selected of {auditLogs.length} shown).
          </p>
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <SimpleTable
              rows={auditLogs}
              emptyMessage={auditLogsLoading ? 'Loading…' : 'No audit logs.'}
              columns={[
                { key: 'sel', label: '', render: (r) => (
                  <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggle(r.id)} />
                ) },
                { key: 'createdUtc', label: 'When', render: (r) => fmtDate(r.createdUtc) },
                { key: 'entityName', label: 'Entity' },
                { key: 'action', label: 'Action' },
                { key: 'performedBy', label: 'By', render: (r) => r.userEmail || r.performedBy },
              ]}
            />
          </div>
          <DialogActionsBar>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button themeColor="primary" onClick={submit} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Archive'}
            </Button>
          </DialogActionsBar>
        </Dialog>
      )}

      {verifyResult && (
        <Dialog title="Archive Verification" onClose={() => setVerifyResult(null)} width={520}>
          <p>Status: <strong style={{ color: verifyResult.ok ? 'green' : 'crimson' }}>{verifyResult.ok ? '✔ Archive is intact — file has not been modified.' : '✖ Integrity check failed — the file may have been tampered with.'}</strong></p>
          <DialogActionsBar>
            <Button onClick={() => setVerifyResult(null)}>Close</Button>
          </DialogActionsBar>
        </Dialog>
      )}
    </>
  )
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
export const AuditorModulesModule: React.FC<{ moduleKey: AuditorModuleKey }> = ({ moduleKey }) => {
  switch (moduleKey) {
    case 'sod-report': return <SodReportView />
    case 'user-activity-timeline': return <UserActivityView />
    case 'general-ledger-inquiry': return <GeneralLedgerInquiryView />
    case 'trial-balance': return <TrialBalanceView />
    case 'vendor-master': return <PartyMasterView kind="vendor" />
    case 'customer-master': return <PartyMasterView kind="customer" />
    case 'balance-sheet': return <FinancialStatementView kind="balance-sheet" />
    case 'income-statement': return <FinancialStatementView kind="income-statement" />
    case 'ap-aging': return <AgingView kind="ap" />
    case 'ar-aging': return <AgingView kind="ar" />
    case 'evidence-archive': return <EvidenceArchiveView />
    default: return null
  }
}

export type { AuditorModuleKey }
