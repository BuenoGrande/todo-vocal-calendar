import { useAuth } from '../contexts/AuthContext'

export default function GoogleCalendarButton() {
  const { user, googleToken, signInWithGoogle, signOut } = useAuth()

  if (!user) return null

  return (
    <div className="flex items-center gap-3">
      {googleToken ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20">
          <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
          <span className="text-[10px] font-medium text-[#3b82f6]">Calendar synced</span>
        </div>
      ) : (
        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 hover:bg-[#f59e0b]/20 transition-all cursor-pointer"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
          <span className="text-[10px] font-medium text-[#f59e0b]">Reconnect Calendar</span>
        </button>
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
