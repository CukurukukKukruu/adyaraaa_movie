import queryString from 'query-string'
import { revalidateTag } from 'next/cache'
import { apiConfig } from '@/lib/tmdbConfig'

// Ambil dari .env
const BASE_URL = process.env.NEXT_PUBLIC_TMDB_BASEURL || apiConfig.baseUrl || 'https://api.themoviedb.org/3/'
const AUTH_TOKEN = process.env.TMDB_HEADER_KEY || apiConfig.headerKey || ''
const ENV_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || apiConfig.apiKey || ''

// Cache configuration
const CACHE_CONFIG = {
  DYNAMIC: {
    revalidate: 3600,
    tags: ['tmdb-dynamic'],
    cacheControl: 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=1800',
  },
  DETAILS: {
    revalidate: 28800,
    tags: ['tmdb-details'],
    cacheControl: 'public, max-age=14400, s-maxage=28800, stale-while-revalidate=7200',
  },
  SEARCH: {
    revalidate: 1800,
    tags: ['tmdb-search'],
    cacheControl: 'public, max-age=900, s-maxage=1800, stale-while-revalidate=900',
  },
  STATIC: {
    revalidate: 86400,
    tags: ['tmdb-static'],
    cacheControl: 'public, max-age=43200, s-maxage=86400, stale-while-revalidate=21600',
  },
}

const getCacheType = (url: string): keyof typeof CACHE_CONFIG => {
  if (url.includes('/search/')) return 'SEARCH'
  if (url.includes('/movie/') || url.includes('/tv/')) {
    if (url.match(/\/(movie|tv)\/\d+$/)) return 'DETAILS'
    if (url.includes('/similar') || url.includes('/recommendations') || url.includes('/credits')) {
      return 'DETAILS'
    }
  }
  if (url.includes('/trending/') || url.includes('/popular') || url.includes('/top_rated')) {
    return 'DYNAMIC'
  }
  return 'STATIC'
}

const generateCacheKey = (url: string, params?: Record<string, string | number>): string => {
  const sortedParams = params ? 
    Object.keys(params)
      .sort()
      .reduce((acc, key) => ({ ...acc, [key]: params[key] }), {}) 
    : {}
  
  const queryStr = Object.keys(sortedParams).length > 0 
    ? `?${new URLSearchParams(sortedParams as Record<string, string>).toString()}`
    : ''
  
  return `tmdb:${url}${queryStr}`
}

export const fetchClient = {
  get: async <T>(
    url: string,
    params?: Record<string, string | number>,
    isHeaderAuth = false
  ): Promise<T> => {
    const query = {
      ...params,
      ...(!isHeaderAuth && { api_key: ENV_API_KEY }),
    }

    const cacheType = getCacheType(url)
    const cacheConfig = CACHE_CONFIG[cacheType]
    const cacheKey = generateCacheKey(url, query)

    try {
      const fullUrl = `${BASE_URL}${queryString.stringifyUrl({ url, query })}`

      const res = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': cacheConfig.cacheControl,
          'CF-Cache-Tag': cacheConfig.tags.join(','),
          'X-Cache-Key': cacheKey,
          ...(isHeaderAuth && {
            Authorization: `Bearer ${AUTH_TOKEN}`,
          }),
        },
        next: { 
          revalidate: cacheConfig.revalidate,
          tags: [...cacheConfig.tags, cacheKey],
        },
      })

      if (!res.ok) {
        throw new Error(`TMDB API error: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()

      if (process.env.NODE_ENV === 'development') {
        console.log(`[Cache] ${cacheType} strategy for ${cacheKey}`)
      }

      return data
    } catch (error: any) {
      console.error(`[Fetch Error] ${cacheKey}:`, error.message)
      throw error
    }
  },

  post: async <T>(url: string, body = {}): Promise<T> => {
    try {
      const res = await fetch(`${BASE_URL}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        throw new Error(`TMDB API POST error: ${res.status} ${res.statusText}`)
      }

      return await res.json()
    } catch (error: any) {
      console.error(`[POST Error] ${url}:`, error.message)
      throw error
    }
  },

  purgeCache: async (tags: string[]): Promise<void> => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cache Purge] Would purge tags: ${tags.join(', ')}`)
      return
    }

    if (typeof revalidateTag !== 'undefined') {
      tags.forEach(tag => {
        try {
          revalidateTag(tag)
        } catch (error) {
          console.warn(`[Cache Purge] Failed to purge tag ${tag}:`, error)
        }
      })
    }
  },

  preloadCriticalData: async (): Promise<void> => {
    const criticalEndpoints = [
      { url: 'movie/popular', params: { page: 1 } },
      { url: 'tv/popular', params: { page: 1 } },
      { url: 'trending/movie/day', params: { page: 1 } },
      { url: 'trending/tv/day', params: { page: 1 } },
    ]

    console.log('[Cache Warm] Starting critical data preload...')
    
    const preloadPromises = criticalEndpoints.map(async ({ url, params }) => {
      try {
        await fetchClient.get(url, params, true)
        console.log(`[Cache Warm] Preloaded: ${url}`)
      } catch (error) {
        console.warn(`[Cache Warm] Failed to preload ${url}:`, error)
      }
    })
    
    await Promise.allSettled(preloadPromises)
    console.log('[Cache Warm] Critical data preload completed')
  },
}

// Fallback simple fetch if needed
export async function fetchFromTMDB<T>(url: string): Promise<T> {
  const response = await fetch(`${apiConfig.baseUrl}${url}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${apiConfig.headerKey}`,
    },
    next: { revalidate: 86400 }, // Optional: revalidate every 24h (ISR)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`TMDB API Error: ${response.status} - ${errorText}`)
  }

  return response.json()
}
