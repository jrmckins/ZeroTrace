import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://igdetmlslqlecfcexhqm.supabase.co';

// Put your Supabase anon/public key here.

const SUPABASE_ANON_KEY = 'sb_publishable_DP7MWOgFtUKWpFit6yypWQ_j668b1tZ';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

function createUserSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function getUserCredentials() {
  const result = await chrome.storage.local.get([
    'zeroTraceUserId',
    'zeroTraceUserSecret'
  ]);

  const userId = result.zeroTraceUserId || crypto.randomUUID();
  const userSecret =
    result.zeroTraceUserSecret || createUserSecret();

  if (
    !result.zeroTraceUserId ||
    !result.zeroTraceUserSecret
  ) {
    await chrome.storage.local.set({
      zeroTraceUserId: userId,
      zeroTraceUserSecret: userSecret
    });
  }

  return { userId, userSecret };
}

export async function verifyAndTrackUsage(optionKey) {
  try {
    const { userId, userSecret } = await getUserCredentials();

    console.log('[ZeroTrace] Checking usage:', {
      userId,
      optionKey
    });

    // All read/write logic now lives server-side in the
    // check_and_track_usage() Postgres function. The anon key
    // has no direct grants on the `users` table anymore, so
    // there is no client-reachable path to setting is_paid.
    const { data, error } = await supabase.rpc(
      'check_and_track_usage',
      {
        p_user_id: userId,
        p_user_secret: userSecret,
        p_option_key: optionKey
      }
    );

    if (error) {
      console.error('[ZeroTrace] Usage check failed:', error);

      return {
        allowed: false,
        reason:
          error.code === 'PGRST202' || error.code === '42883'
            ? 'backend_not_configured'
            : 'db_error'
      };
    }

    console.log(
      '[ZeroTrace] Usage verification result:',
      data
    );

    return data;
  } catch (error) {
    console.error(
      '[ZeroTrace] Usage checker error:',
      error
    );

    return {
      allowed: false,
      reason: 'db_error'
    };
  }
}
