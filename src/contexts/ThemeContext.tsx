import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type Theme = 'contemporaneo' | 'moderno' | 'galaxy'
const THEMES: Theme[] = ['contemporaneo', 'moderno', 'galaxy']

interface ThemeContextType {
    theme: Theme
    toggleTheme: () => void
    setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'moderno',
    toggleTheme: () => { },
    setTheme: () => { }
})

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => {
        try {
            const saved = localStorage.getItem('ecofin-theme') as Theme
            if (THEMES.includes(saved)) return saved
            return 'moderno'
        } catch {
            return 'moderno'
        }
    })

    useEffect(() => {
        const root = document.documentElement
        const body = document.body
        const themeClasses = THEMES.map(t => `theme-${t}`)

        root.classList.remove(...themeClasses)
        body.classList.remove(...themeClasses)

        const activeThemeClass = `theme-${theme}`
        root.classList.add(activeThemeClass)
        body.classList.add(activeThemeClass)

        // Keep Tailwind dark variants active for dark visual systems.
        if (theme === 'moderno' || theme === 'galaxy') {
            root.classList.add('dark')
        } else {
            root.classList.remove('dark')
        }

        body.classList.add('theme-transition')
        const timeout = window.setTimeout(() => {
            body.classList.remove('theme-transition')
        }, 420)

        try {
            localStorage.setItem('ecofin-theme', theme)
        } catch {
            // Ignore private mode storage failures.
        }

        return () => {
            window.clearTimeout(timeout)
            body.classList.remove('theme-transition')
        }
    }, [theme])

    const toggleTheme = () => {
        setTheme(prev => {
            if (prev === 'contemporaneo') return 'moderno'
            if (prev === 'moderno') return 'galaxy'
            return 'contemporaneo'
        })
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useTheme = () => useContext(ThemeContext)
