CREATE OR REPLACE VIEW public.vw_dashboard_stats WITH (security_invoker = true) AS
WITH lic_stats AS (
    SELECT 
        id, 
        razao_social,
        CASE 
            WHEN validade IS NOT NULL AND validade < CURRENT_DATE THEN 'Vencida'
            WHEN validade IS NOT NULL AND (validade >= CURRENT_DATE AND validade <= CURRENT_DATE + INTERVAL '90 days') THEN 'Vencendo'
            WHEN validade IS NOT NULL AND validade > CURRENT_DATE + INTERVAL '90 days' THEN 'Válida'
            WHEN status = 'Vencida' THEN 'Vencida'
            ELSE 'Válida'
        END AS dynamic_status
    FROM public.licencas
)
SELECT
    COUNT(DISTINCT razao_social) AS total_clientes,
    COUNT(*) AS total_licencas,
    COUNT(*) FILTER (WHERE dynamic_status = 'Válida') AS licencas_validas,
    COUNT(*) FILTER (WHERE dynamic_status = 'Vencida') AS licencas_vencidas,
    COUNT(*) FILTER (WHERE dynamic_status = 'Vencendo') AS vencendo_90_dias,
    CASE WHEN COUNT(*) > 0 THEN 
        ROUND(100.0 * (COUNT(*) FILTER (WHERE dynamic_status IN ('Válida', 'Vencendo'))) / COUNT(*))
    ELSE 0 END AS compliance_rate
FROM lic_stats;
