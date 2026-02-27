import { useAuth } from '../contexts/AuthContext'

export default function GoogleCalendarButton() {
  const { user, googleToken, signInWithGoogle, signOut } = useAuth()

  if (!user) return null

  return (
    <div className="flex items-center gap-3">
      {googleToken ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#4A90D9]/10 border border-[#4A90D9]/20">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4A90D9]" />
          <span className="text-[10px] font-medium text-[#4A90D9]">Calendar synced</span>
        </div>
      ) : (
        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FF6B00]/10 border border-[#FF6B00]/20 hover:bg-[#FF6B00]/20 transition-all cursor-pointer"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
          <span className="text-[10px] font-medium text-[#FF6B00]">Reconnect Calendar</span>
        </button>
      )}

      <button
        onClick={signOut}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.10] text-[#888] hover:text-white hover:border-white/[0.18] transition-all cursor-pointer"
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
