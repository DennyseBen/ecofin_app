import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

type Table = 'licencas' | 'outorgas' | 'clientes' | 'financeiro' | 'kanban_cards' | 'faturas_nfe'

/**
 * Subscribes to Supabase Realtime changes on the given tables.
 * Calls onUpdate whenever any INSERT, UPDATE or DELETE occurs.
 * Automatically cleans up subscriptions on unmount.
 */
export function useRealtime(tables: Table[], onUpdate: () => void) {
    const callbackRef = useRef(onUpdate)
    callbackRef.current = onUpdate

    useEffect(() => {
        const channels = tables.map(table =>
            supabase
                .channel(`rt-${table}-${Date.now()}`)
                .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
                    callbackRef.current()
                })
                .subscribe()
        )

        return () => {
            channels.forEach(ch => supabase.removeChannel(ch))
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tables.join(',')])
}
