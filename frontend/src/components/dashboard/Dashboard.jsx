import { useState, useMemo, Component, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getExpensesByRange } from '../../api/expenses'
import { getWeeks } from '../../api/weeks'
import { getWeekStart, toISODate } from '../../utils/dateUtils'
import { calculateCategoryBreakdown, calculatePurchasedTotal } from '../../utils/calculations'
import { formatCurrency } from '../../utils/formatters'
import { generateCSV, downloadCSV } from '../../utils/csv'
import PeriodFilter from './PeriodFilter'
import SummaryCards from './SummaryCards'
import CategoryBreakdown from './CategoryBreakdown'

/**
 * Error boundary that auto-retries up to 3 times.
 */
class DashboardErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, retries: 0 }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.hasError && this.state.retries < 3) {
      setTimeout(() => {
        this.setState(s => ({ hasError: false, retries: s.retries + 1 }))
      }, 100 * (this.state.retries + 1))
    }
  }
  render() {
    if (this.state.hasError) {
      if (this.state.retries >= 3) {
        return (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-600">Loading dashboard...</p>
            <button
              onClick={() => this.setState({ hasError: false, retries: 0 })}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg"
            >
              Load Dashboard
            </button>
          </div>
        )
      }
      return (
        <div className="px-4 py-8 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * Main dashboard export.
 * Fetches data at this level, only renders content when data is ready.
 */
export default function Dashboard() {
  const [today] = useState(() => toISODate(new Date()))

  const { data: expensesData, isLoading } = useQuery({
    queryKey: ['expenses-range', '2024-01-01', today],
    queryFn: () => getExpensesByRange('2024-01-01', today),
    enabled: !!import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== 'http://localhost:5173/api',
  })

  const allExpenses = useMemo(() => {
    if (!expensesData) return []
    if (Array.isArray(expensesData)) return expensesData
    if (expensesData.entries) return expensesData.entries
    return []
  }, [expensesData])

  if (isLoading || allExpenses.length === 0) {
    return (
      <div className="px-4 py-4 space-y-5">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Spending overview and analytics</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return <DashboardContent allExpenses={allExpenses} />
}

/**
 * Main dashboard view with year/month/week filters, summary cards, trend, and breakdown.
 */
function DashboardContent({ allExpenses }) {
  const [selectedYear, setSelectedYear] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [selectedWeek, setSelectedWeek] = useState('all')

  // Extract available years from data
  const availableYears = useMemo(() => {
    const years = new Set(allExpenses.map((e) => e.weekOf?.slice(0, 4)).filter(Boolean))
    return [...years].sort().reverse()
  }, [allExpenses])

  // Extract available months for selected year
  const availableMonths = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    let filtered = allExpenses
    if (selectedYear !== 'all') {
      filtered = filtered.filter((e) => e.weekOf?.startsWith(selectedYear))
    }
    const months = new Set(filtered.map((e) => e.weekOf?.slice(5, 7)).filter(Boolean))
    return [...months].sort().map((m) => ({ value: m, label: monthNames[parseInt(m, 10) - 1] }))
  }, [allExpenses, selectedYear])

  // Extract available weeks for selected year+month
  const availableWeeks = useMemo(() => {
    let filtered = allExpenses
    if (selectedYear !== 'all') {
      filtered = filtered.filter((e) => e.weekOf?.startsWith(selectedYear))
    }
    if (selectedMonth !== 'all') {
      filtered = filtered.filter((e) => e.weekOf?.slice(5, 7) === selectedMonth)
    }
    const weeks = new Set(filtered.map((e) => e.weekOf).filter(Boolean))
    return [...weeks].sort()
  }, [allExpenses, selectedYear, selectedMonth])

  // Filter expenses based on selections
  // Reset month/week if they're no longer valid for the current year
  const validMonth = selectedMonth === 'all' || availableMonths.some(m => m.value === selectedMonth) ? selectedMonth : 'all'
  const validWeek = selectedWeek === 'all' || availableWeeks.includes(selectedWeek) ? selectedWeek : 'all'

  const expenses = useMemo(() => {
    let filtered = allExpenses
    if (selectedYear !== 'all') {
      filtered = filtered.filter((e) => e.weekOf?.startsWith(selectedYear))
    }
    if (validMonth !== 'all') {
      filtered = filtered.filter((e) => e.weekOf?.slice(5, 7) === validMonth)
    }
    if (validWeek !== 'all') {
      filtered = filtered.filter((e) => e.weekOf === validWeek)
    }
    return filtered
  }, [allExpenses, selectedYear, validMonth, validWeek])

  // Reset cascading filters
  function handleYearChange(val) {
    setSelectedYear(val)
    setSelectedMonth('all')
    setSelectedWeek('all')
  }
  function handleMonthChange(val) {
    setSelectedMonth(val)
    setSelectedWeek('all')
  }
  function handleWeekChange(val) {
    setSelectedWeek(val)
  }

  // Calculate stats
  const breakdown = useMemo(() => calculateCategoryBreakdown(expenses), [expenses])
  const totalSpent = useMemo(() => calculatePurchasedTotal(expenses), [expenses])
  const totalPlanned = useMemo(
    () => expenses.reduce((sum, e) => sum + (e.price || 0), 0),
    [expenses]
  )
  const itemsBought = useMemo(
    () => expenses.filter((e) => e.purchased).length,
    [expenses]
  )

  return (
    <div className="px-4 py-4 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
        <p className="text-xs text-gray-500 mt-0.5">Spending overview and analytics</p>
      </div>

      {/* Period filter — year / month / week dropdowns */}
      <PeriodFilter
        year={selectedYear}
        month={validMonth}
        week={validWeek}
        years={availableYears}
        months={availableMonths}
        weeks={availableWeeks}
        onYearChange={handleYearChange}
        onMonthChange={handleMonthChange}
        onWeekChange={handleWeekChange}
      />

      {/* Dashboard content */}
      {expenses.length > 0 && (
        <>
          {/* Summary cards */}
          <SummaryCards
            totalSpent={totalSpent}
            totalPlanned={totalPlanned}
            itemsBought={itemsBought}
            totalItems={expenses.length}
          />

          {/* Category breakdown */}
          <CategoryBreakdown breakdown={breakdown} totalSpent={totalPlanned} />

          {/* Weekly spending trend */}
          {expenses.length > 0 && <WeeklyTrend expenses={expenses} key="trend" />}

          {/* CSV Export */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                const csv = generateCSV(expenses)
                const label = selectedWeek !== 'all' ? selectedWeek : selectedMonth !== 'all' ? `${selectedYear}-${selectedMonth}` : selectedYear !== 'all' ? selectedYear : 'all'
                const filename = `expenses_${label}.csv`
                downloadCSV(csv, filename)
              }}
              className="w-full py-2.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 active:bg-green-200 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>
        </>
      )}

      {/* Historical weeks table */}
      <WeeksHistory expenses={expenses} />
    </div>
  )
}

/**
 * Weekly spending trend — line chart showing total and category trends over time.
 * Tap category chips to filter/slice the view.
 */
function WeeklyTrend({ expenses }) {
  const [activeCategories, setActiveCategories] = useState(new Set(['Total']))

  const weeklyData = useMemo(() => {
    if (!expenses || expenses.length === 0) return []
    const groups = {}
    for (const e of expenses) {
      if (!e.weekOf) continue
      if (!groups[e.weekOf]) groups[e.weekOf] = { total: 0, categories: {} }
      groups[e.weekOf].total += (e.price || 0)
      const cat = e.category || 'Others'
      groups[e.weekOf].categories[cat] = (groups[e.weekOf].categories[cat] || 0) + (e.price || 0)
    }
    return Object.entries(groups)
      .map(([weekOf, data]) => ({ weekOf, ...data }))
      .sort((a, b) => a.weekOf.localeCompare(b.weekOf))
  }, [expenses])

  // Show all weeks in chart (no limit)
  const chartData = weeklyData

  const allCategories = useMemo(() => {
    if (!expenses || expenses.length === 0) return ['Total']
    const cats = new Set(expenses.map(e => e.category || 'Others'))
    return ['Total', ...Array.from(cats).sort()]
  }, [expenses])

  // Dynamic color palette — assign colors to categories
  const catColors = useMemo(() => {
    const palette = ['#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308', '#ef4444', '#6366f1', '#84cc16', '#f43f5e']
    const colors = { 'Total': '#1a7f37' }
    const cats = allCategories.filter(c => c !== 'Total')
    cats.forEach((cat, i) => {
      colors[cat] = palette[i % palette.length]
    })
    return colors
  }, [allCategories])

  const catLabels = useMemo(() => {
    const labels = { 'Total': 'Total' }
    allCategories.forEach(cat => {
      if (cat !== 'Total') {
        labels[cat] = cat.replace("'s Drugs & Hosp. Exp", "").replace("Mom", "Mom").replace("Dad", "Dad")
      }
    })
    return labels
  }, [allCategories])

  // Early return AFTER all hooks are called
  if (chartData.length < 2) return null

  function toggleCategory(cat) {
    const next = new Set(activeCategories)
    if (next.has(cat)) {
      if (next.size > 1) next.delete(cat)
    } else {
      next.add(cat)
    }
    setActiveCategories(next)
  }

  // Compute chart dimensions
  const width = 320
  const height = 160
  const padding = { top: 10, right: 10, bottom: 20, left: 45 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  // Get max value across active categories
  let maxVal = 0
  for (const week of chartData) {
    for (const cat of activeCategories) {
      const val = cat === 'Total' ? week.total : (week.categories[cat] || 0)
      if (val > maxVal) maxVal = val
    }
  }
  if (maxVal === 0) maxVal = 1

  // Build line paths
  function getPoints(cat) {
    return chartData.map((week, i) => {
      const val = cat === 'Total' ? week.total : (week.categories[cat] || 0)
      const divisor = chartData.length > 1 ? chartData.length - 1 : 1
      const x = padding.left + (i / divisor) * chartW
      const y = padding.top + chartH - (val / maxVal) * chartH
      return { x, y, val }
    })
  }

  function pointsToPath(points) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  }

  // Y-axis labels
  const yLabels = [0, Math.round(maxVal / 2), Math.round(maxVal)]

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Spending Trend</h3>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {allCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => toggleCategory(cat)}
            className={`px-2 py-1 text-[10px] font-medium rounded-full border transition-colors ${
              activeCategories.has(cat)
                ? 'border-transparent text-white'
                : 'border-gray-200 text-gray-500 bg-white'
            }`}
            style={activeCategories.has(cat) ? { backgroundColor: catColors[cat] } : {}}
          >
            {catLabels[cat]}
          </button>
        ))}
      </div>

      {/* SVG Line Chart */}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
        {/* Y-axis grid lines */}
        {yLabels.map((val) => {
          const y = padding.top + chartH - (val / maxVal) * chartH
          return (
            <g key={val}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
              <text x={padding.left - 4} y={y + 3} textAnchor="end" className="text-[8px] fill-gray-400">
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
              </text>
            </g>
          )
        })}

        {/* X-axis labels (first, middle, last) */}
        {[0, Math.floor(chartData.length / 2), chartData.length - 1].map((i) => {
          if (i < 0 || i >= chartData.length) return null
          const divisor = chartData.length > 1 ? chartData.length - 1 : 1
          const x = padding.left + (i / divisor) * chartW
          const label = chartData[i].weekOf.slice(5) // MM-DD
          return (
            <text key={i} x={x} y={height - 4} textAnchor="middle" className="text-[8px] fill-gray-400">
              {label}
            </text>
          )
        })}

        {/* Lines */}
        {[...activeCategories].map((cat) => {
          const points = getPoints(cat)
          return (
            <path
              key={cat}
              d={pointsToPath(points)}
              fill="none"
              stroke={catColors[cat]}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        })}

        {/* Dots on every point */}
        {[...activeCategories].map((cat) => {
          const points = getPoints(cat)
          return points.map((p, i) => (
            <circle key={`${cat}-${i}`} cx={p.x} cy={p.y} r="2.5" fill={catColors[cat]} />
          ))
        })}
      </svg>

      {/* Summary */}
      <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-500">
        <span>{chartData.length} weeks</span>
        <span>Avg: {formatCurrency(chartData.reduce((s, w) => s + w.total, 0) / chartData.length)}/week</span>
      </div>
    </div>
  )
}

