import { useEffect, useState } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { Input, type InputChangeEvent } from '@progress/kendo-react-inputs'
import { DashboardCard } from '../../components/DashboardCard'
import { bankDirectoryService, type BankDirectoryItem } from '../../services/bankDirectoryService'
import { useNotificationStore } from '../../store/notificationStore'

const toText = (value: unknown) => (typeof value === 'string' ? value : '')

const defaultAccountPattern = String.raw`^\d{4}-\d{4}-\d{2}$`
type BankStatusFilter = 'all' | 'active' | 'removed'

const toDateLabel = (value?: string | null) => {
  if (!value) return '-'
  const dt = new Date(value)
  return Number.isNaN(dt.getTime()) ? '-' : dt.toLocaleString()
}

const extractApiMessage = (error: unknown, fallback: string) => {
  if (typeof error !== 'object' || error === null) return fallback
  const payload = error as {
    response?: { data?: { message?: string } | string }
    message?: string
  }

  const raw = payload.response?.data
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (typeof raw === 'object' && raw && typeof raw.message === 'string' && raw.message.trim()) {
    return raw.message.trim()
  }
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim()
  return fallback
}

export const BankDirectoryModule = () => {
  const push = useNotificationStore((state) => state.push)
  const [loading, setLoading] = useState(false)
  const [banks, setBanks] = useState<BankDirectoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BankStatusFilter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    country: 'Philippines',
    branchName: '',
    accountNumberPattern: '',
    accountNumberSample: '',
  })
  const [form, setForm] = useState({
    name: '',
    country: 'Philippines',
    branchName: '',
    accountNumberPattern: defaultAccountPattern,
    accountNumberSample: '1234-5678-90',
  })

  const loadBanks = async (targetPage = page, searchTerm = search) => {
    setLoading(true)
    try {
      const response = await bankDirectoryService.getAllBanks({
        search: searchTerm.trim() || undefined,
        status: statusFilter,
        page: targetPage,
        pageSize,
      })

      setBanks(response.data.items ?? [])
      setTotal(response.data.total ?? 0)
      setPage(targetPage)
    } catch {
      push('error', 'Unable to load bank directory.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBanks(1)
  }, [statusFilter, search])

  const addBank = async () => {
    if (!form.name.trim() || !form.accountNumberPattern.trim() || !form.accountNumberSample.trim()) {
      push('warning', 'Bank name, account number format, and sample are required.')
      return
    }

    try {
      await bankDirectoryService.createBank({
        name: form.name.trim(),
        country: form.country.trim(),
        branchName: form.branchName.trim() || undefined,
        accountNumberPattern: form.accountNumberPattern.trim(),
        accountNumberSample: form.accountNumberSample.trim(),
      })
      push('success', 'Bank saved successfully.')
      setForm({
        name: '',
        country: 'Philippines',
        branchName: '',
        accountNumberPattern: defaultAccountPattern,
        accountNumberSample: '1234-5678-90',
      })
      await loadBanks(1)
    } catch (error) {
      push('error', extractApiMessage(error, 'Failed to save bank.'))
    }
  }

  const startEdit = (bank: BankDirectoryItem) => {
    setEditingId(bank.id)
    setEditForm({
      name: bank.name,
      country: bank.country,
      branchName: bank.branchName ?? '',
      accountNumberPattern: bank.accountNumberPattern,
      accountNumberSample: bank.accountNumberSample,
    })
  }

  const saveEdit = async (id: string) => {
    if (!editForm.name.trim() || !editForm.accountNumberPattern.trim() || !editForm.accountNumberSample.trim()) {
      push('warning', 'Bank name, account number format, and sample are required.')
      return
    }

    try {
      await bankDirectoryService.updateBank(id, {
        name: editForm.name.trim(),
        country: editForm.country.trim(),
        branchName: editForm.branchName.trim() || undefined,
        accountNumberPattern: editForm.accountNumberPattern.trim(),
        accountNumberSample: editForm.accountNumberSample.trim(),
      })
      push('success', 'Bank updated successfully.')
      setEditingId(null)
      await loadBanks(page)
    } catch (error) {
      push('error', extractApiMessage(error, 'Failed to update bank.'))
    }
  }

  const removeBank = async (bank: BankDirectoryItem) => {
    if (!bank.isActive) return
    if (!confirm(`Remove bank "${bank.name}" from active list?`)) return

    try {
      await bankDirectoryService.removeBank(bank.id)
      push('success', 'Bank removed successfully.')
      await loadBanks(page)
    } catch (error) {
      push('error', extractApiMessage(error, 'Failed to remove bank.'))
    }
  }

  const restoreBank = async (bank: BankDirectoryItem) => {
    if (bank.isActive) return

    try {
      await bankDirectoryService.restoreBank(bank.id)
      push('success', 'Bank restored successfully.')
      await loadBanks(page)
    } catch (error) {
      push('error', extractApiMessage(error, 'Failed to restore bank.'))
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <section className="accountant-module">
      <header className="card-header" style={{ marginBottom: '0.75rem' }}>
        <h1 className="page-title">Bank Directory</h1>
        <p className="card-subtitle">Manage active banks and account number formats for statement imports.</p>
      </header>

      <DashboardCard title="Directory Overview" subtitle="Register banks and define account number formats by bank and branch.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
          <div>
            <label htmlFor="bank-directory-name">Bank Name</label>
            <Input
              id="bank-directory-name"
              placeholder="e.g. Metrobank"
              value={form.name}
              onChange={(e: InputChangeEvent) => setForm((curr) => ({ ...curr, name: toText(e.value) }))}
            />
          </div>
          <div>
            <label htmlFor="bank-directory-country">Country</label>
            <Input
              id="bank-directory-country"
              placeholder="e.g. Philippines"
              value={form.country}
              onChange={(e: InputChangeEvent) => setForm((curr) => ({ ...curr, country: toText(e.value) }))}
            />
          </div>
          <div>
            <label htmlFor="bank-directory-branch">Branch</label>
            <Input
              id="bank-directory-branch"
              placeholder="e.g. Makati Main"
              value={form.branchName}
              onChange={(e: InputChangeEvent) => setForm((curr) => ({ ...curr, branchName: toText(e.value) }))}
            />
          </div>
          <div>
            <label htmlFor="bank-directory-pattern">Account Number Regex</label>
            <Input
              id="bank-directory-pattern"
              placeholder="^\\d{4}-\\d{4}-\\d{2}$"
              value={form.accountNumberPattern}
              onChange={(e: InputChangeEvent) => setForm((curr) => ({ ...curr, accountNumberPattern: toText(e.value) }))}
            />
          </div>
          <div>
            <label htmlFor="bank-directory-sample">Sample Format</label>
            <Input
              id="bank-directory-sample"
              placeholder="1234-5678-90"
              value={form.accountNumberSample}
              onChange={(e: InputChangeEvent) => setForm((curr) => ({ ...curr, accountNumberSample: toText(e.value) }))}
            />
          </div>
          <Button themeColor="primary" onClick={() => void addBank()}>Add Bank</Button>
        </div>
      </DashboardCard>

      <DashboardCard title="Banks" subtitle="Listed/removed timeline and format details">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <Input
            placeholder="Search bank name"
            value={search}
            onChange={(e: InputChangeEvent) => setSearch(toText(e.value))}
            style={{ width: 280 }}
          />
          <select
            className="k-input k-input-md"
            style={{ height: 36, minWidth: 160 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as BankStatusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="removed">Removed only</option>
          </select>
        </div>

        {loading && <div style={{ color: 'var(--text-muted)' }}>Loading banks...</div>}
        {!loading && banks.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No banks available.</div>}

        {!loading && banks.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="budget-table" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Country</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th>Format Regex</th>
                  <th>Sample</th>
                  <th>Listed</th>
                  <th>Removed</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {banks.map((bank) => (
                  <tr key={bank.id}>
                    <td>
                      {editingId === bank.id ? (
                        <Input value={editForm.name} onChange={(e: InputChangeEvent) => setEditForm((curr) => ({ ...curr, name: toText(e.value) }))} />
                      ) : bank.name}
                    </td>
                    <td>
                      {editingId === bank.id ? (
                        <Input value={editForm.country} onChange={(e: InputChangeEvent) => setEditForm((curr) => ({ ...curr, country: toText(e.value) }))} />
                      ) : bank.country}
                    </td>
                    <td>
                      {editingId === bank.id ? (
                        <Input value={editForm.branchName} onChange={(e: InputChangeEvent) => setEditForm((curr) => ({ ...curr, branchName: toText(e.value) }))} />
                      ) : (bank.branchName || '-')}
                    </td>
                    <td>{bank.isActive ? 'Active' : 'Removed'}</td>
                    <td>
                      {editingId === bank.id ? (
                        <Input value={editForm.accountNumberPattern} onChange={(e: InputChangeEvent) => setEditForm((curr) => ({ ...curr, accountNumberPattern: toText(e.value) }))} />
                      ) : bank.accountNumberPattern}
                    </td>
                    <td>
                      {editingId === bank.id ? (
                        <Input value={editForm.accountNumberSample} onChange={(e: InputChangeEvent) => setEditForm((curr) => ({ ...curr, accountNumberSample: toText(e.value) }))} />
                      ) : bank.accountNumberSample}
                    </td>
                    <td>{toDateLabel(bank.listedAtUtc)} by {bank.listedBy}</td>
                    <td>{bank.removedAtUtc ? `${toDateLabel(bank.removedAtUtc)} by ${bank.removedBy ?? '-'}` : '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {editingId === bank.id ? (
                          <>
                            <Button themeColor="primary" onClick={() => void saveEdit(bank.id)}>Save</Button>
                            <Button onClick={() => setEditingId(null)}>Cancel</Button>
                          </>
                        ) : (
                          <Button onClick={() => startEdit(bank)}>Edit</Button>
                        )}

                        {bank.isActive ? (
                          <Button onClick={() => void removeBank(bank)}>Remove</Button>
                        ) : (
                          <Button onClick={() => void restoreBank(bank)}>Restore</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Showing page {page} of {totalPages} ({total} result(s))
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <Button disabled={page <= 1} onClick={() => void loadBanks(page - 1)}>Previous</Button>
              <Button disabled={page >= totalPages} onClick={() => void loadBanks(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </DashboardCard>
    </section>
  )
}
