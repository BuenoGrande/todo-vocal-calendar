import { useAuth } from '../contexts/AuthContext'

export default function GoogleCalendarButton() {
  const { user, googleToken, signInWithGoogle, signOut } = useAuth()

  if (!user) return null

  return (
    <div className="flex items-center gap-3">
      {googleToken ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-medium/10 border border-medium/20">
          <div className="w-1.5 h-1.5 rounded-full bg-medium" />
          <span className="text-[10px] font-medium text-medium">Calendar synced</span>
        </div>
      ) : (
        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-high/10 border border-high/20 hover:bg-high/20 transition-all cursor-pointer"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-high" />
          <span className="text-[10px] font-medium text-high">Reconnect Calendar</span>
        </button>
      )}

      <button
        onClick={signOut}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-secondary hover:text-primary hover:border-border-hover transition-all cursor-pointer"
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
