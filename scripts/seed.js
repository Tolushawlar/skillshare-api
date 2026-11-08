import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, closePool } from '../src/lib/db.js';
import { supabaseAdmin } from '../src/lib/supabase.js';
import { generatePublicRef } from '../src/domain/booking.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const ADMIN_PASSWORD = 'admin123';
const DEMO_PASSWORD = 'password123';

const demoUsers = [
  {
    email: 'admin@skilllink.test',
    password: ADMIN_PASSWORD,
    role: 'admin',
    full_name: 'Platform Admin',
    phone: '+2348000000000',
    location_label: 'Ibadan',
    lat: 7.3775,
    lng: 3.947,
  },
  {
    email: 'client@skilllink.test',
    password: DEMO_PASSWORD,
    role: 'client',
    full_name: 'Ada Nwosu',
    phone: '+2348011111111',
    location_label: 'Bodija, Ibadan',
    lat: 7.3775,
    lng: 3.947,
  },
  {
    email: 'bola@skilllink.test',
    password: DEMO_PASSWORD,
    role: 'client',
    full_name: 'Bola Ade',
    phone: '+2348022222222',
    location_label: 'Ring Road, Ibadan',
    lat: 7.39,
    lng: 3.93,
  },
  {
    email: 'emeka@skilllink.test',
    password: DEMO_PASSWORD,
    role: 'worker',
    full_name: 'Emeka Okafor',
    phone: '+2348033333333',
    location_label: 'Agodi, Ibadan',
    lat: 7.385,
    lng: 3.925,
    trade: 'Mechanic',
    bio: 'Auto mechanic specialising in diagnostics, brakes, suspension and roadside breakdowns. I bring my own tools and explain the problem before I start.',
    years_experience: 8,
    hourly_rate_kobo: 850_000,
    service_radius_m: 15_000,
    verified: true,
  },
  {
    email: 'tunde@skilllink.test',
    password: DEMO_PASSWORD,
    role: 'worker',
    full_name: 'Tunde Balogun',
    phone: '+2348044444444',
    location_label: 'Ring Road, Ibadan',
    lat: 7.365,
    lng: 3.955,
    trade: 'Electrician',
    bio: 'Licensed electrician for wiring, fault finding, socket repairs, inverters and small solar installations. Safety-first and tidy work.',
    years_experience: 10,
    hourly_rate_kobo: 700_000,
    service_radius_m: 12_000,
    verified: true,
  },
  {
    email: 'musa@skilllink.test',
    password: DEMO_PASSWORD,
    role: 'worker',
    full_name: 'Musa Abdullahi',
    phone: '+2348055555555',
    location_label: 'Dugbe, Ibadan',
    lat: 7.395,
    lng: 3.965,
    trade: 'Plumber',
    bio: 'Plumbing repairs, leak detection, pipe replacement, water pumps and drainage. Available for emergencies around Ibadan.',
    years_experience: 6,
    hourly_rate_kobo: 650_000,
    service_radius_m: 10_000,
    verified: true,
  },
  {
    email: 'chinedu@skilllink.test',
    password: DEMO_PASSWORD,
    role: 'worker',
    full_name: 'Chinedu Eze',
    phone: '+2348066666666',
    location_label: 'Challenge, Ibadan',
    lat: 7.355,
    lng: 3.915,
    trade: 'AC Technician',
    bio: 'Air conditioning installation, servicing, gas refill and repairs for split and window units. Certified technician.',
    years_experience: 12,
    hourly_rate_kobo: 1_200_000,
    service_radius_m: 20_000,
    verified: true,
  },
  {
    email: 'aisha@skilllink.test',
    password: DEMO_PASSWORD,
    role: 'worker',
    full_name: 'Aisha Bello',
    phone: '+2348077777777',
    location_label: 'Bodija, Ibadan',
    lat: 7.375,
    lng: 3.985,
    trade: 'Tailor',
    bio: 'Custom tailoring, alterations, native wear and bridal adjustments. I work from my Bodija studio and do pickups within Ibadan.',
    years_experience: 5,
    hourly_rate_kobo: 500_000,
    service_radius_m: 8_000,
    verified: true,
  },
  {
    email: 'femi@skilllink.test',
    password: DEMO_PASSWORD,
    role: 'worker',
    full_name: 'Femi Adeyemi',
    phone: '+2348088888888',
    location_label: 'Basorun, Ibadan',
    lat: 7.405,
    lng: 3.935,
    trade: 'Carpenter',
    bio: 'Furniture, wardrobes, door repairs, roofing timber and custom joinery. Waiting for verification review.',
    years_experience: 9,
    hourly_rate_kobo: 900_000,
    service_radius_m: 15_000,
    verified: false,
    verification: {
      id_type: 'nin',
      id_number_last4: '4821',
      selfie_url: 'https://example.com/demo/femi-selfie.jpg',
      certificate_url: 'https://example.com/demo/femi-certificate.pdf',
      notes: 'Carpentry certification submitted for review.',
    },
  },
  {
    email: 'ngozi@skilllink.test',
    password: DEMO_PASSWORD,
    role: 'worker',
    full_name: 'Ngozi Obi',
    phone: '+2348099999999',
    location_label: 'Jericho, Ibadan',
    lat: 7.345,
    lng: 3.945,
    trade: 'Painter',
    bio: 'Interior and exterior painting, screeding, POP finishing and colour consultation. Clean, neat and on schedule.',
    years_experience: 7,
    hourly_rate_kobo: 750_000,
    service_radius_m: 10_000,
    verified: true,
  },
  {
    email: 'suleiman@skilllink.test',
    password: DEMO_PASSWORD,
    role: 'worker',
    full_name: 'Suleiman Yakubu',
    phone: '+2348010101010',
    location_label: 'Akobo, Ibadan',
    lat: 7.39,
    lng: 3.98,
    trade: 'Generator Repair',
    bio: 'Generator servicing, fault repair, changeover installation and preventive maintenance. Documents under review.',
    years_experience: 11,
    hourly_rate_kobo: 1_100_000,
    service_radius_m: 18_000,
    verified: false,
    verification: {
      id_type: 'drivers_license',
      id_number_last4: '7390',
      selfie_url: 'https://example.com/demo/suleiman-selfie.jpg',
      notes: 'Generator repair experience documents submitted for review.',
    },
  },
];

