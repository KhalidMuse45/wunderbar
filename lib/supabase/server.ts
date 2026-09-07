import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { backendConfig } from './config';
export async function serverClient() {
  const { url, key } = backendConfig();
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* Middleware refreshes cookies when this is a Server Component. */
        }
      },
    },
  });
}
