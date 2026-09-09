// One import for the pages, two possible backends behind it.
//
// VITE_DATA_BACKEND=supabase switches the app onto Supabase; anything else (the
// default) keeps it on the Express API. Both export the same names, so the
// switch is an environment variable and a rebuild — and so is the way back.

import * as rest from '../api.js';
import * as supabase from './supabase.js';

export const backend = import.meta.env.VITE_DATA_BACKEND === 'supabase' ? 'supabase' : 'api';

const chosen = backend === 'supabase' ? supabase : rest;
const reported = new Set();

// Anything the Supabase layer does not implement falls through to the REST one,
// which keeps the switch honest: a missing function is a real gap, not a silent
// no-op, and the console says which — once per name, not once per call.
function pick(name) {
  if (name in chosen) return chosen[name];
  if (backend === 'supabase' && !reported.has(name)) {
    reported.add(name);
    console.warn(`[data] ${name}() is not implemented on Supabase yet; using the API`);
  }
  return rest[name];
}

// The bindings are static so the bundler can see them, but the choice happens
// on the call: importing this module never commits to a backend by itself.
const bind = (name) => (...args) => pick(name)(...args);

export const setUnauthorisedHandler = bind('setUnauthorisedHandler');
export const authHeaders = bind('authHeaders');
export const register = bind('register');
export const login = bind('login');
export const logout = bind('logout');
export const recoverAccount = bind('recoverAccount');
export const changePassword = bind('changePassword');
export const requestPasswordReset = bind('requestPasswordReset');
export const recoveryCodeCount = bind('recoveryCodeCount');
export const regenerateRecoveryCodes = bind('regenerateRecoveryCodes');
export const listExpenses = bind('listExpenses');
export const listCategories = bind('listCategories');
export const createExpense = bind('createExpense');
export const updateExpense = bind('updateExpense');
export const deleteExpense = bind('deleteExpense');
export const getSummary = bind('getSummary');
export const listRecurring = bind('listRecurring');
export const createRecurring = bind('createRecurring');
export const deleteRecurring = bind('deleteRecurring');
export const applyRecurring = bind('applyRecurring');
export const listBudgets = bind('listBudgets');
export const setBudget = bind('setBudget');
export const exportCsv = bind('exportCsv');
export const importCsv = bind('importCsv');
export const getSettings = bind('getSettings');
export const saveSettings = bind('saveSettings');
export const uploadReceipt = bind('uploadReceipt');
export const receiptUsage = bind('receiptUsage');
export const fetchReceipt = bind('fetchReceipt');
export const deleteReceipt = bind('deleteReceipt');
export const previewStatement = bind('previewStatement');
export const importStatement = bind('importStatement');
export const listAccounts = bind('listAccounts');
export const createAccount = bind('createAccount');
export const removeAccount = bind('removeAccount');
export const listGoals = bind('listGoals');
export const createGoal = bind('createGoal');
export const updateGoal = bind('updateGoal');
export const removeGoal = bind('removeGoal');
export const deleteGoal = bind('deleteGoal');
export const contributeGoal = bind('contributeGoal');
export const addToGoal = bind('addToGoal');
export const listContributions = bind('listContributions');
