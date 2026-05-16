import { formatCurrency } from '../../utils/formatters'

/**
 * Summary cards showing total spent, items bought vs planned.
 */
export default function SummaryCards({ totalSpent, totalPlanned, itemsBought, totalItems }) {
  const purchaseRate = totalItems > 0 ? Math.round((itemsBought / totalItems) * 100) : 0

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Total Spent */}
      <div className="p-3 bg-green-50 rounded-xl border border-green-100">
        <p className="text-[10px] font-medium text-green-600 uppercase tracking-wide">Total Spent</p>
        <p className="mt-1 text-lg font-bold text-green-800">{formatCurrency(totalSpent)}</p>
        <p className="mt-0.5 text-[10px] text-green-600">
          of {formatCurrency(totalPlanned)} planned
        </p>
      </div>

      {/* Items Bought */}
      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
        <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wide">Items Bought</p>
        <p className="mt-1 text-lg font-bold text-blue-800">
          {itemsBought} <span className="text-sm font-normal text-blue-600">/ {totalItems}</span>
        </p>
        <p className="mt-0.5 text-[10px] text-blue-600">
          {purchaseRate}% purchased
        </p>
      </div>
    </div>
  )
}
