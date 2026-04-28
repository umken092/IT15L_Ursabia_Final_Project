import { Card, CardBody, CardHeader, CardTitle } from '@progress/kendo-react-layout'
import type { ReactNode } from 'react'

interface DashboardCardProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export const DashboardCard = ({
  title,
  subtitle,
  children,
}: DashboardCardProps) => {
  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  )
}
