import type { ResolvedSourceLink } from '../types.js'

const SOURCE_TYPE_LABELS: Record<string, string> = {
  save:           'Saved item',
  document:       'Document',
  manual_content: 'Added URL',
  topic_summary:  'Topic summary',
  brief:          'Brief',
}

type StoreSlice = {
  saves:          Record<string, { savedAt: string; item: any }>
  documents:      Record<string, { id: string; title: string; url?: string; createdAt?: string }>
  manualContent:  Record<string, { id: string; item: { url?: string; title?: string }; savedAt: string }>
  topicSummaries: Record<string, { overview?: string; generatedAt?: string }>
  userTopics:     Record<string, { id: string; title: string; slug?: string }>
  briefs:         Record<string, { id: string; title?: string; createdAt?: string }>
}

export function resolveSourceLink(
  sourceId:   string,
  sourceType: string,
  storeSlice: StoreSlice
): ResolvedSourceLink {
  const label = SOURCE_TYPE_LABELS[sourceType] ?? 'Unknown source'

  if (!sourceType || !(sourceType in SOURCE_TYPE_LABELS)) {
    return {
      label:        label,
      canNavigate:  false,
      notFound:     false,
      title:        undefined,
      externalUrl:  undefined,
      internalPath: undefined,
    }
  }

  if (sourceType === 'save') {
    const record = storeSlice.saves[sourceId]
    if (!record) {
      return { label, canNavigate: false, notFound: true, title: undefined, externalUrl: undefined, internalPath: undefined }
    }
    const item = record.item ?? {}
    const title: string | undefined =
      item.title ?? item.videoTitle ?? item.sourceTitle ?? item.name ?? item.url ?? undefined
    const externalUrl: string | undefined = item.url ?? item.sourceUrl ?? undefined
    const canNavigate = typeof externalUrl === 'string' && externalUrl.length > 0
    return {
      label,
      title,
      date:         record.savedAt,
      externalUrl:  canNavigate ? externalUrl : undefined,
      internalPath: undefined,
      canNavigate,
      notFound:     false,
    }
  }

  if (sourceType === 'document') {
    const record = storeSlice.documents[sourceId]
    if (!record) {
      return { label, canNavigate: false, notFound: true, title: undefined, externalUrl: undefined, internalPath: undefined }
    }
    const internalPath = `/documents/${sourceId}`
    return {
      label,
      title:        record.title,
      date:         record.createdAt,
      externalUrl:  undefined,
      internalPath,
      canNavigate:  true,
      notFound:     false,
    }
  }

  if (sourceType === 'manual_content') {
    const record = storeSlice.manualContent[sourceId]
    if (!record) {
      return { label, canNavigate: false, notFound: true, title: undefined, externalUrl: undefined, internalPath: undefined }
    }
    const title: string | undefined = record.item?.title ?? record.item?.url ?? undefined
    const externalUrl: string | undefined = record.item?.url ?? undefined
    const canNavigate = typeof externalUrl === 'string' && externalUrl.length > 0
    return {
      label,
      title,
      date:         record.savedAt,
      externalUrl:  canNavigate ? externalUrl : undefined,
      internalPath: undefined,
      canNavigate,
      notFound:     false,
    }
  }

  if (sourceType === 'topic_summary') {
    const topic = storeSlice.userTopics[sourceId]
    const summary = storeSlice.topicSummaries[sourceId]
    if (!topic && !summary) {
      return { label, canNavigate: false, notFound: true, title: undefined, externalUrl: undefined, internalPath: undefined }
    }
    const title: string | undefined = topic?.title ?? summary?.overview ?? 'Topic summary'
    const internalPath = topic
      ? `/topic/${topic.slug ?? sourceId}`
      : '/topics'
    return {
      label,
      title,
      date:         summary?.generatedAt,
      externalUrl:  undefined,
      internalPath,
      canNavigate:  true,
      notFound:     false,
    }
  }

  if (sourceType === 'brief') {
    const record = storeSlice.briefs[sourceId]
    if (!record) {
      return { label, canNavigate: false, notFound: true, title: undefined, externalUrl: undefined, internalPath: undefined }
    }
    return {
      label,
      title:        record.title ?? 'Brief',
      date:         record.createdAt,
      externalUrl:  undefined,
      internalPath: '/briefs',
      canNavigate:  true,
      notFound:     false,
    }
  }

  // Should not reach here, but satisfy exhaustive return
  return {
    label:        label,
    canNavigate:  false,
    notFound:     false,
    title:        undefined,
    externalUrl:  undefined,
    internalPath: undefined,
  }
}
