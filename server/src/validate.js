const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'housing',
  'utilities',
  'health',
  'entertainment',
  'education',
  'shopping',
  'other'
];

const INCOME_CATEGORIES = ['salary', 'freelance', 'interest', 'refund', 'other income'];

const KINDS = ['expense', 'income'];
// Icons a goal may carry; each one exists in the client's Icon sprite.
const GOAL_ICONS = [
  'target',
  'savings',
  'laptop',
  'transport',
  'housing',
  'education',
  'health',
  'entertainment',
  'briefcase',
  'other'
];
const PAYMENT_METHODS = ['upi', 'card', 'cash', 'bank_transfer'];

// Kept for the existing expense-only endpoints and the CSV importer.
const CATEGORIES = EXPENSE_CATEGORIES;

function categoriesFor(kind) {
  return kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

const SORT_COLUMNS = {
  date: 'date',
  amount: 'amount',
  description: 'description',
  category: 'category'
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  // reject dates that parse but roll over, e.g. 2026-02-31 becoming 2026-03-03
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isIsoMonth(value) {
  return (
    /^\d{4}-\d{2}$/.test(value) && Number(value.slice(5, 7)) >= 1 && Number(value.slice(5, 7)) <= 12
  );
}

function validateExpense(body, { partial = false, existingKind = 'expense' } = {}) {
  const errors = [];
  const value = {};
  const input = body && typeof body === 'object' ? body : {};

  let kind = existingKind;
  if (input.kind !== undefined) {
    if (!KINDS.includes(input.kind)) {
      errors.push(`kind must be one of: ${KINDS.join(', ')}`);
    } else {
      kind = input.kind;
      value.kind = kind;
    }
  } else if (!partial) {
    kind = 'expense';
    value.kind = kind;
  }

  if (input.description !== undefined) {
    if (typeof input.description !== 'string' || input.description.trim() === '') {
      errors.push('description must be a non-empty string');
    } else {
      value.description = input.description.trim().slice(0, 200);
    }
  } else if (!partial) {
    errors.push('description is required');
  }

  if (input.amount !== undefined) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push('amount must be a positive number');
    } else if (amount > 9999999999) {
      errors.push('amount is too large');
    } else {
      value.amount = Math.round(amount * 100) / 100;
    }
  } else if (!partial) {
    errors.push('amount is required');
  }

  const allowed = categoriesFor(kind);
  if (input.category !== undefined) {
    if (!allowed.includes(input.category)) {
      errors.push(`category for a ${kind} must be one of: ${allowed.join(', ')}`);
    } else {
      value.category = input.category;
    }
  } else if (!partial) {
    value.category = kind === 'income' ? 'salary' : 'other';
  }

  if (
    input.paymentMethod !== undefined &&
    input.paymentMethod !== null &&
    input.paymentMethod !== ''
  ) {
    if (!PAYMENT_METHODS.includes(input.paymentMethod)) {
      errors.push(`paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}`);
    } else {
      value.paymentMethod = input.paymentMethod;
    }
  } else if (input.paymentMethod === null || input.paymentMethod === '') {
    value.paymentMethod = null;
  }

  if (input.accountId !== undefined) {
    if (input.accountId === null || input.accountId === '') value.accountId = null;
    else if (
      typeof input.accountId === 'string' &&
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.accountId)
    )
      value.accountId = input.accountId;
    else errors.push('accountId must be a valid account');
  }

  if (input.note !== undefined) {
    if (typeof input.note !== 'string') errors.push('note must be a string');
    else value.note = input.note.trim().slice(0, 500);
  }

  if (input.date !== undefined) {
    const date = typeof input.date === 'string' ? input.date.slice(0, 10) : '';
    if (!isIsoDate(date)) {
      errors.push('date must be a valid YYYY-MM-DD date');
    } else {
      value.date = date;
    }
  } else if (!partial) {
    value.date = today();
  }

  return { errors, value };
}

function validateBudget(body) {
  const errors = [];
  const value = {};
  const input = body && typeof body === 'object' ? body : {};

  const limit = Number(input.monthlyLimit);
  if (!Number.isFinite(limit) || limit < 0) {
    errors.push('monthlyLimit must be a number of zero or more');
  } else if (limit > 9999999999) {
    errors.push('monthlyLimit is too large');
  } else {
    value.monthlyLimit = Math.round(limit * 100) / 100;
  }

  return { errors, value };
}