/**
 * Get a display label for a week's computed status.
 */
function getWeekStatusLabel(week) {
  if (week.approvedCount > 0 && week.approvedCount === week.totalItems) return 'Approved'
  if (week.submittedCount > 0) return 'Pending'
  if (week.draftCount > 0) return 'Draft'
  if (week.approvedCount > 0) return 'Approved'
  return 'Approved' // imported data defaults to approved
}

function getWeekStatusColor(week) {
  const label = getWeekStatusLabel(week)
  if (label === 'Approved') return 'text-green-600'
  if (label === 'Pending') return 'text-orange-600'
  return 'text-gray-500'
}

/**
 * Table showing historical weeks — derived from filtered expenses.
 */
function WeeksHistory({ expenses = [] }) {
  const [expandedWeek, setExpandedWeek] = useState(null)

  // Group expenses by weekOf to build week summaries
  const weeks = useMemo(() => {
    const groups = {}
    for (const e of expenses) {
      if (!groups[e.weekOf]) groups[e.weekOf] = { weekOf: e.weekOf, totalSpent: 0, totalItems: 0, draftCount: 0, submittedCount: 0, approvedCount: 0, items: [] }
      groups[e.weekOf].totalSpent += e.price || 0
      groups[e.weekOf].totalItems += 1
      groups[e.weekOf].items.push(e)
      const status = e.status || 'draft'
      if (status === 'draft') groups[e.weekOf].draftCount++
      else if (status === 'submitted') groups[e.weekOf].submittedCount++
      else if (status === 'approved') groups[e.weekOf].approvedCount++
    }
    return Object.values(groups).sort((a, b) => b.weekOf.localeCompare(a.weekOf))
  }, [expenses])

  if (weeks.length === 0) return null

  // Get items for expanded week sorted by price
  const expandedItems = useMemo(() => {
    if (!expandedWeek) return []
    const week = weeks.find(w => w.weekOf === expandedWeek)
    return (week?.items || []).sort((a, b) => (b.price || 0) - (a.price || 0))
  }, [expandedWeek, weeks])

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-gray-900 mb-1">Weekly History</h3>
      <p className="text-[10px] text-gray-400 mb-3">Tap a week to see items</p>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-medium text-gray-600">Week</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Total</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Items</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {weeks.map((week) => (
              <WeekRow
                key={week.weekOf}
                week={week}
                isExpanded={expandedWeek === week.weekOf}
                onToggle={() => setExpandedWeek(expandedWeek === week.weekOf ? null : week.weekOf)}
                items={expandedWeek === week.weekOf ? expandedItems : []}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function WeekRow({ week, isExpanded, onToggle, items }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer active:bg-gray-50 ${isExpanded ? 'bg-green-50' : ''}`}
      >
        <td className="px-3 py-2.5 text-gray-900">
          {isExpanded ? '▾' : '▸'} {formatWeekShort(week.weekOf)}
        </td>
        <td className="px-3 py-2.5 text-right font-mono text-gray-900">{formatCurrency(week.totalSpent || 0)}</td>
        <td className="px-3 py-2.5 text-right text-gray-500">{week.totalItems || 0}</td>
        <td className={`px-3 py-2.5 text-right font-medium capitalize ${getWeekStatusColor(week)}`}>
          {getWeekStatusLabel(week)}
        </td>
      </tr>
      {isExpanded && items.length > 0 && (
        <tr>
          <td colSpan={4} className="px-0 py-0">
            <div className="bg-gray-50 px-4 py-2 max-h-[300px] overflow-y-auto">
              {items.map((item, idx) => (
                <div key={item.entryId || idx} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[10px] text-gray-400 w-5 flex-shrink-0">{idx + 1}.</span>
                    <span className="text-xs text-gray-800 truncate">{item.item}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 px-1 py-0.5 bg-gray-100 rounded">
                      {item.category?.replace("'s Drugs & Hosp. Exp", "")}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-gray-700 flex-shrink-0 ml-2">
                    {formatCurrency(item.price || 0)}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
      {isExpanded && items.length === 0 && (
        <tr>
          <td colSpan={4} className="px-4 py-3 text-center text-xs text-gray-400">
            Loading...
          </td>
        </tr>
      )}
    </>
  )
}

/**
 * Format weekOf date string to short format: "10 May 2026"
 */
function formatWeekShort(weekOf) {
  if (!weekOf) return ''
  const [year, month, day] = weekOf.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