const servicesByEmail = {
  'emeka@skilllink.test': [
    ['Brake inspection and replacement', 'Inspection, pad replacement and road test.', 1_500_000],
    ['Roadside breakdown diagnosis', 'On-site diagnosis for cars that will not start.', 1_700_000],
  ],
  'tunde@skilllink.test': [
    ['Electrical fault finding', 'Trace tripping, dead sockets and wiring faults.', 1_400_000],
    ['Socket and switch replacement', 'Supply and fit standard sockets and switches.', 900_000],
  ],
  'musa@skilllink.test': [
    ['Leak detection and repair', 'Find and fix leaks in kitchens, bathrooms and outdoor lines.', 1_300_000],
    ['Drain unblocking', 'Clear blocked drains and test water flow.', 1_000_000],
  ],
  'chinedu@skilllink.test': [
    ['Split AC servicing', 'Deep clean, filter wash and gas pressure check.', 2_400_000],
    ['AC installation', 'Mount and connect a split unit (materials extra).', 3_500_000],
  ],
  'aisha@skilllink.test': [
    ['Clothing alterations', 'Adjust fit for native or formal wear.', 1_000_000],
    ['Custom native wear', 'Measurements, tailoring and finishing.', 2_000_000],
  ],
  'ngozi@skilllink.test': [
    ['Interior room painting', 'Two coats with surface preparation.', 1_500_000],
    ['Exterior painting', 'Weather-resistant exterior finish.', 2_200_000],
  ],
};

