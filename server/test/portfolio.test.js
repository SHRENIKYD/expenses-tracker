const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const root = require('node:path').resolve(__dirname, '..');
const express = require(root + '/node_modules/express');
const { pool, init } = require(root + '/src/db');
require('node:test')(
  'portfolio routes preserve ownership, balances and expense totals',
  async () => {
    const db = new PGlite();
    pool.query = async (sql, params) => {
      const r = await db.query(sql, params);
      return { rows: r.rows, rowCount: r.rows.length || r.affectedRows || 0 };
    };
    await init();
    await init();
    const a = (
      await pool.query(
        "INSERT INTO users(email,password_hash) VALUES ('a@example.invalid','test') RETURNING id"
      )
    ).rows[0].id;
    const b = (
      await pool.query(
        "INSERT INTO users(email,password_hash) VALUES ('b@example.invalid','test') RETURNING id"
      )
    ).rows[0].id;
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { id: req.headers['x-test-user'] || a };
      next();
    });
    for (const route of ['accounts', 'goals', 'expenses', 'summary'])
      app.use('/' + route, require(root + '/src/routes/' + route));
    app.use((err, req, res, next) => res.status(500).json({ error: err.message }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const base = 'http://127.0.0.1:' + server.address().port;
    async function call(path, method = 'GET', body, user = a, status = 200) {
      const res = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-test-user': user },
        body: body ? JSON.stringify(body) : undefined
      });
      const text = await res.text();
      assert.equal(res.status, status, method + ' ' + path + ' ' + text);
      return text ? JSON.parse(text) : null;
    }
    try {
      const account = await call(
        '/accounts',
        'POST',
        { name: 'Bank', openingBalance: 1000 },
        a,
        201
      );
      const goal = await call('/goals', 'POST', { name: 'Laptop', target: 75000 }, a, 201);
    const existingGoal = (await pool.query("INSERT INTO goals(user_id,name,target_amount,saved_amount) VALUES ($1,'Existing goal',1000,400) RETURNING id", [a])).rows[0];
    await call('/goals/' + existingGoal.id + '/contributions', 'POST', { amount: 100 }, a, 201);
    assert.equal((await call('/goals')).find(row => row.id === existingGoal.id).saved, 500);
    await call('/goals/' + existingGoal.id, 'DELETE', null, a, 204);
      assert.deepEqual(await call('/accounts', 'GET', null, b), []);
      assert.deepEqual(await call('/goals', 'GET', null, b), []);
      await call('/goals/' + goal.id + '/contributions', 'POST', { amount: 45000 }, b, 404);
      await call('/goals/' + goal.id, 'DELETE', null, b, 404);
      await call('/accounts/' + account.id, 'DELETE', null, b, 404);
      const expense = {
        description: 'Groceries',
        amount: 250,
        category: 'food',
        date: '2026-09-09',
        accountId: account.id
      };
      await call('/expenses', 'POST', expense, b, 400);
      const txn = await call('/expenses', 'POST', expense, a, 201);
      await call(
        '/expenses',
        'POST',
        {
          ...expense,
          description: 'Salary',
          kind: 'income',
          category: 'salary',
          amount: 80000
        },
        a,
        201
      );
      assert.equal((await call('/accounts'))[0].balance, 80750);
      await call('/accounts/' + account.id, 'DELETE', null, a, 409);
      await call('/goals/' + goal.id + '/contributions', 'POST', { amount: 45000 }, a, 201);
      assert.equal((await call('/goals'))[0].saved, 45000);
      assert.equal((await call('/summary?month=2026-09')).total, 250);
      assert.equal((await call('/summary?month=2026-09')).income, 80000);
      await call('/goals/' + goal.id + '/contributions', 'POST', { amount: 0 }, a, 400);
      await call('/goals/' + goal.id + '/contributions', 'POST', { amount: 0.001 }, a, 400);
    await call('/goals/' + goal.id + '/contributions', 'POST', { amount: 1e-12 }, a, 400);
      await call('/goals', 'POST', { name: '', target: 100 }, a, 400);
      await call('/accounts', 'POST', { name: 'Bad', openingBalance: true }, a, 400);
      const foreign = (await call('/accounts', 'POST', { name: 'B bank' }, b, 201)).id;
      await call('/expenses/' + txn.id, 'PUT', { accountId: foreign }, a, 400);
      await call('/expenses/' + txn.id, 'PUT', { accountId: null }, a, 200);
      assert.equal((await call('/accounts'))[0].balance, 81000);
      await call('/expenses/' + txn.id, 'PUT', { accountId: account.id }, a, 200);
      assert.equal((await call('/goals/' + goal.id + '/contributions')).length, 1);
      assert.equal((await call('/goals/' + goal.id + '/contributions', 'GET', null, b)).length, 0);
      const sep = await call('/expenses?from=2026-09-01&to=2026-09-30');
      assert.equal(sep.length, 2);
      assert.equal((await call('/expenses?from=2026-08-01&to=2026-08-31')).length, 0);
      await assert.rejects(
        () =>
          pool.query(
            'INSERT INTO expenses(user_id,description,amount,category,date,account_id) VALUES ($1,$2,1,$3,$4,$5)',
            [b, 'Blocked', 'food', '2026-09-09', account.id]
          ),
        (err) => err.code === '23503'
      );
      await call('/goals/' + goal.id, 'DELETE', null, a, 204);
      assert.deepEqual(await call('/goals'), []);
      assert.equal((await pool.query('SELECT * FROM goal_contributions')).rows.length, 0);
      console.log(
        'PASS: repeatable schema, user isolation, account balances and assignment, goal contributions, validation, month filters, unchanged expense totals, contribution cleanup.'
      );
    } finally {
      server.close();
      await db.close();
    }
  }
);
