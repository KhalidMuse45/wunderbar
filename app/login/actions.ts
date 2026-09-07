'use server';
import { z } from 'zod';
import { serverClient } from '@/lib/supabase/server';
import { backendConfigured } from '@/lib/supabase/config';
export async function requestMagicLink(
  email: string,
): Promise<{ error?: string; success?: boolean }> {
  if (!backendConfigured())
    return { error: 'Connected accounts are not available yet. You can explore the demo below.' };
  const parsed = z.string().trim().email().max(254).safeParse(email);
  if (!parsed.success) return { error: 'Please enter a valid email address.' };
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return { error: 'Account setup is incomplete. Please contact the administrator.' };
  try {
    const client = await serverClient();
    const { error } = await client.auth.signInWithOtp({
      email: parsed.data,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${site.replace(/\/$/, '')}/auth/confirm`,
      },
    });
    if (error)
      return {
        error:
          error.status === 429
            ? 'Please wait a minute before requesting another link.'
            : 'The sign-in email could not be sent. Please try again shortly.',
      };
    return { success: true };
  } catch {
    return { error: 'We couldn’t reach the sign-in service. Please try again.' };
  }
}
