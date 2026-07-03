export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  iss?: string;
  aud?: string | string[];
  user_metadata?: {
    name?: string;
  };
}
