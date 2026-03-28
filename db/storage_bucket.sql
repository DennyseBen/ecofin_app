-- Bucket para armazenar documentos de licenças (PDF, Excel, Word)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'licencas-docs',
  'licencas-docs',
  true,
  20971520, -- 20MB
  ARRAY['application/pdf','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated upload licencas-docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'licencas-docs');

CREATE POLICY "Public read licencas-docs"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'licencas-docs');

CREATE POLICY "Authenticated delete licencas-docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'licencas-docs');
