export function toSlug(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function slugMatches(slug, candidate) {
  return toSlug(candidate) === toSlug(slug)
}
