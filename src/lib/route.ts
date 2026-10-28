// Hash-Routing (Deep Links + Browser-Zurück) — reine Funktionen,
// damit sie ohne Browser testbar sind.
//   #/rezept/<id>  Detailansicht     #/import  Import
//   #/einkauf      Einkaufsliste     #/?q=…&status=…&kat=…&sort=…&fav=1&slg=…  Liste

import type { SortKey } from './types.ts'

export interface ListState {
  q: string
  filter: string
  cat: string | null
  sort: SortKey
  fav: boolean
  collection: string | null
}
export type Screen = { name: 'detail'; id: string } | { name: 'import' }
export interface RouteState {
  screen?: Screen
  tab?: 'rezepte' | 'einkauf'
  list?: ListState
}

const SORT_KEYS: SortKey[] = ['neueste', 'bewertung', 'gekocht', 'titel']
function toSort(s: string | null): SortKey {
  return (SORT_KEYS as string[]).includes(s ?? '') ? (s as SortKey) : 'neueste'
}

export function parseHash(hash: string | null | undefined): RouteState {
  const h = String(hash ?? '').replace(/^#\/?/, '')
  const [path, queryStr] = h.split('?')
  const params = new URLSearchParams(queryStr ?? '')
  if (path.startsWith('rezept/')) return { screen: { name: 'detail', id: path.slice(7) } }
  if (path === 'import') return { screen: { name: 'import' } }
  if (path === 'einkauf') return { tab: 'einkauf' }
  return {
    list: {
      q: params.get('q') ?? '',
      filter: params.get('status') ?? 'alle',
      cat: params.get('kat'),
      sort: toSort(params.get('sort')),
      fav: params.get('fav') === '1',
      collection: params.get('slg'),
    },
  }
}

export function buildListHash(
  q: string,
  filter: string,
  catFilter: string | null,
  sortBy: SortKey,
  onlyFavs: boolean,
  collectionId: string | null,
): string {
  const params = new URLSearchParams()
  if (q.trim()) params.set('q', q.trim())
  if (filter !== 'alle') params.set('status', filter)
  if (catFilter) params.set('kat', catFilter)
  if (sortBy !== 'neueste') params.set('sort', sortBy)
  if (onlyFavs) params.set('fav', '1')
  if (collectionId) params.set('slg', collectionId)
  const s = params.toString()
  return s ? `#/?${s}` : '#/'
}
