import { useParams } from 'react-router-dom'

export default function Topic() {
  const { slug } = useParams()
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Topic: {slug}</h1>
      <p className="text-sm text-[color:var(--color-text-secondary)] mt-2">Built in Phase 1.</p>
    </div>
  )
}