const demoBookings = [
  {
    client: 'client@skilllink.test',
    worker: 'emeka@skilllink.test',
    trade: 'Mechanic',
    description: "My car won't start. I think it's the battery or starter. I'm parked at Bodija market and need help today.",
    address: 'Bodija Market, Ibadan',
    lat: 7.3775,
    lng: 3.947,
    urgency: 'asap',
    status: 'requested',
    priceKobo: 1_800_000,
    method: 'cash',
    daysAgo: 0,
  },
  {
    client: 'client@skilllink.test',
    worker: 'emeka@skilllink.test',
    trade: 'Mechanic',
    description: 'Brake pads replacement and a general check-up before a long trip.',
    address: 'Agodi GRA, Ibadan',
    lat: 7.3775,
    lng: 3.947,
    urgency: 'scheduled',
    status: 'completed',
    priceKobo: 1_500_000,
    method: 'card',
    daysAgo: 6,
    rating: 5,
    review: 'Emeka arrived quickly and explained everything. Very professional.',
  },
  {
    client: 'client@skilllink.test',
    worker: 'chinedu@skilllink.test',
    trade: 'AC Technician',
    description: 'Split AC is not cooling. Please service it and check the gas level.',
    address: 'Ring Road, Ibadan',
    lat: 7.3775,
    lng: 3.947,
    urgency: 'scheduled',
    status: 'completed',
    priceKobo: 2_400_000,
    method: 'transfer',
    daysAgo: 12,
    rating: 5,
    review: 'Excellent work. The AC is cooling perfectly now and the area was left clean.',
  },
  {
    client: 'client@skilllink.test',
    worker: 'aisha@skilllink.test',
    trade: 'Tailor',
    description: 'Adjust two native dresses for a wedding this weekend.',
    address: 'Dugbe, Ibadan',
    lat: 7.3775,
    lng: 3.947,
    urgency: 'scheduled',
    status: 'completed',
    priceKobo: 1_000_000,
    method: 'cash',
    daysAgo: 20,
    rating: 4,
    review: 'Good finishing and delivered on time. Will use again.',
  },
  {
    client: 'bola@skilllink.test',
    worker: 'tunde@skilllink.test',
    trade: 'Electrician',
    description: 'Living room sockets keep tripping the breaker. Please find the fault and rewire the sockets.',
    address: 'Ring Road, Ibadan',
    lat: 7.39,
    lng: 3.93,
    urgency: 'scheduled',
    status: 'completed',
    priceKobo: 1_400_000,
    method: 'transfer',
    daysAgo: 9,
    rating: 5,
    review: 'Tunde fixed a fault two other people missed. Very thorough.',
  },
  {
    client: 'bola@skilllink.test',
    worker: 'musa@skilllink.test',
    trade: 'Plumber',
    description: 'Kitchen sink is leaking and the outdoor drain is partially blocked.',
    address: 'Ring Road, Ibadan',
    lat: 7.39,
    lng: 3.93,
    urgency: 'asap',
    status: 'completed',
    priceKobo: 1_300_000,
    method: 'cash',
    daysAgo: 15,
    rating: 4,
    review: 'Sorted the leak and cleaned up afterwards. Fair price.',
  },
  {
    client: 'bola@skilllink.test',
    worker: 'ngozi@skilllink.test',
    trade: 'Painter',
    description: 'Paint two bedrooms and the hallway. Paint will be provided.',
    address: 'Ring Road, Ibadan',
    lat: 7.39,
    lng: 3.93,
    urgency: 'scheduled',
    status: 'completed',
    priceKobo: 1_500_000,
    method: 'card',
    daysAgo: 25,
    rating: 4,
    review: 'Neat job and polite team. The finish looks great.',
  },
];

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

async function ensureAuthUser(user) {
  const existing = await query('select id from auth.users where email = $1', [user.email]);
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.full_name,
      role: user.role === 'admin' ? 'client' : user.role,
      phone: user.phone,
      location_label: user.location_label,
      lat: user.lat,
      lng: user.lng,
      trade: user.trade,
      bio: user.bio,
      years_experience: user.years_experience,
      hourly_rate_kobo: user.hourly_rate_kobo,
      service_radius_m: user.service_radius_m,
    },
  });

  if (error) {
    throw new Error(`Failed to create ${user.email}: ${error.message}`);
  }

  return data.user.id;
}

