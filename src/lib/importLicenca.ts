import * as XLSX from 'xlsx'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from './supabase'

// ── Upload para Supabase Storage ──────────────────────────────────────────────
export async function uploadLicencaDoc(file: File): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('licencas-docs').upload(path, file)
    if (error) throw new Error(`Falha no upload: ${error.message}`)
    const { data } = supabase.storage.from('licencas-docs').getPublicUrl(path)
    return data.publicUrl
}

// ── Extração de texto por tipo de arquivo ─────────────────────────────────────
async function extractFromPDF(file: File): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist')
    const workerSrc = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc.default
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
    let text = ''
    for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map((item: any) => item.str).join(' ') + '\n'
    }
    return text
}

async function extractFromExcel(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
    const wb = XLSX.read(arrayBuffer)
    return wb.SheetNames.map(name => XLSX.utils.sheet_to_csv(wb.Sheets[name])).join('\n')
}

async function extractFromDocx(file: File): Promise<string> {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
}

export async function extractTextFromFile(file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') return extractFromPDF(file)
    if (ext === 'xlsx' || ext === 'xls') return extractFromExcel(file)
    if (ext === 'docx' || ext === 'doc') return extractFromDocx(file)
    throw new Error('Formato não suportado. Use PDF, Excel ou Word.')
}

// ── Extração de campos via Gemini ─────────────────────────────────────────────
export interface ExtractedFields {
    razao_social?: string
    cnpj?: string
    tipo?: string
    validade?: string       // YYYY-MM-DD
    departamento?: string
    atividade_licenciada?: string
    processo?: string
    cidade?: string
    numero_outorga?: string
}

export async function extractFieldsWithGemini(text: string, apiKey: string): Promise<ExtractedFields> {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `Analise o texto de um documento de licença ambiental ou outorga e extraia os campos abaixo.
Retorne APENAS JSON válido, sem markdown.

Campos (null se não encontrado):
- razao_social: Razão social da empresa
- cnpj: CNPJ no formato XX.XXX.XXX/XXXX-XX
- tipo: Tipo de licença/outorga (LP, LI, LO, Dispensa, CLUA, LAAS, Outorga etc.)
- validade: Data de validade no formato YYYY-MM-DD
- departamento: Órgão emissor (SEMMA, SEMAS, IBAMA, ANA, SEIRH etc.)
- atividade_licenciada: Atividade principal
- processo: Número do processo ou protocolo
- cidade: Município/cidade
- numero_outorga: Número da outorga (se houver)

Texto:
${text.slice(0, 8000)}`

    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim().replace(/```json\n?|\n?```/g, '').trim()
    try {
        return JSON.parse(raw)
    } catch {
        return {}
    }
}

// ── Fallback por regex (sem IA) ────────────────────────────────────────────────
export function extractFieldsWithRegex(text: string): ExtractedFields {
    const cnpjMatch = text.match(/\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}/)
    const dateMatch = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/)
    const tipoMatch = text.match(/\b(LP|LI|LO|CLUA|Dispensa|LAAS|Outorga|Captação)\b/i)

    return {
        cnpj: cnpjMatch?.[0],
        validade: dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : undefined,
        tipo: tipoMatch?.[0]?.toUpperCase(),
    }
}

// ── Função principal ───────────────────────────────────────────────────────────
export async function importarDocumento(file: File, geminiApiKey?: string): Promise<{
    fields: ExtractedFields
    fileUrl: string
}> {
    const [fileUrl, text] = await Promise.all([
        uploadLicencaDoc(file),
        extractTextFromFile(file),
    ])

    let fields: ExtractedFields = {}
    if (geminiApiKey && text.trim().length > 20) {
        try {
            fields = await extractFieldsWithGemini(text, geminiApiKey)
        } catch {
            fields = extractFieldsWithRegex(text)
        }
    } else if (text.trim().length > 20) {
        fields = extractFieldsWithRegex(text)
    }

    return { fields, fileUrl }
}
