-- ================================================
-- Dashboard Stats: RPC com SECURITY DEFINER
-- Admin vê stats globais; usuário normal vê só os próprios dados.
-- SECURITY DEFINER = roda como postgres (bypassa RLS),
-- mas aplica o filtro manualmente conforme o papel do usuário.
-- ================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE(
    total_clientes  bigint,
    total_licencas  bigint,
    licencas_validas  bigint,
    licencas_vencidas bigint,
    vencendo_90_dias  bigint,
    compliance_rate   numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.is_admin_email() THEN
        -- Admin: stats globais (todos os dados da empresa)
        RETURN QUERY
        WITH lic AS (
            SELECT razao_social,
                CASE
                    WHEN validade IS NOT NULL AND validade < CURRENT_DATE THEN 'Vencida'
                    WHEN validade IS NOT NULL AND validade <= CURRENT_DATE + INTERVAL '90 days' THEN 'Vencendo'
                    WHEN validade IS NOT NULL THEN 'Válida'
                    WHEN status = 'Vencida' THEN 'Vencida'
                    ELSE 'Válida'
                END AS s
            FROM public.licencas
        )
        SELECT
            COUNT(DISTINCT razao_social)::bigint,
            COUNT(*)::bigint,
            COUNT(*) FILTER (WHERE s = 'Válida')::bigint,
            COUNT(*) FILTER (WHERE s = 'Vencida')::bigint,
            COUNT(*) FILTER (WHERE s = 'Vencendo')::bigint,
            CASE WHEN COUNT(*) > 0 THEN
                ROUND(100.0 * COUNT(*) FILTER (WHERE s IN ('Válida','Vencendo')) / COUNT(*))
            ELSE 0 END
        FROM lic;
    ELSE
        -- Usuário normal: apenas seus próprios registros
        RETURN QUERY
        WITH lic AS (
            SELECT razao_social,
                CASE
                    WHEN validade IS NOT NULL AND validade < CURRENT_DATE THEN 'Vencida'
                    WHEN validade IS NOT NULL AND validade <= CURRENT_DATE + INTERVAL '90 days' THEN 'Vencendo'
                    WHEN validade IS NOT NULL THEN 'Válida'
                    WHEN status = 'Vencida' THEN 'Vencida'
                    ELSE 'Válida'
                END AS s
            FROM public.licencas
            WHERE user_id = auth.uid()
        )
        SELECT
            COUNT(DISTINCT razao_social)::bigint,
            COUNT(*)::bigint,
            COUNT(*) FILTER (WHERE s = 'Válida')::bigint,
            COUNT(*) FILTER (WHERE s = 'Vencida')::bigint,
            COUNT(*) FILTER (WHERE s = 'Vencendo')::bigint,
            CASE WHEN COUNT(*) > 0 THEN
                ROUND(100.0 * COUNT(*) FILTER (WHERE s IN ('Válida','Vencendo')) / COUNT(*))
            ELSE 0 END
        FROM lic;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO anon, authenticated;

-- View simplificada mantida para uso interno/admin tools (check_users.ts, etc.)
DROP VIEW IF EXISTS public.vw_dashboard_stats;
CREATE VIEW public.vw_dashboard_stats AS
WITH lic AS (
    SELECT razao_social,
        CASE
            WHEN validade IS NOT NULL AND validade < CURRENT_DATE THEN 'Vencida'
            WHEN validade IS NOT NULL AND validade <= CURRENT_DATE + INTERVAL '90 days' THEN 'Vencendo'
            WHEN validade IS NOT NULL THEN 'Válida'
            WHEN status = 'Vencida' THEN 'Vencida'
            ELSE 'Válida'
        END AS s
    FROM public.licencas
)
SELECT
    COUNT(DISTINCT razao_social) AS total_clientes,
    COUNT(*) AS total_licencas,
    COUNT(*) FILTER (WHERE s = 'Válida') AS licencas_validas,
    COUNT(*) FILTER (WHERE s = 'Vencida') AS licencas_vencidas,
    COUNT(*) FILTER (WHERE s = 'Vencendo') AS vencendo_90_dias,
    CASE WHEN COUNT(*) > 0 THEN
        ROUND(100.0 * COUNT(*) FILTER (WHERE s IN ('Válida','Vencendo')) / COUNT(*))
    ELSE 0 END AS compliance_rate
FROM lic;

GRANT SELECT ON public.vw_dashboard_stats TO anon, authenticated;
