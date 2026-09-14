import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://igdetmlslqlecfcexhqm.supabase.co';

// Put your Supabase anon/public key here.

const SUPABASE_ANON_KEY = 'sb_publishable_DP7MWOgFtUKWpFit6yypWQ_j668b1tZ';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

function getUserId() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['zeroTraceUserId'], async (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      if (result.zeroTraceUserId) {
        resolve(result.zeroTraceUserId);
        return;
      }

      const userId = crypto.randomUUID();

      await chrome.storage.local.set({
        zeroTraceUserId: userId
      });

      resolve(userId);
    });
  });
}

export async function verifyAndTrackUsage(optionKey) {
  try {
    const userId = await getUserId();

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
        p_option_key: optionKey
      }
    );

    if (error) {
      console.error('[ZeroTrace] Usage check failed:', error);

      return {
        allowed: false,
        reason: 'db_error'
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
