import { query, withTransaction } from '../lib/db.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';

export async function overview() {
  const result = await query(
    `select
       (select count(*)::int from public.users where role = 'client') as clients,
       (select count(*)::int from public.users where role = 'worker') as workers,
       (select count(*)::int from public.users where status = 'suspended') as suspended_users,
       (select count(*)::int from public.worker_profiles where verification_status = 'pending') as pending_verifications,
       (select count(*)::int from public.bookings where status in ('requested', 'accepted', 'en_route', 'arrived', 'in_progress')) as active_bookings,
       (select count(*)::int from public.bookings where status = 'completed') as completed_bookings,
       (select count(*)::int from public.bookings where created_at >= now() - interval '7 days') as bookings_last_7_days,
       (select coalesce(sum(final_price_kobo), 0)::bigint from public.bookings
          where status = 'completed' and completed_at >= now() - interval '30 days') as gmv_last_30_days_kobo`,
  );
  return result.rows[0];
}

export async function listVerifications(status = 'pending') {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = 'where v.status = $1::public.verification_submission_status';
  }

  const result = await query(
    `select v.*, u.full_name, u.email, u.phone, u.location_label,
            wp.trade, wp.years_experience, wp.verification_status as profile_verification_status
     from public.verification_submissions v
     join public.users u on u.id = v.worker_id
     join public.worker_profiles wp on wp.user_id = v.worker_id
     ${where}
     order by v.submitted_at asc`,
    params,
  );
  return result.rows;
}

export async function reviewVerification(workerId, adminId, decision, note) {
  const submissionStatus = decision === 'approve' ? 'approved' : 'rejected';
  const profileStatus = decision === 'approve' ? 'verified' : 'rejected';

  return withTransaction(async (client) => {
    const profile = await client.query(
      'select * from public.worker_profiles where user_id = $1 for update',
      [workerId],
    );
    if (!profile.rows[0]) {
      throw notFound('Worker profile not found.');
    }

    const submission = await client.query(
      `select * from public.verification_submissions
       where worker_id = $1 and status = 'pending'
       order by submitted_at desc limit 1
       for update`,
      [workerId],
    );
    if (!submission.rows[0]) {
      throw conflict('NO_PENDING_SUBMISSION', 'This worker has no pending verification submission.');
    }

    const updatedSubmission = await client.query(
      `update public.verification_submissions
       set status = $1, reviewed_by = $2, reviewed_at = now(), decision_reason = $3
       where id = $4
       returning *`,
      [submissionStatus, adminId, note ?? null, submission.rows[0].id],
    );

    const updatedProfile = await client.query(
      `update public.worker_profiles
       set verification_status = $1,
           verification_note = $2,
           verified_at = case when $1 = 'verified' then now() else null end,
           is_online = case when $1 = 'verified' then is_online else false end
       where user_id = $3
       returning *`,
      [profileStatus, note ?? null, workerId],
    );

    await client.query(
      `insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
       values ($1, $2, 'worker_profile', $3, $4::jsonb)`,
      [
        adminId,
        decision === 'approve' ? 'worker.verification.approved' : 'worker.verification.rejected',
        workerId,
        JSON.stringify({ note: note ?? null, submission_id: submission.rows[0].id }),
      ],
    );

    return { submission: updatedSubmission.rows[0], profile: updatedProfile.rows[0] };
  });
}

export async function listUsers(filters) {
  const { role, status, search, limit, offset } = filters;
  const conditions = [];
  const params = [];

  if (role) {
    params.push(role);
    conditions.push(`u.role = $${params.length}::public.user_role`);
  }
  if (status) {
    params.push(status);
    conditions.push(`u.status = $${params.length}::public.account_status`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.full_name ilike $${params.length} or u.email ilike $${params.length} or u.phone ilike $${params.length})`);
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  params.push(limit, offset);

  const result = await query(
    `select u.id, u.role, u.full_name, u.email, u.phone, u.location_label, u.status,
            u.created_at, wp.trade, wp.verification_status, wp.rating_avg, wp.jobs_completed
     from public.users u
     left join public.worker_profiles wp on wp.user_id = u.id
     ${where}
     order by u.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
  );
  return result.rows;
}

export async function setUserStatus(targetUserId, adminId, status, reason) {
  if (targetUserId === adminId) {
    throw forbidden('You cannot change your own account status.');
  }

  return withTransaction(async (client) => {
    const target = await client.query('select * from public.users where id = $1 for update', [targetUserId]);
    if (!target.rows[0]) {
      throw notFound('User not found.');
    }
    if (status === 'suspended' && target.rows[0].role === 'admin') {
      throw badRequest('CANNOT_SUSPEND_ADMIN', 'Admin accounts cannot be suspended from this endpoint.');
    }

    const updated = await client.query(
      'update public.users set status = $1 where id = $2 returning *',
      [status, targetUserId],
    );

    if (status === 'suspended' && target.rows[0].role === 'worker') {
      await client.query(
        'update public.worker_profiles set is_online = false where user_id = $1',
        [targetUserId],
      );
    }

    await client.query(
      `insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
       values ($1, $2, 'user', $3, $4::jsonb)`,
      [
        adminId,
        status === 'suspended' ? 'user.suspended' : 'user.reactivated',
        targetUserId,
        JSON.stringify({ reason: reason ?? null }),
      ],
    );

    return updated.rows[0];
  });
}
