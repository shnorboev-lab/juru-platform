import { clsx } from 'clsx'

type Color = 'green' | 'blue' | 'yellow' | 'orange' | 'red' | 'gray' | 'purple'

interface BadgeProps {
  color?: Color
  children: React.ReactNode
  className?: string
}

const colorMap: Record<Color, string> = {
  green:  'bg-green-100 text-green-800',
  blue:   'bg-blue-100 text-blue-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  orange: 'bg-orange-100 text-orange-800',
  red:    'bg-red-100 text-red-800',
  gray:   'bg-gray-100 text-gray-700',
  purple: 'bg-purple-100 text-purple-800',
}

export function Badge({ color = 'gray', children, className }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', colorMap[color], className)}>
      {children}
    </span>
  )
}

export function performanceBadge(label: string) {
  const map: Record<string, Color> = {
    EXCEPTIONAL:          'green',
    EXCEEDS_EXPECTATIONS: 'blue',
    MEETS_EXPECTATIONS:   'yellow',
    PARTIALLY_MEETS:      'orange',
    BELOW_EXPECTATIONS:   'red',
  }
  const color = map[label] ?? 'gray'
  const text  = label.replace(/_/g, ' ')
  return <Badge color={color}>{text}</Badge>
}
