import { formatCurrency } from '../../utils/formatters'

/**
 * Naira-formatted currency display component.
 * @param {object} props
 * @param {number} props.amount - The amount to display
 * @param {boolean} props.showDecimal - Whether to show decimal places
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.size - 'sm' | 'md' | 'lg'
 */
export default function CurrencyDisplay({
  amount,
  showDecimal = false,
  className = '',
  size = 'md',
}) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl font-semibold',
  }

  return (
    <span className={`font-mono ${sizeClasses[size]} ${className}`}>
      {formatCurrency(amount, showDecimal)}
    </span>
  )
}
