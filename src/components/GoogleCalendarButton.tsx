import { useAuth } from '../contexts/AuthContext'

export default function GoogleCalendarButton() {
  const { user, googleToken, signOut } = useAuth()

  if (!user) return null

  return (
    <div className="flex items-center gap-3">
      {googleToken && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FF3300]/10 border border-[#FF3300]/20">
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF3300]" />
          <span className="text-[10px] font-medium text-[#FF3300]">Calendar synced</span>
        </div>
      )}

      <button
        onClick={signOut}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#222] text-[#888] hover:text-white hover:border-[#444] transition-all cursor-pointer"
      >
        {user.user_metadata?.avatar_url && (
          <img
            src={user.user_metadata.avatar_url}
            alt=""
            className="w-5 h-5 rounded-full"
          />
        )}
        <span className="text-xs font-medium">Sign out</span>
      </button>
    </div>
  )
}