function parseFilters(query) {
  const errors = [];
  const filters = {};

  if (query.kind) {
    if (!KINDS.includes(query.kind)) errors.push('unknown kind filter');
    else filters.kind = query.kind;
  }

  if (query.paymentMethod) {
    if (!PAYMENT_METHODS.includes(query.paymentMethod)) errors.push('unknown paymentMethod filter');
    else filters.paymentMethod = query.paymentMethod;
  }

  if (query.category) {
    const known = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
    if (!known.includes(query.category)) errors.push('unknown category filter');
    else filters.category = query.category;
  }

  for (const key of ['from', 'to']) {
    if (query[key]) {
      if (!isIsoDate(query[key])) errors.push(`${key} must be a YYYY-MM-DD date`);
      else filters[key] = query[key];
    }
  }

  if (query.q && String(query.q).trim() !== '') {
    filters.q = String(query.q).trim().slice(0, 100);
  }

  filters.sort = SORT_COLUMNS[query.sort] || 'date';
  filters.order = String(query.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  return { errors, filters };
}

function validateRecurring(body, { partial = false } = {}) {
  const { errors, value } = validateExpense({ ...body, date: undefined }, { partial });
  const input = body && typeof body === 'object' ? body : {};

  if (input.dayOfMonth !== undefined) {
    const day = Number(input.dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      errors.push('dayOfMonth must be a whole number from 1 to 28');
    } else {
      value.dayOfMonth = day;
    }
  } else if (!partial) {
    errors.push('dayOfMonth is required');
  }

  delete value.date;
  return { errors, value };
}

function validateGoal(body, { partial = false } = {}) {
  const errors = [];
  const value = {};
  const input = body && typeof body === 'object' ? body : {};

  if (input.name !== undefined) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (name === '') errors.push('name is required');
    else value.name = name.slice(0, 60);
  } else if (!partial) {
    errors.push('name is required');
  }

  if (input.target !== undefined) {
    const target = Number(input.target);
    if (!Number.isFinite(target) || target <= 0) errors.push('target must be greater than zero');
    else if (target > 9999999999) errors.push('target is too large');
    else value.target = Math.round(target * 100) / 100;
  } else if (!partial) {
    errors.push('target is required');
  }

  if (input.saved !== undefined) {
    const saved = Number(input.saved);
    if (!Number.isFinite(saved) || saved < 0) errors.push('saved must be zero or more');
    else if (saved > 9999999999) errors.push('saved is too large');
    else value.saved = Math.round(saved * 100) / 100;
  }

  if (input.icon !== undefined) {
    if (!GOAL_ICONS.includes(input.icon)) errors.push('unknown goal icon');
    else value.icon = input.icon;
  } else if (!partial) {
    value.icon = 'target';
  }

  return { errors, value };
}

function validateContribution(body) {
  const errors = [];
  const input = body && typeof body === 'object' ? body : {};
  const amount = Number(input.amount);

  if (!Number.isFinite(amount) || amount <= 0) errors.push('amount must be greater than zero');
  else if (amount > 9999999999) errors.push('amount is too large');

  return { errors, amount: Math.round(amount * 100) / 100 };
}

function validateSetting(key, rawValue) {
  const errors = [];
  let value = null;

  if (key === 'displayName') {
    if (typeof rawValue !== 'string') errors.push('displayName must be a string');
    else value = rawValue.trim().slice(0, 60);
  } else if (key === 'monthlyBudget') {
    const amount = Number(rawValue);
    if (!Number.isFinite(amount) || amount < 0) errors.push('monthlyBudget must be zero or more');
    else if (amount > 9999999999) errors.push('monthlyBudget is too large');
    else value = String(Math.round(amount * 100) / 100);
  } else {
    errors.push(`unknown setting: ${key}`);
  }

  return { errors, value };
}

module.exports = {
  CATEGORIES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  KINDS,
  PAYMENT_METHODS,
  GOAL_ICONS,
  categoriesFor,
  validateSetting,
  validateExpense,
  validateBudget,
  validateRecurring,
  validateGoal,
  validateContribution,
  parseFilters,
  isIsoDate,
  isIsoMonth,
  today
};
