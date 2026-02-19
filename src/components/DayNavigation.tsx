interface DayNavigationProps {
  viewDate: Date
  viewMode: '1-day' | '3-day'
  onDateChange: (date: Date) => void
  onViewModeChange: (mode: '1-day' | '3-day') => void
}

function formatDateLabel(date: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)

  const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function DayNavigation({ viewDate, viewMode, onDateChange, onViewModeChange }: DayNavigationProps) {
  const isToday = (() => {
    const today = new Date()
    return viewDate.toDateString() === today.toDateString()
  })()

  function navigate(delta: number) {
    const newDate = new Date(viewDate)
    newDate.setDate(newDate.getDate() + delta)
    onDateChange(newDate)
  }

  function goToToday() {
    onDateChange(new Date())
  }

  const dayLabel = viewDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Navigation arrows */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-[#888] hover:text-white transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => navigate(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-[#888] hover:text-white transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div>
          <h2 className="text-base font-semibold text-white">{formatDateLabel(viewDate)}</h2>
          <p className="text-xs text-[#666]">{dayLabel}</p>
        </div>

        {!isToday && (
          <button
            onClick={goToToday}
            className="px-3 py-1 text-xs font-medium text-[#FF3300] border border-[#FF3300]/30 rounded-lg hover:bg-[#FF3300]/10 transition-all cursor-pointer"
          >
            Today
          </button>
        )}
      </div>

      {/* View mode toggle */}
      <div className="flex items-center gap-1 bg-[#111] rounded-lg p-0.5 border border-[#222]">
        <button
          onClick={() => onViewModeChange('1-day')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
            viewMode === '1-day'
              ? 'bg-[#222] text-white'
              : 'text-[#666] hover:text-[#888]'
          }`}
        >
          1 Day
        </button>
        <button
          onClick={() => onViewModeChange('3-day')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
            viewMode === '3-day'
              ? 'bg-[#222] text-white'
              : 'text-[#666] hover:text-[#888]'
          }`}
        >
          3 Day
        </button>
      </div>
    </div>
  )
}
