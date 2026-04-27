import { useMemo } from 'react'
import { useSeed } from './useSeed.js'
import { useStore } from './useStore.js'
import { computePatterns } from '../lib/graph/pattern.js'

export function useLearning() {
  const seed = useSeed()
  const { saves, follows, views } = useStore()

  return useMemo(
    () => computePatterns(seed, { saves, follows, views }),
    [seed, saves, follows, views]
  )
}
