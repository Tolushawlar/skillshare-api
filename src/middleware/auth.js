import { supabaseAdmin } from '../lib/supabase.js';
import { query } from '../lib/db.js';
import { forbidden, unauthorized } from '../utils/errors.js';

function readBearerToken(req) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

async function resolveUser(token) {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    throw unauthorized('Your session is invalid or has expired.');
  }

  const result = await query('select * from public.users where id = $1', [data.user.id]);
  const profile = result.rows[0];
  if (!profile) {
    throw unauthorized('No platform profile exists for this account.');
  }
  if (profile.status !== 'active') {
    throw forbidden('This account is suspended. Contact support.');
  }

  return { authUser: data.user, profile };
}

export async function requireAuth(req, _res, next) {
  try {
    const token = readBearerToken(req);
    if (!token) {
      throw unauthorized();
    }
    const { authUser, profile } = await resolveUser(token);
    req.authUser = authUser;
    req.user = profile;
    req.accessToken = token;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles) {
  return function roleGuard(req, _res, next) {
    if (!req.user) {
      return next(unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(forbidden(`This endpoint requires one of: ${roles.join(', ')}.`));
    }
    return next();
  };
}

export async function optionalAuth(req, _res, next) {
  const token = readBearerToken(req);
  if (!token) {
    return next();
  }
  try {
    const { authUser, profile } = await resolveUser(token);
    req.authUser = authUser;
    req.user = profile;
    req.accessToken = token;
  } catch {
    // Public endpoints stay public even if a stale token was sent.
  }
  return next();
}
