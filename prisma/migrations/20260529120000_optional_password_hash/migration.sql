-- Autenticación delegada a Supabase; hash local ya no es obligatorio
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
