import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStore, STORAGE_KEY } from './useStore.js'

describe('useStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with empty state', () => {
    const { result } = renderHook(() => useStore())
    expect(result.current.saves).toEqual({})
    expect(result.current.follows).toEqual({})
    expect(result.current.dismisses).toEqual({})
    expect(result.current.views).toEqual({})
    expect(result.current.searches).toEqual({})
  })

  it('toggleSave adds and removes a save', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.toggleSave('vid_001'))
    expect(result.current.saves['vid_001']).toBeDefined()
    act(() => result.current.toggleSave('vid_001'))
    expect(result.current.saves['vid_001']).toBeUndefined()
  })

  it('toggleFollow tracks topic state', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.toggleFollow('topic_claude'))
    expect(result.current.follows['topic_claude']).toBeDefined()
    expect(result.current.isFollowing('topic_claude')).toBe(true)
    act(() => result.current.toggleFollow('topic_claude'))
    expect(result.current.isFollowing('topic_claude')).toBe(false)
  })

  it('dismiss flags an item as dismissed', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.dismiss('vid_002'))
    expect(result.current.isDismissed('vid_002')).toBe(true)
  })

  it('recordView increments view count and updates lastAt', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.recordView('vid_001'))
    act(() => result.current.recordView('vid_001'))
    expect(result.current.views['vid_001'].count).toBe(2)
    expect(result.current.views['vid_001'].lastAt).toBeTruthy()
    expect(result.current.viewCount('vid_001')).toBe(2)
  })

  it('recordSearch normalizes and counts queries', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.recordSearch('  Claude Code '))
    act(() => result.current.recordSearch('claude code'))
    expect(result.current.searches['claude code'].count).toBe(2)
  })

  it('recordSearch ignores empty queries', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.recordSearch(''))
    act(() => result.current.recordSearch('   '))
    expect(Object.keys(result.current.searches).length).toBe(0)
  })

  it('persists across hook re-mount via localStorage', () => {
    const { result, unmount } = renderHook(() => useStore())
    act(() => result.current.toggleFollow('topic_mcp'))
    act(() => result.current.recordView('vid_001'))
    unmount()
    const { result: r2 } = renderHook(() => useStore())
    expect(r2.current.isFollowing('topic_mcp')).toBe(true)
    expect(r2.current.viewCount('vid_001')).toBe(1)
  })

  it('writes to STORAGE_KEY in localStorage', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.toggleSave('vid_999'))
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw).saves.vid_999).toBeDefined()
  })
})

import { useStore as useStoreAgain, STORAGE_KEY as SK2 } from './useStore.js'

describe('memoryEntries CRUD', () => {
  beforeEach(() => localStorage.clear())

  it('addMemory creates an entry with auto id and addedAt', () => {
    const { result } = renderHook(() => useStoreAgain())
    let id
    act(() => { id = result.current.addMemory({ category: 'topic_rule', content: 'Always include MCP-related videos when surfacing Claude content.' }) })
    expect(id).toMatch(/^mem_/)
    const e = result.current.memoryEntries[id]
    expect(e.content).toContain('MCP')
    expect(e.confidence).toBe(1.0)
    expect(e.status).toBe('active')
    expect(e.addedAt).toBeTruthy()
  })

  it('updateMemory patches fields', () => {
    const { result } = renderHook(() => useStoreAgain())
    let id
    act(() => { id = result.current.addMemory({ category: 'topic_rule', content: 'X' }) })
    act(() => { result.current.updateMemory(id, { content: 'Y', status: 'validated' }) })
    expect(result.current.memoryEntries[id].content).toBe('Y')
    expect(result.current.memoryEntries[id].status).toBe('validated')
  })

  it('deleteMemory removes an entry', () => {
    const { result } = renderHook(() => useStoreAgain())
    let id
    act(() => { id = result.current.addMemory({ category: 'topic_rule', content: 'X' }) })
    act(() => { result.current.deleteMemory(id) })
    expect(result.current.memoryEntries[id]).toBeUndefined()
  })
})

describe('recentSearches selector', () => {
  beforeEach(() => localStorage.clear())

  it('returns top N searches sorted by lastAt desc', () => {
    const { result } = renderHook(() => useStoreAgain())
    act(() => result.current.recordSearch('claude'))
    act(() => result.current.recordSearch('mcp'))
    act(() => result.current.recordSearch('agents'))
    const recent = result.current.recentSearches(2)
    expect(recent).toHaveLength(2)
    expect(recent[0].query).toBe('agents')
    expect(recent[1].query).toBe('mcp')
  })
})

