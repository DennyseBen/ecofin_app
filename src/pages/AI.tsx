import React, { useMemo, useState } from 'react';
import { GoogleGenAI, createPartFromBase64 } from '@google/genai';
import { FileText, Sparkles, Upload, X } from 'lucide-react';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Formato inesperado ao ler arquivo.'));
        return;
      }
      // result é data URL: data:application/pdf;base64,xxxx
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

const defaultPrompt = `Extraia informações relevantes desta licença ambiental em JSON.

Regras:
- Responda APENAS com JSON válido (sem markdown).
- Se não encontrar um campo, use null.
- Datas no formato YYYY-MM-DD.

Campos:
{
  "empresa": string|null,
  "orgao_emissor": string|null,
  "tipo_licenca": string|null,
  "numero_licenca": string|null,
  "data_emissao": string|null,
  "data_validade": string|null,
  "condicionantes": string[]|null,
  "observacoes": string|null
}`;

export default function AI() {
  const apiKey = process.env.GEMINI_API_KEY as string;
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string>('');

  const canRun = useMemo(() => !!file && !busy, [file, busy]);

  const clear = () => {
    setFile(null);
    setOutput('');
    setError(null);
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setOutput('');

    try {
      const base64 = await readFileAsBase64(file);
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [
          { text: prompt },
          createPartFromBase64(base64, 'application/pdf'),
        ],
      });

      setOutput(response.text ?? '');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao processar o documento.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">IA (Gemini)</h1>
          <p className="text-slate-500">Faça upload de uma licença (PDF) para extrair dados automaticamente.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={clear}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <X className="w-5 h-5" />
            Limpar
          </button>
          <button
            onClick={run}
            disabled={!canRun}
            className="bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            {busy ? 'Extraindo...' : 'Extrair'}
          </button>
        </div>
      </div>

<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Documento</h2>
              <p className="text-sm text-slate-500">Envie um PDF de licença ambiental.</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <label className="block">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setOutput('');
                  setError(null);
                }}
              />

              <div className="border border-dashed border-slate-300 rounded-2xl p-6 hover:border-slate-400 transition-colors cursor-pointer bg-slate-50">
                <div className="flex items-center gap-3 text-slate-700">
                  <Upload className="w-5 h-5" />
                  <div className="font-medium">Clique para selecionar um PDF</div>
                </div>
                <div className="text-sm text-slate-500 mt-1">O arquivo é processado no navegador.</div>
              </div>
            </label>

            {file && (
              <div className="flex items-start justify-between gap-3 border border-slate-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{file.name}</div>
                    <div className="text-sm text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
                  </div>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                  title="Remover arquivo"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            <div>
              <div className="text-sm font-medium text-slate-700 mb-2">Instrução para extração</div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full min-h-56 px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Resultado</h2>
            <p className="text-sm text-slate-500">JSON extraído pela IA.</p>
          </div>

          <div className="p-5">
            {error && (
              <div className="bg-rose-50 text-rose-700 border border-rose-100 rounded-2xl p-4 text-sm font-medium">
                {error}
              </div>
            )}

            {!error && !output && (
              <div className="text-slate-500 text-sm">
                Envie um PDF e clique em <span className="font-semibold text-slate-700">Extrair</span>.
              </div>
            )}

            {!!output && (
              <pre className="whitespace-pre-wrap break-words text-sm bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-800 max-h-[520px] overflow-auto">
                {output}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

