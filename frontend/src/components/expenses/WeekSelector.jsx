import { useState, useMemo } from 'react'
import { formatWeekDate, toISODate, getWeekStart } from '../../utils/dateUtils'
import CurrencyDisplay from '../common/CurrencyDisplay'

/**
 * Week header with greeting, navigation arrows, and tappable date for week picker.
 */
export default function WeekSelector({
  weekStart,
  weeklyTotal = 0,
  itemCount = 0,
  userName = '',
  userAvatar = '',
  userRole = '',
  isCurrentWeek = true,
  onPrevWeek,
  onNextWeek,
  onWeekSelect,
}) {
  const [showPicker, setShowPicker] = useState(false)
  const firstName = userName ? userName.split(' ')[0] : ''

  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
      <div className="max-w-lg mx-auto space-y-2">
        {/* Row 1: Greeting + total */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {userAvatar ? (
              <img src={userAvatar} alt={userName} className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : firstName ? (
              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-xs font-medium text-green-700">{firstName.charAt(0).toUpperCase()}</span>
              </div>
            ) : null}
            <p className="text-sm text-gray-700">Hi, <span className="font-medium">{firstName}</span> 👋</p>
            {userRole && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600 capitalize">{userRole}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <CurrencyDisplay amount={weeklyTotal} size="sm" className="text-green-700 font-semibold" />
            {itemCount > 0 && <span className="text-[10px] text-gray-400">({itemCount})</span>}
          </div>
        </div>

        {/* Row 2: Week navigation */}
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={onPrevWeek} className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200" aria-label="Previous week">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="text-sm font-semibold text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            {formatWeekDate(weekStart)} ▾
          </button>

          <button
            type="button"
            onClick={onNextWeek}
            disabled={isCurrentWeek}
            className={`p-2 rounded-full transition-colors ${isCurrentWeek ? 'text-gray-200 cursor-not-allowed' : 'hover:bg-gray-100 active:bg-gray-200 text-gray-600'}`}
            aria-label="Next week"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Week picker with backdrop to close on outside click */}
        {showPicker && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowPicker(false)} />
            <div className="relative z-40">
              <WeekPicker
                currentWeekOf={toISODate(weekStart)}
                onSelect={(dateStr) => { onWeekSelect(dateStr); setShowPicker(false) }}
                onClose={() => setShowPicker(false)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Scrollable list of all Sundays from May 2024 to current week.
 */
function WeekPicker({ currentWeekOf, onSelect, onClose }) {
  const sundays = useMemo(() => {
    const weeks = []
    const start = new Date(2024, 4, 26) // May 26, 2024 (first Sunday in data)
    const end = getWeekStart(new Date())

    let d = new Date(end)
    while (d >= start) {
      weeks.push(toISODate(d))
      d = new Date(d)
      d.setDate(d.getDate() - 7)
    }
    return weeks // most recent first
  }, [])

  return (
    <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[250px] overflow-y-auto">
      {sundays.map((weekOf) => {
        const isActive = weekOf === currentWeekOf
        const [y, m, day] = weekOf.split('-').map(Number)
        const date = new Date(y, m - 1, day)
        const label = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

        return (
          <button
            key={weekOf}
            type="button"
            onClick={() => onSelect(weekOf)}
            className={`w-full px-4 py-2.5 text-left text-sm border-b border-gray-50 transition-colors ${
              isActive ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
