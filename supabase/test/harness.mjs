import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const migrations = join(here, '..', 'migrations');

// Supabase's own pieces are not here (no Docker), so the harness recreates the
// two things the migrations depend on: an auth.users table and auth.uid(),
// which reads the caller's claim exactly as Supabase's does. The policies under
// test are then the real ones, run by a real Postgres.
const SUPABASE_SHIM = `
  create schema if not exists auth;

  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );

  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
  -- service_role is BYPASSRLS on Supabase; the tests never use it, and granting
  -- that attribute needs a superuser, so the shim leaves it ordinary.
  do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;

  grant usage on schema public, auth to anon, authenticated, service_role;
  -- SET ROLE is only allowed into a role you are a member of.
  grant anon, authenticated, service_role to current_user;
  alter default privileges in schema public
    grant select, insert, update, delete on tables to authenticated;
  alter default privileges in schema public grant execute on functions to authenticated;
`;

export async function freshDatabase(name) {
  const admin = new pg.Client({ connectionString: process.env.ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${name}`);
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(process.env.ADMIN_URL);
  url.pathname = `/${name}`;
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();

  await db.query(SUPABASE_SHIM);
  for (const file of readdirSync(migrations).filter((f) => f.endsWith('.sql')).sort()) {
    await db.query(readFileSync(join(migrations, file), 'utf8'));
  }
  // Grants have to follow the tables the migrations created.
  await db.query(`
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant execute on all functions in schema public to authenticated;
    grant select on all tables in schema public to anon;
  `);

  return db;
}

/** Runs `work` as a signed-in user, the way PostgREST does per request. */
export async function asUser(db, userId, work) {
  await db.query('begin');
  try {
    await db.query('select set_config($1, $2, true)', ['request.jwt.claim.sub', userId ?? '']);
    await db.query(`set local role ${userId ? 'authenticated' : 'anon'}`);
    return await work();
  } finally {
    await db.query('rollback');
  }
}

export async function createUser(db, email) {
  const { rows } = await db.query(
    'insert into auth.users (email) values ($1) returning id',
    [email]
  );
  return rows[0].id;
}