async function ensurePublicUser(user, id) {
  await query(
    `insert into public.users (id, role, full_name, email, phone, location_label, base_location)
     values ($1, $2, $3, $4, $5, $6, st_setsrid(st_makepoint($7, $8), 4326)::geography)
     on conflict (id) do update set
       role = excluded.role,
       full_name = excluded.full_name,
       email = excluded.email,
       phone = excluded.phone,
       location_label = excluded.location_label,
       base_location = excluded.base_location,
       status = 'active'`,
    [id, user.role, user.full_name, user.email, user.phone, user.location_label, user.lng, user.lat],
  );

  if (user.role === 'worker') {
    await query(
      `insert into public.worker_profiles
         (user_id, trade, bio, years_experience, hourly_rate_kobo, service_radius_m,
          is_online, verification_status, verified_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (user_id) do update set
         trade = excluded.trade,
         bio = excluded.bio,
         years_experience = excluded.years_experience,
         hourly_rate_kobo = excluded.hourly_rate_kobo,
         service_radius_m = excluded.service_radius_m,
         is_online = excluded.is_online,
         verification_status = excluded.verification_status,
         verified_at = excluded.verified_at`,
      [
        id,
        user.trade,
        user.bio,
        user.years_experience,
        user.hourly_rate_kobo,
        user.service_radius_m,
        user.verified,
        user.verified ? 'verified' : 'pending',
        user.verified ? new Date().toISOString() : null,
      ],
    );

    const services = servicesByEmail[user.email] ?? [];
    if (services.length > 0) {
      await query('delete from public.services where worker_id = $1', [id]);
      for (const [title, description, price] of services) {
        await query(
          `insert into public.services (worker_id, title, description, pricing_type, price_kobo)
           values ($1, $2, $3, 'fixed', $4)`,
          [id, title, description, price],
        );
      }
    }

    if (user.verification) {
      const pending = await query(
        "select id from public.verification_submissions where worker_id = $1 and status = 'pending'",
        [id],
      );
      if (!pending.rows[0]) {
        await query(
          `insert into public.verification_submissions
             (worker_id, id_type, id_number_last4, selfie_url, certificate_url, "references", notes)
           values ($1, $2, $3, $4, $5, '[]'::jsonb, $6)`,
          [
            id,
            user.verification.id_type,
            user.verification.id_number_last4 ?? null,
            user.verification.selfie_url,
            user.verification.certificate_url ?? null,
            user.verification.notes ?? null,
          ],
        );
      }
    }
  }

  await query(
    `insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
     values (null, 'seed.user.upserted', 'user', $1, $2::jsonb)`,
    [id, JSON.stringify({ email: user.email, role: user.role })],
  );
}

