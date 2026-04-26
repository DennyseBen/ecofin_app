import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import type { DateRange } from 'react-day-picker'
import { ptBR } from 'date-fns/locale'
import { Calendar, X, ChevronRight } from 'lucide-react'
import 'react-day-picker/style.css'

interface DateRangePickerProps {
    dateFrom: string   // YYYY-MM-DD or ''
    dateTo: string     // YYYY-MM-DD or ''
    onChange: (from: string, to: string) => void
}

function parseLocal(s: string): Date | undefined {
    if (!s) return undefined
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
}

function toYMD(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function fmtDisplay(d: Date): string {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function DateRangePicker({ dateFrom, dateTo, onChange }: DateRangePickerProps) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    const range: DateRange = {
        from: parseLocal(dateFrom),
        to: parseLocal(dateTo),
    }

    const hasRange = !!(dateFrom || dateTo)

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleSelect = (r: DateRange | undefined) => {
        const from = r?.from ? toYMD(r.from) : ''
        const to = r?.to ? toYMD(r.to) : ''
        onChange(from, to)
        // Auto close when both dates are selected
        if (r?.from && r?.to) setOpen(false)
    }

    const clear = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange('', '')
    }

    return (
        <div ref={ref} style={{ position: 'relative', width: '100%' }}>
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '10px 14px',
                    background: 'var(--input-bg)', border: `1px solid ${open ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: open ? '0 0 0 3px var(--primary-ring)' : 'none',
                    transition: 'all .15s',
                }}
            >
                <Calendar size={15} style={{ color: 'var(--primary-fg)', flexShrink: 0 }} />
                <span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: hasRange ? 'var(--text)' : 'var(--text-dim)' }}>
                    {!hasRange && 'Selecionar período…'}
                    {dateFrom && !dateTo && `De ${fmtDisplay(parseLocal(dateFrom)!)}`}
                    {dateFrom && dateTo && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {fmtDisplay(parseLocal(dateFrom)!)}
                            <ChevronRight size={12} style={{ color: 'var(--text-dim)' }} />
                            {fmtDisplay(parseLocal(dateTo)!)}
                        </span>
                    )}
                </span>
                {hasRange && (
                    <span
                        onClick={clear}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 18, height: 18, borderRadius: 9,
                            background: 'var(--neutral-bg)', color: 'var(--text-mute)',
                            flexShrink: 0,
                        }}
                    >
                        <X size={11} />
                    </span>
                )}
            </button>

            {/* Popup calendar */}
            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                    zIndex: 100, background: 'var(--surface)',
                    border: '1px solid var(--border)', borderRadius: 16,
                    boxShadow: '0 20px 60px -12px rgba(0,0,0,0.5)',
                    padding: '12px',
                }}>
                    <DayPicker
                        mode="range"
                        selected={range}
                        onSelect={handleSelect}
                        locale={ptBR}
                        numberOfMonths={2}
                        showOutsideDays
                        style={{
                            '--rdp-accent-color': 'var(--primary)',
                            '--rdp-accent-background-color': 'var(--primary-soft)',
                            '--rdp-background-color': 'var(--primary-soft)',
                            '--rdp-color': 'var(--text)',
                            fontFamily: 'inherit',
                            fontSize: 13,
                        } as React.CSSProperties}
                    />
                    {/* Footer com atalhos */}
                    <div style={{
                        display: 'flex', gap: 6, padding: '8px 4px 0',
                        borderTop: '1px solid var(--border)', flexWrap: 'wrap',
                    }}>
                        {[
                            { label: 'Este mês', fn: () => { const n = new Date(); onChange(toYMD(new Date(n.getFullYear(), n.getMonth(), 1)), toYMD(new Date(n.getFullYear(), n.getMonth() + 1, 0))); setOpen(false) } },
                            { label: 'Próx. mês', fn: () => { const n = new Date(); onChange(toYMD(new Date(n.getFullYear(), n.getMonth() + 1, 1)), toYMD(new Date(n.getFullYear(), n.getMonth() + 2, 0))); setOpen(false) } },
                            { label: 'Próx. 30d', fn: () => { const n = new Date(); const t = new Date(n); t.setDate(t.getDate() + 30); onChange(toYMD(n), toYMD(t)); setOpen(false) } },
                            { label: 'Próx. 60d', fn: () => { const n = new Date(); const t = new Date(n); t.setDate(t.getDate() + 60); onChange(toYMD(n), toYMD(t)); setOpen(false) } },
                            { label: 'Próx. 90d', fn: () => { const n = new Date(); const t = new Date(n); t.setDate(t.getDate() + 90); onChange(toYMD(n), toYMD(t)); setOpen(false) } },
                        ].map(s => (
                            <button
                                key={s.label}
                                type="button"
                                onClick={s.fn}
                                style={{
                                    padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                                    background: 'var(--primary-soft)', color: 'var(--primary-fg)',
                                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                }}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
