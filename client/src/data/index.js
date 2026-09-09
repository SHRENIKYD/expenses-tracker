// One import for the pages, two possible backends behind it.
//
// VITE_DATA_BACKEND=supabase switches the app onto Supabase; anything else (the
// default) keeps it on the Express API. Both export the same names, so the
// switch is an environment variable and a rebuild — and so is the way back.

import * as rest from '../api.js';
import * as supabase from './supabase.js';

export const backend = import.meta.env.VITE_DATA_BACKEND === 'supabase' ? 'supabase' : 'api';

const chosen = backend === 'supabase' ? supabase : rest;

// Anything the Supabase layer does not implement falls through to the REST one,
// which keeps the switch honest: a missing function is a real gap, not a silent
// no-op, and the console says which.
const data = new Proxy(
  {},
  {
    get(_target, name) {
      if (name in chosen) return chosen[name];
      if (name in rest) {
        if (backend === 'supabase' && typeof name === 'string') {
          console.warn(`[data] ${name}() is not implemented on Supabase yet; using the API`);
        }
        return rest[name];
      }
      return undefined;
    },
    has: (_target, name) => name in chosen || name in rest
  }
);

export default data;
