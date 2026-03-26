import { useState, useEffect, useCallback } from 'react'

interface UseSupabaseResult<T> {
    data: T
    loading: boolean
    error: string | null
    refetch: () => void
}

export function useSupabase<T>(
    fetcher: () => Promise<T>,
    fallback: T,
    deps: unknown[] = []
): UseSupabaseResult<T> {
    const [data, setData] = useState<T>(fallback)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await fetcher()
            setData(result)
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro ao carregar dados'
            setError(msg)
            console.warn('⚠️ Supabase fetch failed, using fallback:', msg)
            setData(fallback)
        } finally {
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps)

    useEffect(() => { load() }, [load])

    return { data, loading, error, refetch: load }
}
