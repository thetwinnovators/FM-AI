import { searchSearxng } from './searxng.js'

const SITE_MAP = {
  producthunt:  { domain: 'producthunt.com',    label: 'Product Hunt'  },
  indiehackers: { domain: 'indiehackers.com',   label: 'Indie Hackers' },
  g2:           { domain: 'g2.com',             label: 'G2'            },
  capterra:     { domain: 'capterra.com',        label: 'Capterra'      },
  twitter:      { domain: 'x.com OR site:twitter.com', label: 'Twitter/X'    },
  linkedin:     { domain: 'linkedin.com',        label: 'LinkedIn'      },
  discord:      { domain: 'discord.com',         label: 'Discord'       },
  mobbin:       { domain: 'mobbin.com',          label: 'Mobbin'        },
  behance:      { domain: 'behance.net',         label: 'Behance'       },
  dribbble:     { domain: 'dribbble.com',        label: 'Dribbble'      },
  thefwa:       { domain: 'thefwa.com',          label: 'FWA'           },
}

export async function searchSite(sourceKey, query, limit = 8, signal) {
  const site = SITE_MAP[sourceKey]
  if (!site) throw new Error(`Unknown site source: ${sourceKey}`)
  const siteQuery = `site:${site.domain} ${query.trim()}`
  const results = await searchSearxng(siteQuery, limit, signal)
  return results.map((r) => r ? {
    ...r,
    source: sourceKey,
    // Preserve original URL and content from SearXNG result
    body:   r.summary || r.content || '',
  } : null).filter(Boolean)
}

export const SITE_SOURCE_KEYS = Object.keys(SITE_MAP)
export const SITE_SOURCE_LABELS = Object.fromEntries(
  Object.entries(SITE_MAP).map(([k, v]) => [k, v.label])
)
