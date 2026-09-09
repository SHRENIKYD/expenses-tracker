const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hashPassword,
  verifyPassword,
  validateCredentials,
  validatePassword,
  newRecoveryCode,
  normaliseCode
} = require('../src/auth');

test('a password hash is salted, so the same password hashes differently each time', async () => {
  const a = await hashPassword('correct horse battery');
  const b = await hashPassword('correct horse battery');
  assert.notEqual(a, b);
  assert.ok(a.startsWith('scrypt$'));
});

test('the correct password verifies and a wrong one does not', async () => {
  const stored = await hashPassword('correct horse battery');
  assert.equal(await verifyPassword('correct horse battery', stored), true);
  assert.equal(await verifyPassword('correct horse batteru', stored), false);
  assert.equal(await verifyPassword('', stored), false);
});

test('a malformed stored hash is rejected rather than throwing', async () => {
  assert.equal(await verifyPassword('anything', 'not-a-hash'), false);
  assert.equal(await verifyPassword('anything', 'bcrypt$salt$hash'), false);
});

test('the plaintext password never appears in the stored hash', async () => {
  const stored = await hashPassword('correct horse battery');
  assert.ok(!stored.includes('correct'));
  assert.ok(!stored.includes('battery'));
});

test('credentials require a real email and an eight character password', () => {
  assert.ok(validateCredentials({ email: 'nope', password: 'longenough' }).errors.length);
  assert.ok(validateCredentials({ email: 'a@b.co', password: 'short' }).errors.length);
  assert.deepEqual(validateCredentials({ email: 'a@b.co', password: 'longenough' }).errors, []);
});

test('emails are normalised so casing and spacing cannot create duplicate accounts', () => {
  const { value } = validateCredentials({ email: '  Me@Example.COM  ', password: 'longenough' });
  assert.equal(value.email, 'me@example.com');
});

test('an over-long password is rejected rather than silently truncated', () => {
  assert.ok(validateCredentials({ email: 'a@b.co', password: 'x'.repeat(201) }).errors.length);
});

test('a recovery code is readable aloud and free of look-alike characters', () => {
  const code = newRecoveryCode();
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(/[OI01]/.test(code), false);
});

test('recovery codes are unique across a large batch', () => {
  const codes = new Set(Array.from({ length: 500 }, newRecoveryCode));
  assert.equal(codes.size, 500);
});

test('a code is matched however it was typed back in', () => {
  assert.equal(normaliseCode('abcd-efgh-jklm'), 'ABCDEFGHJKLM');
  assert.equal(normaliseCode('ABCD EFGH JKLM'), 'ABCDEFGHJKLM');
  assert.equal(normaliseCode(' abcdefghjklm '), 'ABCDEFGHJKLM');
});

test('a new password has to clear the same bar as a registered one', () => {
  assert.equal(validatePassword('longenough1'), null);
  assert.equal(validatePassword('short'), 'password must be at least 8 characters');
  assert.equal(validatePassword(''), 'password must be at least 8 characters');
  assert.equal(validatePassword(undefined), 'password must be at least 8 characters');
  assert.equal(validatePassword('x'.repeat(201)), 'password must be 200 characters or fewer');
});
