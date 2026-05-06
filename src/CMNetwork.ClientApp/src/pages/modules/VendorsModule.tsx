import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@progress/kendo-react-buttons'
import { Dialog, DialogActionsBar } from '@progress/kendo-react-dialogs'
import { Input, type InputChangeEvent } from '@progress/kendo-react-inputs'
import type { ColumnDef } from '@tanstack/react-table'
import { DashboardCard } from '../../components/DashboardCard'
import { DataTable } from '../../components/ui/data-table'
import { vendorService, type Vendor } from '../../services/vendorCustomerService'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import {
  createVendorSchema,
  updateVendorSchema,
  type CreateVendorInput,
  type UpdateVendorInput,
} from '../../schemas/vendorCustomerSchemas'

interface VendorFormData {
  vendorCode: string
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

const defaultFormData: VendorFormData = {
  vendorCode: '',
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

export function VendorsModule() {
  const { user } = useAuthStore()
  const push = useNotificationStore((state) => state.push)

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<VendorFormData>(defaultFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [searchText, setSearchText] = useState('')

  const loadVendors = useCallback(async () => {
    try {
      setLoading(true)
      const response = await vendorService.getVendors()
      setVendors(response.data)
    } catch (error) {
      push('error', 'Failed to load vendors')
    } finally {
      setLoading(false)
    }
  }, [push])

  useEffect(() => {
    loadVendors()
  }, [loadVendors])

  const filteredVendors = searchText
    ? vendors.filter(
        (v) =>
          v.vendorCode.toLowerCase().includes(searchText.toLowerCase()) ||
          v.name.toLowerCase().includes(searchText.toLowerCase()),
      )
    : vendors

  const vendorColumns = useMemo<ColumnDef<Vendor>[]>(
    () => [
      { accessorKey: 'vendorCode', header: 'Code' },
      { accessorKey: 'name', header: 'Vendor Name' },
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

  const handleEditClick = (vendor: Vendor) => {
    setEditingId(vendor.id)
    setFormData({
      vendorCode: vendor.vendorCode,
      name: vendor.name,
      contactPerson: vendor.contactPerson || '',
      email: vendor.email || '',
      phoneNumber: vendor.phoneNumber || '',
      address: vendor.address || '',
      city: vendor.city || '',
      state: vendor.state || '',
      postalCode: vendor.postalCode || '',
      country: vendor.country || '',
      taxId: vendor.taxId || '',
      creditLimit: vendor.creditLimit.toString(),
      paymentTerms: vendor.paymentTerms || '',
      isActive: vendor.isActive,
    })
    setFormErrors({})
    setShowDialog(true)
  }

  const handleDeleteClick = async (vendor: Vendor) => {
    if (confirm(`Delete vendor "${vendor.name}"?`)) {
      try {
        await vendorService.deleteVendor(vendor.id)
        push('success', 'Vendor deleted successfully')
        await loadVendors()
      } catch (error) {
        push('error', 'Failed to delete vendor')
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
      vendorCode: formData.vendorCode,
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

    const schema = editingId ? updateVendorSchema : createVendorSchema
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
      const baseData: CreateVendorInput = {
        vendorCode: formData.vendorCode,
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
        const updateData: UpdateVendorInput = {
          ...baseData,
          isActive: formData.isActive,
        }
        await vendorService.updateVendor(editingId, updateData)
        push('success', 'Vendor updated successfully')
      } else {
        await vendorService.createVendor(baseData)
        push('success', 'Vendor created successfully')
      }

      setShowDialog(false)
      await loadVendors()
    } catch (error) {
      push('error', editingId ? 'Failed to update vendor' : 'Failed to create vendor')
    }
  }

  const handleDialogClose = () => {
    setShowDialog(false)
    setFormErrors({})
  }

  return (
    <div className="space-y-4 p-4">
      <DashboardCard
        title="Vendor Management"
        subtitle="Create, update, and manage vendor master data for accounts payable"
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
              + Add Vendor
            </Button>
          </div>

          {loading && <div style={{ marginBottom: '12px', color: 'var(--text-muted)' }}>Loading vendors...</div>}

          <DataTable data={filteredVendors} columns={vendorColumns} pageSizeOptions={[20, 50, 100]} />
        </div>
      </DashboardCard>

      {showDialog && (
        <Dialog title={editingId ? 'Edit Vendor' : 'Add Vendor'} onClose={handleDialogClose}>
          <div className="space-y-4 p-4" style={{ minWidth: '500px' }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Vendor Code*</label>
                <Input
                  name="vendorCode"
                  value={formData.vendorCode}
                  onChange={handleFormChange}
                  disabled={editingId !== null}
                  className={formErrors.vendorCode ? 'error' : ''}
                />
                {formErrors.vendorCode && <p className="text-red-500 text-xs">{formErrors.vendorCode}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vendor Name*</label>
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
