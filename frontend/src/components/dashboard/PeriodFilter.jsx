/**
 * Period filter with Year, Month, and Week dropdowns.
 * Selecting a more specific filter (month/week) narrows the data.
 * "All" option available in each dropdown to widen the view.
 */
export default function PeriodFilter({ year, month, week, years, months, weeks, onYearChange, onMonthChange, onWeekChange }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {/* Year dropdown */}
        <select
          value={year}
          onChange={(e) => onYearChange(e.target.value)}
          className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          aria-label="Filter by year"
        >
          <option value="all">All Years</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Month dropdown */}
        <select
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          aria-label="Filter by month"
        >
          <option value="all">All Months</option>
          {months.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        {/* Week dropdown */}
        <select
          value={week}
          onChange={(e) => onWeekChange(e.target.value)}
          className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          aria-label="Filter by week"
        >
          <option value="all">All Weeks</option>
          {weeks.map((w) => (
            <option key={w} value={w}>{formatWeekLabel(w)}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function formatWeekLabel(weekOf) {
  const [y, m, d] = weekOf.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
