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

export async function getPaidStatus() {
  try {
    const { userId, userSecret } = await getUserCredentials();
    const { data, error } = await supabase.rpc(
      'get_user_paid_status',
      {
        p_user_id: userId,
        p_user_secret: userSecret
      }
    );

    if (error) {
      console.error('[ZeroTrace] Could not load paid status:', error);
      return { valid: false, paid: false };
    }

    return {
      valid: data?.valid === true,
      paid: data?.is_paid === true
    };
  } catch (error) {
    console.error('[ZeroTrace] Paid status check failed:', error);
    return { valid: false, paid: false };
  }
}

export async function recoverUserAccount(recoveryCode) {
  const { userSecret } = await getUserCredentials();
  const normalizedCode = String(recoveryCode || '')
    .trim()
    .replace(/[^a-f0-9]/gi, '')
    .toLowerCase();
  if (!/^[a-f0-9]{48}$/.test(normalizedCode)) {
    throw new Error('Enter the 48-character recovery code.');
  }

  const { data, error } = await supabase.rpc(
    'recover_user_account',
    {
      p_recovery_code: normalizedCode,
      p_new_user_secret: userSecret
    }
  );
  if (error) {
    console.error('[ZeroTrace] Account recovery failed:', error);
    throw new Error('Could not restore the account. Check the code and try again.');
  }
  if (!data?.user_id || !data?.recovery_code) {
    throw new Error('That recovery code is invalid, expired, or already used.');
  }

  await chrome.storage.local.set({
    zeroTraceUserId: data.user_id,
    zeroTraceUserSecret: userSecret
  });
  return {
    userId: data.user_id,
    recoveryCode: data.recovery_code
  };
}

export async function createRecoveryCode() {
  const { userId, userSecret } = await getUserCredentials();
  const { data, error } = await supabase.rpc(
    'issue_user_recovery_code',
    {
      p_user_id: userId,
      p_user_secret: userSecret
    }
  );
  if (error) {
    console.error('[ZeroTrace] Could not create a recovery code:', error);
    throw new Error('Could not create a recovery code. Please try again.');
  }
  if (typeof data !== 'string' || !/^[a-f0-9]{48}$/.test(data)) {
    throw new Error('A recovery code is available only for paid accounts.');
  }
  return data;
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
