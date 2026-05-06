import { Card, CardBody, CardHeader, CardTitle } from '@progress/kendo-react-layout'
import type { ReactNode } from 'react'

interface DashboardCardProps {
  title: string
  subtitle?: string
  className?: string
  children: ReactNode
}

export const DashboardCard = ({
  title,
  subtitle,
  className,
  children,
}: DashboardCardProps) => {
  return (
    <Card className={`dashboard-card ${className ?? ''}`.trim()}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  )
}