async function seedBooking(booking, ids) {
  const clientId = ids.get(booking.client);
  const workerId = ids.get(booking.worker);

  const createdAt = isoDaysAgo(booking.daysAgo);
  const acceptedAt = booking.daysAgo === 0 ? null : isoDaysAgo(booking.daysAgo - 0.02);
  const completedAt = booking.status === 'completed' ? isoDaysAgo(booking.daysAgo - 0.15) : null;
  const scheduledStart = booking.urgency === 'scheduled' ? isoDaysAgo(booking.daysAgo) : null;
  const scheduledEnd = booking.urgency === 'scheduled'
    ? new Date(new Date(scheduledStart).getTime() + 2 * 3_600_000).toISOString()
    : null;
  const expiresAt = booking.status === 'requested'
    ? new Date(Date.now() + 5 * 60_000).toISOString()
    : null;

  const inserted = await query(
    `insert into public.bookings
       (public_ref, client_id, worker_id, trade, description, address, location, urgency,
        scheduled_start, scheduled_end, status, estimated_price_kobo, final_price_kobo,
        payment_method, payment_status, accepted_at, completed_at, expires_at, created_at)
     values ($1, $2, $3, $4, $5, $6, st_setsrid(st_makepoint($7, $8), 4326)::geography,
             $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
     returning id`,
    [
      generatePublicRef(new Date(createdAt)),
      clientId,
      workerId,
      booking.trade,
      booking.description,
      booking.address,
      booking.lng,
      booking.lat,
      booking.urgency,
      scheduledStart,
      scheduledEnd,
      booking.status,
      booking.priceKobo,
      booking.status === 'completed' ? booking.priceKobo : null,
      booking.method,
      booking.status === 'completed' ? 'paid' : 'pending',
      acceptedAt,
      completedAt,
      expiresAt,
      createdAt,
    ],
  );

  const bookingId = inserted.rows[0].id;

  await query(
    `insert into public.booking_events (booking_id, from_status, to_status, actor_id, note, created_at)
     values ($1, null, 'requested', $2, 'Booking created by client.', $3)`,
    [bookingId, clientId, createdAt],
  );

  if (acceptedAt) {
    await query(
      `insert into public.booking_events (booking_id, from_status, to_status, actor_id, note, created_at)
       values ($1, 'requested', 'accepted', $2, 'Worker accepted the job.', $3)`,
      [bookingId, workerId, acceptedAt],
    );
  }

  if (completedAt) {
    const statuses = [
      ['accepted', 'en_route', acceptedAt, 'Worker is on the way.'],
      ['en_route', 'arrived', acceptedAt, 'Worker arrived at the location.'],
      ['arrived', 'in_progress', acceptedAt, 'Job started.'],
      ['in_progress', 'completed', completedAt, 'Job marked complete.'],
    ];
    for (const [from, to, at, note] of statuses) {
      await query(
        `insert into public.booking_events (booking_id, from_status, to_status, actor_id, note, created_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [bookingId, from, to, workerId, note, at],
      );
    }
  }

  if (booking.rating) {
    await query(
      `insert into public.reviews (booking_id, client_id, worker_id, rating, comment, created_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [bookingId, clientId, workerId, booking.rating, booking.review, completedAt],
    );
  }
}

async function main() {
  console.log('Seeding SkillLink MVP...');

  const tradesSql = fs.readFileSync(path.join(projectRoot, 'supabase/seed.sql'), 'utf8');
  await query(tradesSql);

  const bookingCount = await query('select count(*)::int as count from public.bookings');
  if (bookingCount.rows[0].count > 0) {
    console.log('Bookings already exist. Seed skipped to avoid duplicates.');
    console.log('Drop the public schema tables or use a fresh Supabase project to reseed.');
    return;
  }

  const ids = new Map();

  for (const user of demoUsers) {
    const id = await ensureAuthUser(user);
    await ensurePublicUser(user, id);
    ids.set(user.email, id);
    console.log(`  ready: ${user.email} (${user.role})`);
  }

  for (const booking of demoBookings) {
    await seedBooking(booking, ids);
  }

  await query(
    `update public.worker_profiles wp set
       rating_avg = coalesce((select round(avg(r.rating), 2) from public.reviews r where r.worker_id = wp.user_id), 0),
       rating_count = (select count(*) from public.reviews r where r.worker_id = wp.user_id),
       jobs_completed = (select count(*) from public.bookings b where b.worker_id = wp.user_id and b.status = 'completed')
     where wp.user_id in (
       select id from public.users where email = any($1::text[])
     )`,
    [[...ids.keys()]],
  );

  console.log('');
  console.log('Seed complete.');
  console.log('Demo accounts:');
  console.log(`  client@skilllink.test  / ${DEMO_PASSWORD}`);
  console.log(`  emeka@skilllink.test   / ${DEMO_PASSWORD}`);
  console.log(`  admin@skilllink.test   / ${ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);

    if (error?.code === '28P01') {
      console.error('');
      console.error('Database password authentication failed.');
      console.error('Copy the current Session pooler connection string from Supabase Dashboard -> Project Settings -> Database,');
      console.error('then replace DATABASE_URL in .env. If the password is unknown, reset it in the dashboard first.');
    } else if (error?.code === 'ENOTFOUND') {
      console.error('');
      console.error('The database host could not be resolved.');
      console.error('Use the Session pooler connection string instead of the direct db.<ref>.supabase.co host.');
    } else if (error?.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
      console.error('');
      console.error('The database TLS certificate could not be verified.');
      console.error('Use sslmode=require with the Supabase pooler, or configure the Supabase CA and use sslmode=verify-full.');
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
