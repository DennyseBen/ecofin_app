-- ================================================
-- Fix: clientes table missing columns + populate from licencas
-- Applied: 2026-04-02
-- Problem: frontend code used columns (grupo, cep, celular, email, logradouro,
--          numero, complemento) that did not exist in the clientes table,
--          causing INSERT to fail. Table was also empty — the 376 "clients"
--          shown in the dashboard were DISTINCT razao_social from licencas.
-- ================================================

-- 1. Add missing columns expected by the frontend
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS grupo TEXT,
  ADD COLUMN IF NOT EXISTS cep VARCHAR(10),
  ADD COLUMN IF NOT EXISTS celular VARCHAR(20),
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS logradouro TEXT,
  ADD COLUMN IF NOT EXISTS numero VARCHAR(20),
  ADD COLUMN IF NOT EXISTS complemento TEXT;

-- 2. Populate clientes from licencas, deduplicating by cnpj (when present)
--    or by razao_social (when cnpj is null)
INSERT INTO public.clientes (razao_social, cnpj, cidade, bairro, grupo)
SELECT DISTINCT ON (COALESCE(cnpj, razao_social)) razao_social, cnpj, cidade, bairro, grupo
FROM public.licencas
WHERE razao_social IS NOT NULL AND razao_social != ''
ORDER BY COALESCE(cnpj, razao_social), razao_social
ON CONFLICT (cnpj) DO NOTHING;
