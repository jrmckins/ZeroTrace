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

    const { data, error } = await supabase
      .from('users')
      .select('is_paid, usage')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[ZeroTrace] Supabase lookup failed:', error);

      return {
        allowed: false,
        reason: 'db_error'
      };
    }

    // First time this extension user has been seen.
    if (!data) {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          user_id: userId,
          is_paid: false,
          usage: {
            [optionKey]: 1
          }
        });

      if (insertError) {
        console.error(
          '[ZeroTrace] Could not create user:',
          insertError
        );

        return {
          allowed: false,
          reason: 'db_error'
        };
      }

      console.log(
        '[ZeroTrace] New free user created. Free usage consumed:',
        optionKey
      );

      return {
        allowed: true,
        paid: false
      };
    }

    // Paid users have unlimited usage.
    if (data.is_paid === true) {
      console.log('[ZeroTrace] Paid user - unlimited usage.');

      return {
        allowed: true,
        paid: true
      };
    }

    const usage = data.usage || {};
    const currentUsage = Number(usage[optionKey] || 0);

    // Free users get one run of each activity type.
    if (currentUsage >= 1) {
      console.log(
        '[ZeroTrace] Free usage already consumed:',
        optionKey
      );

      return {
        allowed: false,
        paid: false,
        reason: 'paywall_required'
      };
    }

    const updatedUsage = {
      ...usage,
      [optionKey]: 1
    };

    const { error: updateError } = await supabase
      .from('users')
      .update({
        usage: updatedUsage
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error(
        '[ZeroTrace] Could not update usage:',
        updateError
      );

      return {
        allowed: false,
        reason: 'db_error'
      };
    }

    console.log(
      '[ZeroTrace] Free usage consumed:',
      optionKey
    );

    return {
      allowed: true,
      paid: false
    };
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
