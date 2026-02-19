import { useEffect, useRef } from 'react'

export default function AnimatedBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function handleMouseMove(e: MouseEvent) {
      const x = e.clientX
      const y = e.clientY
      el!.style.setProperty('--mouse-x', `${x}px`)
      el!.style.setProperty('--mouse-y', `${y}px`)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div
      ref={ref}
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 51, 0, 0.06), transparent 40%)',
      }}
    />
  )
}
