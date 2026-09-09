const CATEGORIES = [
  'food',
  'transport',
  'housing',
  'utilities',
  'health',
  'entertainment',
  'other'
];

function today() {
  return new Date().toISOString().slice(0, 10);
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
    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) {
      errors.push('date must be a valid date');
    } else {
      value.date = date.toISOString().slice(0, 10);
    }
  } else if (!partial) {
    value.date = today();
  }

  return { errors, value };
}

module.exports = { CATEGORIES, validateExpense };
