// One import for the pages, one backend behind it.
//
// This was a switch between the Express API and Supabase while both existed.
// The API is gone, so the indirection is kept only so no page imports the
// Supabase client directly — a second backend, if there is ever one, goes here.

export * from './supabase.js';

export const backend = 'supabase';
