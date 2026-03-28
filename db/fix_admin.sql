CREATE OR REPLACE FUNCTION public.is_admin_email() RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := LOWER(auth.jwt() ->> 'email');
  RETURN (
    v_email = 'contatobcmedia@gmail.com' OR 
    v_email LIKE 'planeta.assessoria%' OR 
    v_email LIKE 'planetaassessoria%' OR
    v_email = 'admin@ecofin.com' OR
    v_email = 'admin@onoticial.com.br'
  );
END;
$$ LANGUAGE plpgsql;
