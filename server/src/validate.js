const CATEGORIES = [
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
  return /^\d{4}-\d{2}$/.test(value) && Number(value.slice(5, 7)) >= 1 && Number(value.slice(5, 7)) <= 12;
}

function validateExpense(body, { partial = false } = {}) {
  const errors = [];
  const value = {};
  const input = body && typeof body === 'object' ? body : {};

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

  if (input.category !== undefined) {
    if (!CATEGORIES.includes(input.category)) {
      errors.push(`category must be one of: ${CATEGORIES.join(', ')}`);
    } else {
      value.category = input.category;
    }
  } else if (!partial) {
    value.category = 'other';
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

  if (query.category) {
    if (!CATEGORIES.includes(query.category)) errors.push('unknown category filter');
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

module.exports = {
  CATEGORIES,
  validateExpense,
  validateBudget,
  validateRecurring,
  parseFilters,
  isIsoDate,
  isIsoMonth,
  today
};
