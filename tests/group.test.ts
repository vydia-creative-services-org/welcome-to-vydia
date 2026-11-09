import {describe, expect, it} from 'vitest'
import {groupByCategory} from '@/lib/resources/group'

const item = (id: string, category: string) => ({id, category})

describe('groupByCategory', () => {
  it('groups categories case-insensitively under the first spelling seen', () => {
    const groups = groupByCategory([
      item('a', 'Getting Started'),
      item('b', 'getting started'),
      item('c', 'GETTING STARTED'),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('Getting Started')
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps first-appearance order of groups and of items inside them', () => {
    const groups = groupByCategory([item('1', 'Beta'), item('2', 'Alpha'), item('3', 'beta'), item('4', 'Alpha')])
    expect(groups.map((g) => g.category)).toEqual(['Beta', 'Alpha'])
    expect(groups[0].items.map((i) => i.id)).toEqual(['1', '3'])
    expect(groups[1].items.map((i) => i.id)).toEqual(['2', '4'])
  })

  it('collapses surrounding and repeated whitespace', () => {
    const groups = groupByCategory([item('a', '  Your   Releases '), item('b', 'your releases')])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({key: 'your releases', category: 'Your Releases'})
  })

  it('returns no groups for no items', () => {
    expect(groupByCategory([])).toEqual([])
  })
})
