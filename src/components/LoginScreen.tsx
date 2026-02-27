import AnimatedBackground from './AnimatedBackground'

interface LoginScreenProps {
  onSignIn: () => void
}

export default function LoginScreen({ onSignIn }: LoginScreenProps) {
  return (
    <div className="h-screen w-screen bg-[#0d0d0d] flex items-center justify-center relative overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 flex flex-col items-center gap-10 animate-enter">
        <div className="text-center">
          <h1 className="text-7xl font-black text-white tracking-tight">
            <span className="text-[#FF3300]">S</span>H<span className="text-white/60">OU</span>T
          </h1>
          <p className="mt-3 text-[#888888] text-lg font-light tracking-wide shimmer rounded-lg px-2 py-1">
            Voice-powered task scheduling
          </p>
        </div>

        <button
          onClick={onSignIn}
          className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-white/5 border border-[#333] hover:border-[#FF3300]/30 hover:bg-[#FF3300]/10 transition-all duration-300 cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span className="text-white font-medium text-sm group-hover:text-white transition-colors duration-300">
            Sign in with Google
          </span>
        </button>
      </div>
    </div>
  )
}