describe('user topics', () => {
  beforeEach(() => localStorage.clear())

  it('addUserTopic creates a topic with id, slug, addedAt and returns it', () => {
    const { result } = renderHook(() => useStore())
    let added
    act(() => { added = result.current.addUserTopic({ name: 'Vibe Coding', source: 'category', category: 'vibe_coding', query: 'vibecoding' }) })
    expect(added.id).toMatch(/^utopic_/)
    expect(added.slug).toBe('vibe-coding')
    expect(added.name).toBe('Vibe Coding')
    expect(added.followed).toBe(true)
    expect(added.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.current.userTopics[added.id]).toEqual(added)
  })

  it('addUserTopic dedupes by slug', () => {
    const { result } = renderHook(() => useStore())
    let first, second
    act(() => { first  = result.current.addUserTopic({ name: 'Antigravity', source: 'query', query: 'antigravity' }) })
    act(() => { second = result.current.addUserTopic({ name: 'antigravity', source: 'query', query: 'antigravity' }) })
    expect(first.id).toBe(second.id)
    expect(Object.keys(result.current.userTopics).length).toBe(1)
  })

  it('removeUserTopic deletes a topic by id', () => {
    const { result } = renderHook(() => useStore())
    let added
    act(() => { added = result.current.addUserTopic({ name: 'X', source: 'query', query: 'x' }) })
    act(() => { result.current.removeUserTopic(added.id) })
    expect(result.current.userTopics[added.id]).toBeUndefined()
  })

  it('userTopicBySlug looks up by slug', () => {
    const { result } = renderHook(() => useStore())
    act(() => { result.current.addUserTopic({ name: 'AI Agents Lab', source: 'query', query: 'agents' }) })
    expect(result.current.userTopicBySlug('ai-agents-lab').name).toBe('AI Agents Lab')
    expect(result.current.userTopicBySlug('does-not-exist')).toBeUndefined()
  })
})

describe('folder actions', () => {
  beforeEach(() => { localStorage.clear() })

  it('addFolder creates a folder and returns its meta', () => {
    const { result } = renderHook(() => useStore())
    let folder
    act(() => { folder = result.current.addFolder('Research') })
    expect(folder.name).toBe('Research')
    expect(folder.id).toMatch(/^folder_/)
    expect(folder.createdAt).toBeTruthy()
    expect(result.current.folders[folder.id]).toEqual(folder)
  })

  it('addFolder trims and caps name at 80 chars', () => {
    const { result } = renderHook(() => useStore())
    let folder
    act(() => { folder = result.current.addFolder('  ' + 'A'.repeat(100) + '  ') })
    expect(folder.name).toBe('A'.repeat(80))
  })

  it('addFolder with blank name falls back to "New Folder"', () => {
    const { result } = renderHook(() => useStore())
    let folder
    act(() => { folder = result.current.addFolder('   ') })
    expect(folder.name).toBe('New Folder')
  })

  it('renameFolder updates the folder name', () => {
    const { result } = renderHook(() => useStore())
    let folder
    act(() => { folder = result.current.addFolder('Old') })
    act(() => result.current.renameFolder(folder.id, 'New'))
    expect(result.current.folders[folder.id].name).toBe('New')
  })

  it('renameFolder is a no-op for unknown id', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.renameFolder('folder_nope', 'X'))
    // no throw
  })

  it('removeFolder deletes folder and nulls folderId on its docs', () => {
    const { result } = renderHook(() => useStore())
    let folder, doc
    act(() => { folder = result.current.addFolder('F') })
    act(() => { doc = result.current.addDocument({ title: 'D', plainText: 'hello', folderId: folder.id }) })
    expect(result.current.documents[doc.id].folderId).toBe(folder.id)
    act(() => result.current.removeFolder(folder.id))
    expect(result.current.folders[folder.id]).toBeUndefined()
    expect(result.current.documents[doc.id].folderId).toBeNull()
  })

  it('removeFolder leaves docs from other folders untouched', () => {
    const { result } = renderHook(() => useStore())
    let f1, f2, d1, d2
    act(() => { f1 = result.current.addFolder('F1') })
    act(() => { f2 = result.current.addFolder('F2') })
    act(() => { d1 = result.current.addDocument({ title: 'A', plainText: 'a', folderId: f1.id }) })
    act(() => { d2 = result.current.addDocument({ title: 'B', plainText: 'b', folderId: f2.id }) })
    act(() => result.current.removeFolder(f1.id))
    expect(result.current.documents[d1.id].folderId).toBeNull()
    expect(result.current.documents[d2.id].folderId).toBe(f2.id)
  })

  it('updateDocument assigns and clears folderId', () => {
    const { result } = renderHook(() => useStore())
    let folder, doc
    act(() => { folder = result.current.addFolder('F') })
    act(() => { doc = result.current.addDocument({ title: 'D', plainText: 'hello' }) })
    expect(result.current.documents[doc.id].folderId).toBeNull()
    act(() => result.current.updateDocument(doc.id, { folderId: folder.id }))
    expect(result.current.documents[doc.id].folderId).toBe(folder.id)
    act(() => result.current.updateDocument(doc.id, { folderId: null }))
    expect(result.current.documents[doc.id].folderId).toBeNull()
  })
})
