import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '../lib/types'
import { fetchUserProfile, updateUserProfile, ADMIN_PHONES } from '../lib/api'

interface AuthContextType {
    user: User | null
    profile: UserProfile | null
    isAdmin: boolean
    loading: boolean
    signIn: (email: string, password: string) => Promise<{ error: string | null }>
    signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
    updateProfile: (name: string) => Promise<{ error: string | null }>
    updateNotificationSettings: (settings: Partial<Pick<UserProfile, 'email_notificacoes' | 'whatsapp_notificacoes' | 'notify_vencimentos' | 'notify_renovacoes' | 'notify_sistema' | 'gemini_api_key'>>) => Promise<{ error: string | null }>
    updatePhone: (phone: string) => Promise<{ error: string | null; becameAdmin: boolean }>
    signOut: () => Promise<void>
    refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    isAdmin: false,
    loading: true,
    signIn: async () => ({ error: null }),
    signUp: async () => ({ error: null }),
    updateProfile: async () => ({ error: null }),
    updateNotificationSettings: async () => ({ error: null }),
    updatePhone: async () => ({ error: null, becameAdmin: false }),
    signOut: async () => { },
    refreshProfile: async () => { },
})

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    const isAdmin = profile?.role === 'admin'

    const loadProfile = async (sessionUser: User | null) => {
        if (!sessionUser) {
            setUser(null)
            setProfile(null)
            setLoading(false)
            return
        }

        try {
            const profileData = await fetchUserProfile(sessionUser.id)
            if (profileData) {
                // Sync full_name and avatar_url back to user_metadata for compatibility
                if (!sessionUser.user_metadata) (sessionUser as any).user_metadata = {}
                sessionUser.user_metadata.full_name = profileData.full_name || sessionUser.user_metadata.full_name
                sessionUser.user_metadata.avatar_url = profileData.avatar_url || sessionUser.user_metadata.avatar_url
                setProfile(profileData)
            } else {
                // Profile might not exist yet — try to read from auth metadata
                const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', sessionUser.id).single()
                if (data) {
                    if (!sessionUser.user_metadata) (sessionUser as any).user_metadata = {}
                    sessionUser.user_metadata.full_name = data.full_name || sessionUser.user_metadata.full_name
                    sessionUser.user_metadata.avatar_url = data.avatar_url || sessionUser.user_metadata.avatar_url
                }
            }
        } catch (e) {
            console.error("Error loading profile:", e)
        }

        setUser(sessionUser)
        setLoading(false)
    }

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            loadProfile(session?.user ?? null)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            loadProfile(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [])

    const refreshProfile = async () => {
        if (!user) return
        const profileData = await fetchUserProfile(user.id)
        if (profileData) setProfile(profileData)
    }

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return { error: error.message }
        return { error: null }
    }

    const signUp = async (email: string, password: string, name: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } }
        })
        if (error) return { error: error.message }
        return { error: null }
    }

    const signOutFn = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
    }

    const updateProfile = async (name: string) => {
        if (!user) return { error: 'Usuário não logado' }
        const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', user.id)
        if (error) return { error: error.message }
        const updatedUser = { ...user, user_metadata: { ...user.user_metadata, full_name: name } } as User
        setUser(updatedUser)
        setProfile(prev => prev ? { ...prev, full_name: name } : prev)
        return { error: null }
    }

    const updateNotificationSettings = async (settings: Partial<Pick<UserProfile, 'email_notificacoes' | 'whatsapp_notificacoes' | 'notify_vencimentos' | 'notify_renovacoes' | 'notify_sistema' | 'gemini_api_key'>>) => {
        if (!user) return { error: 'Usuário não logado' }
        try {
            await updateUserProfile(user.id, settings)
            setProfile(prev => prev ? { ...prev, ...settings } : prev)
            return { error: null }
        } catch (e: any) {
            return { error: e.message }
        }
    }

    const updatePhone = async (phone: string) => {
        if (!user) return { error: 'Usuário não logado', becameAdmin: false }
        const cleanPhone = phone.replace(/\D/g, '')
        const becameAdmin = ADMIN_PHONES.includes(cleanPhone)
        const updates: Partial<UserProfile> = { phone }
        if (becameAdmin) updates.role = 'admin'

        try {
            await updateUserProfile(user.id, updates)
            setProfile(prev => prev ? { ...prev, ...updates } : prev)
            return { error: null, becameAdmin }
        } catch (e: any) {
            return { error: e.message, becameAdmin: false }
        }
    }

    return (
        <AuthContext.Provider value={{
            user, profile, isAdmin, loading,
            signIn, signUp, updateProfile, updateNotificationSettings, updatePhone,
            signOut: signOutFn, refreshProfile
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
