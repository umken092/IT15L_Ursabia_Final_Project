import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { Input, type InputChangeEvent } from '@progress/kendo-react-inputs'
import type { ColumnDef } from '@tanstack/react-table'
import { DashboardCard } from '../../components/DashboardCard'
import { DataTable } from '../../components/ui/data-table'
import { customerService, type Customer } from '../../services/vendorCustomerService'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from '../../schemas/vendorCustomerSchemas'

interface CustomerFormData {
  customerCode: string
  name: string
  contactPerson: string
  email: string
  phoneNumber: string
  address: string
  city: string
  state: string
  postalCode: string
  country: string
  taxId: string
  creditLimit: string
  paymentTerms: string
  isActive: boolean
}

const defaultFormData: CustomerFormData = {
  customerCode: '',
  name: '',
  contactPerson: '',
  email: '',
  phoneNumber: '',
  address: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  taxId: '',
  creditLimit: '',
  paymentTerms: '',
  isActive: true,
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(value)

export function CustomersModule() {
  const { user } = useAuthStore()
  const push = useNotificationStore((state) => state.push)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CustomerFormData>(defaultFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [searchText, setSearchText] = useState('')

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true)
      const response = await customerService.getCustomers()
      setCustomers(response.data)
    } catch (error) {
      push('error', 'Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [push])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const filteredCustomers = searchText
    ? customers.filter(
        (c) =>
          c.customerCode.toLowerCase().includes(searchText.toLowerCase()) ||
          c.name.toLowerCase().includes(searchText.toLowerCase()),
      )
    : customers

  const customerColumns = useMemo<ColumnDef<Customer>[]>(
    () => [
      { accessorKey: 'customerCode', header: 'Code' },
      { accessorKey: 'name', header: 'Customer Name' },
      { accessorKey: 'contactPerson', header: 'Contact' },
      { accessorKey: 'city', header: 'City' },
      { accessorKey: 'country', header: 'Country' },
      {
        id: 'creditLimit',
        header: 'Credit Limit',
        cell: ({ row }) => formatCurrency(row.original.creditLimit),
      },
      {
        id: 'isActive',
        header: 'Active',
        cell: ({ row }) => (row.original.isActive ? 'Yes' : 'No'),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              icon="edit"
              onClick={() => handleEditClick(row.original)}
              style={{ marginRight: '8px' }}
            />
            <Button icon="delete" onClick={() => handleDeleteClick(row.original)} />
          </div>
        ),
      },
    ],
    [],
  )

  const handleAddClick = () => {
    setEditingId(null)
    setFormData(defaultFormData)
    setFormErrors({})
    setShowDialog(true)
  }

  const handleEditClick = (customer: Customer) => {
    setEditingId(customer.id)
    setFormData({
      customerCode: customer.customerCode,
      name: customer.name,
      contactPerson: customer.contactPerson || '',
      email: customer.email || '',
      phoneNumber: customer.phoneNumber || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      postalCode: customer.postalCode || '',
      country: customer.country || '',
      taxId: customer.taxId || '',
      creditLimit: customer.creditLimit.toString(),
      paymentTerms: customer.paymentTerms || '',
      isActive: customer.isActive,
    })
    setFormErrors({})
    setShowDialog(true)
  }

  const handleDeleteClick = async (customer: Customer) => {
    if (confirm(`Delete customer "${customer.name}"?`)) {
      try {
        await customerService.deleteCustomer(customer.id)
        push('success', 'Customer deleted successfully')
        await loadCustomers()
      } catch (error) {
        push('error', 'Failed to delete customer')
      }
    }
  }

  const handleFormChange = (e: InputChangeEvent | React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement
    const { name, value, type, checked } = target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    const submitData = {
      customerCode: formData.customerCode,
      name: formData.name,
      contactPerson: formData.contactPerson ? formData.contactPerson : undefined,
      email: formData.email ? formData.email : undefined,
      phoneNumber: formData.phoneNumber ? formData.phoneNumber : undefined,
      address: formData.address ? formData.address : undefined,
      city: formData.city ? formData.city : undefined,
      state: formData.state ? formData.state : undefined,
      postalCode: formData.postalCode ? formData.postalCode : undefined,
      country: formData.country ? formData.country : undefined,
      taxId: formData.taxId ? formData.taxId : undefined,
      creditLimit: parseFloat(formData.creditLimit) || 0,
      paymentTerms: formData.paymentTerms ? formData.paymentTerms : undefined,
      ...(editingId && { isActive: formData.isActive }),
    }

    const schema = editingId ? updateCustomerSchema : createCustomerSchema
    const result = schema.safeParse(submitData)

    if (!result.success) {
      result.error.issues.forEach((err: any) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message
        }
      })
      setFormErrors(errors)
      return false
    }

    return true
  }

  const handleSave = async () => {
    if (!validateForm()) {
      return
    }

    try {
      const baseData: CreateCustomerInput = {
        customerCode: formData.customerCode,
        name: formData.name,
        contactPerson: formData.contactPerson ? formData.contactPerson : undefined,
        email: formData.email ? formData.email : undefined,
        phoneNumber: formData.phoneNumber ? formData.phoneNumber : undefined,
        address: formData.address ? formData.address : undefined,
        city: formData.city ? formData.city : undefined,
        state: formData.state ? formData.state : undefined,
        postalCode: formData.postalCode ? formData.postalCode : undefined,
        country: formData.country ? formData.country : undefined,
        taxId: formData.taxId ? formData.taxId : undefined,
        creditLimit: parseFloat(formData.creditLimit) || 0,
        paymentTerms: formData.paymentTerms ? formData.paymentTerms : undefined,
      }

      if (editingId) {
        const updateData: UpdateCustomerInput = {
          ...baseData,
          isActive: formData.isActive,
        }
        await customerService.updateCustomer(editingId, updateData)
        push('success', 'Customer updated successfully')
      } else {
        await customerService.createCustomer(baseData)
        push('success', 'Customer created successfully')
      }

      setShowDialog(false)
      await loadCustomers()
    } catch (error) {
      push('error', editingId ? 'Failed to update customer' : 'Failed to create customer')
    }
  }

  const handleDialogClose = () => {
    setShowDialog(false)
    setFormErrors({})
  }

  return (
    <div className="space-y-4 p-4">
      <DashboardCard
        title="Customer Management"
        subtitle="Create, update, and manage customer master data for accounts receivable"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Input
              placeholder="Search by code or name..."
              value={searchText}
              onChange={(e: InputChangeEvent) => setSearchText((e.target.value as string) || '')}
              style={{ width: '300px' }}
            />
            <Button
              themeColor="primary"
              onClick={handleAddClick}
              disabled={!user || !['accountant', 'cfo', 'super-admin'].includes(user.role)}
            >
              + Add Customer
            </Button>
          </div>

          {loading && <div style={{ marginBottom: '12px', color: 'var(--text-muted)' }}>Loading customers...</div>}

          <DataTable data={filteredCustomers} columns={customerColumns} pageSizeOptions={[20, 50, 100]} />
        </div>
      </DashboardCard>

      {showDialog && (
        <Dialog title={editingId ? 'Edit Customer' : 'Add Customer'} onClose={handleDialogClose}>
          <div className="space-y-4 p-4" style={{ minWidth: '500px' }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Customer Code*</label>
                <Input
                  name="customerCode"
                  value={formData.customerCode}
                  onChange={handleFormChange}
                  disabled={editingId !== null}
                  className={formErrors.customerCode ? 'error' : ''}
                />
                {formErrors.customerCode && <p className="text-red-500 text-xs">{formErrors.customerCode}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Customer Name*</label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  className={formErrors.name ? 'error' : ''}
                />
                {formErrors.name && <p className="text-red-500 text-xs">{formErrors.name}</p>}
              </div>
            </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Contact Person</label>
              <Input name="contactPerson" value={formData.contactPerson} onChange={handleFormChange} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input name="email" value={formData.email} onChange={handleFormChange} type="email" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <Input name="phoneNumber" value={formData.phoneNumber} onChange={handleFormChange} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tax ID</label>
              <Input name="taxId" value={formData.taxId} onChange={handleFormChange} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <Input name="address" value={formData.address} onChange={handleFormChange} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <Input name="city" value={formData.city} onChange={handleFormChange} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">State</label>
              <Input name="state" value={formData.state} onChange={handleFormChange} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Postal Code</label>
              <Input name="postalCode" value={formData.postalCode} onChange={handleFormChange} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <Input name="country" value={formData.country} onChange={handleFormChange} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Credit Limit</label>
              <Input
                name="creditLimit"
                value={formData.creditLimit}
                onChange={handleFormChange}
                type="number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Terms</label>
              <Input name="paymentTerms" value={formData.paymentTerms} onChange={handleFormChange} />
            </div>
          </div>

            {editingId && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleFormChange}
                />
                <span className="text-sm font-medium">Active</span>
              </label>
            )}
          </div>

          <DialogActionsBar>
            <Button onClick={handleDialogClose}>Cancel</Button>
            <Button themeColor="primary" onClick={handleSave}>
              Save
            </Button>
          </DialogActionsBar>
        </Dialog>
      )}
    </div>
  )
}
