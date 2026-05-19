import express from 'express';
import { createClient } from '@supabase/supabase-js';

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  configError,
  hasSupabaseServiceConfig,
} from '../config.js';

const router = express.Router();

const supabase = hasSupabaseServiceConfig
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

function readBearerToken(req) {
  const authorization = req.headers.authorization || '';

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
}

async function getAuthenticatedUser(req) {
  if (!supabase) {
    throw new Error('Supabase service config is missing.');
  }

  const accessToken = readBearerToken(req);
  if (!accessToken) {
    return { user: null, error: 'Missing bearer token.' };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error) {
    return { user: null, error: error.message || 'Unable to verify session.' };
  }

  return { user: user || null, error: null };
}

router.post('/delete', async (req, res) => {
  if (!supabase) {
    return res
      .status(503)
      .json(configError('Account deletion is not configured for this installation.'));
  }

  const confirmPhrase = String(req.body?.confirmPhrase || '').trim();
  if (confirmPhrase !== 'DELETE MY ACCOUNT') {
    return res.status(400).json({
      error: 'Enter DELETE MY ACCOUNT to confirm permanent deletion.',
    });
  }

  try {
    const { user, error: authError } = await getAuthenticatedUser(req);

    if (authError) {
      return res.status(401).json({ error: authError });
    }

    if (!user?.id) {
      return res.status(401).json({ error: 'No authenticated user found.' });
    }

    const { error: saveDeleteError } = await supabase
      .from('player_saves')
      .delete()
      .eq('user_id', user.id);

    if (saveDeleteError) {
      throw new Error(`Failed to delete player save: ${saveDeleteError.message}`);
    }

    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      throw new Error(`Failed to delete auth user: ${deleteUserError.message}`);
    }

    return res.json({
      ok: true,
      deletedUserId: user.id,
      email: user.email || null,
    });
  } catch (error) {
    console.error('Account deletion failed:', error);
    return res.status(500).json({
      error: 'Account deletion failed',
      message: error?.message || 'Unable to delete this account right now.',
    });
  }
});

export default router;
