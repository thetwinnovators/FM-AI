import { useMemo } from 'react'
import topics from '../data/topics.json'
import content from '../data/content.json'
import creators from '../data/creators.json'
import tools from '../data/tools.json'
import companies from '../data/companies.json'
import concepts from '../data/concepts.json'
import tags from '../data/tags.json'
import relations from '../data/relations.json'
import seedMemory from '../data/seed-memory.json'

export function useSeed() {
  return useMemo(() => {
    const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]))
    const bySlug = (arr) => Object.fromEntries(arr.map((x) => [x.slug, x]))

    const topicsById = byId(topics)
    const topicsBySlug = bySlug(topics)
    const creatorsById = byId(creators)
    const toolsById = byId(tools)
    const companiesById = byId(companies)
    const conceptsById = byId(concepts)
    const tagsById = byId(tags)
    const contentById = byId(content)

    return {
      topics, content, creators, tools, companies, concepts, tags, relations, seedMemory,
      topicById: (id) => topicsById[id],
      topicBySlug: (slug) => topicsBySlug[slug],
      creatorById: (id) => creatorsById[id],
      toolById: (id) => toolsById[id],
      companyById: (id) => companiesById[id],
      conceptById: (id) => conceptsById[id],
      tagById: (id) => tagsById[id],
      contentById: (id) => contentById[id],
      contentByTopic: (topicId) => content.filter((c) => c.topicIds?.includes(topicId)),
      contentByCreator: (creatorId) => content.filter((c) => c.creatorId === creatorId),
    }
  }, [])
}
