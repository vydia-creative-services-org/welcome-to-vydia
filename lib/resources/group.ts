export type CategoryGroup<T> = {key: string; category: string; items: T[]}

export function groupByCategory<T extends {category: string}>(items: T[]): CategoryGroup<T>[] {
  const groups = new Map<string, CategoryGroup<T>>()
  for (const item of items) {
    const category = item.category.trim().replace(/\s+/g, ' ')
    const key = category.toLowerCase()
    const group = groups.get(key)
    if (group) group.items.push(item)
    else groups.set(key, {key, category, items: [item]})
  }
  return [...groups.values()]
}

export function distinctCategories(categories: string[]): string[] {
  const seen = new Map<string, string>()
  for (const raw of categories) {
    const category = raw.trim().replace(/\s+/g, ' ')
    if (category && !seen.has(category.toLowerCase())) seen.set(category.toLowerCase(), category)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}
