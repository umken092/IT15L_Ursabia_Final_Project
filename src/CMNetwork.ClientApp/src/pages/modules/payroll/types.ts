export type PayrollRunStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Processed' | 'Posted'

export interface PayPeriodDto {
  id: string
  year: number
  month: number
  frequency: number
  cutoffDate: string
  payDate: string
  status: number
}

export interface EmployeePayrollDto {
  id: string
  name: string
  department: string
  hourlyRate: number
  overtimeMultiplier: number
}

export interface PayrollLineInput {
  employeeId: string
  employeeName: string
  regularHours: number
  overtimeHours: number
  absenceHours: number
  otherDeductions: number
}

export interface PayrollRunDto {
  id: string
  payPeriodId: string
  payPeriodLabel: string
  status: number
  totalGrossPay: number
  totalNetPay: number
  totalDeductions: number
  submittedAtUtc?: string
  approvedAtUtc?: string
}

export interface PayrollRegisterLine {
  employeeId: string
  employeeName: string
  grossPay: number
  trainTax: number
  sssFee: number
  philHealthFee: number
  pagIbigFee: number
  otherDeductions: number
  totalDeductions: number
  netPay: number
}

export interface PayrollRegisterDto {
  payrollRunId: string
  payPeriod: string
  status: number
  lineItems: PayrollRegisterLine[]
  totals: {
    totalGrossPay: number
    totalTrainTax: number
    totalSssFee: number
    totalPhilHealthFee: number
    totalPagIbigFee: number
    totalOtherDeductions: number
    totalDeductions: number
    totalNetPay: number
  }
}

export interface PayslipSummaryDto {
  id: string
  payslipNumber: string
  payPeriod: string
  periodStart: string
  periodEnd: string
  grossPay: number
  netPay: number
  generatedAtUtc: string
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

export const periodStatusLabel = (status: number): 'Open' | 'Closed' =>
  status === 2 ? 'Closed' : 'Open'

export const runStatusLabel = (status: number): PayrollRunStatus => {
  switch (status) {
    case 2:
      return 'Submitted'
    case 3:
      return 'Approved'
    case 4:
      return 'Rejected'
    case 5:
      return 'Processed'
    case 6:
      return 'Posted'
    default:
      return 'Draft'
  }
}