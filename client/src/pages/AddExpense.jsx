import { useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import Icon, { CATEGORY_ICON } from '../components/Icon.jsx';
import { todayIso, titleCase, formatDay } from '../format.js';
import { uploadReceipt } from '../api.js';

const METHOD_LABEL = {
  upi: 'UPI',
  card: 'Card',
  cash: 'Cash',
  bank_transfer: 'Bank transfer'
};

export default function AddExpense() {
  const { categories, accounts, submitting, handlers } = useOutletContext();
  const navigate = useNavigate();
  const fileInput = useRef(null);

  const [kind, setKind] = useState('expense');
  const [form, setForm] = useState({
    amount: '',
    description: '',
    category: 'other',
    date: todayIso(),
    paymentMethod: 'upi',
    accountId: '',
    note: ''
  });
  const [receipt, setReceipt] = useState(null);
  const [uploadError, setUploadError] = useState('');

  const list = kind === 'income' ? categories.income : categories.expense;
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  function switchKind(nextKind) {
    setKind(nextKind);
    const nextList = nextKind === 'income' ? categories.income : categories.expense;
    setForm((current) => ({ ...current, category: nextList[0] }));
  }

  async function attach(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadError('');
    try {
      const uploaded = await uploadReceipt(file);
      setReceipt({ ...uploaded, name: file.name });
    } catch (err) {
      setUploadError(err.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const created = await handlers.create({
      kind,
      description: form.description,
      amount: form.amount,
      category: form.category,
      date: form.date,
      paymentMethod: form.paymentMethod,
      note: form.note,
      accountId: form.accountId || null,
      receiptId: receipt?.id ?? null
    });
    if (created) navigate('/transactions');
  }

  return (
    <form className="card add-form" onSubmit={submit}>
      <div className="kind-toggle" role="group" aria-label="Transaction type">
        {['expense', 'income'].map((option) => (
          <button
            key={option}
            type="button"
            className={kind === option ? 'segment active' : 'segment'}
            onClick={() => switchKind(option)}
          >
            {titleCase(option)}
          </button>
        ))}
      </div>

      <label className="amount-field">
        Amount
        <span className="amount-input">
          <span aria-hidden="true">₹</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={update('amount')}
            placeholder="0"
            required
            autoFocus
          />
        </span>
      </label>

      <label>
        Description
        <input
          type="text"
          value={form.description}
          onChange={update('description')}
          placeholder={kind === 'income' ? 'Salary' : 'Groceries'}
          required
        />
      </label>

      <fieldset className="category-grid">
        <legend>Category</legend>
        {list.map((category) => (
          <button
            key={category}
            type="button"
            className={form.category === category ? 'category-tile active' : 'category-tile'}
            onClick={() => setForm({ ...form, category })}
            aria-pressed={form.category === category}
          >
            <Icon name={CATEGORY_ICON[category] || 'other'} size={20} />
            <span>{titleCase(category)}</span>
          </button>
        ))}
      </fieldset>

      <label>
        Date
        <span className="date-row">
          <Icon name="calendar" size={17} />
          <input
            type="date"
            value={form.date}
            max={todayIso()}
            onChange={update('date')}
            required
          />
          <span className="hint">{formatDay(form.date)}</span>
        </span>
      </label>

      <label>
        Account
        <select value={form.accountId} onChange={update('accountId')}>
          <option value="">Unassigned</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="segmented">
        <legend>Payment method</legend>
        {(categories.paymentMethods || []).map((method) => (
          <button
            key={method}
            type="button"
            className={form.paymentMethod === method ? 'segment active' : 'segment'}
            onClick={() => setForm({ ...form, paymentMethod: method })}
            aria-pressed={form.paymentMethod === method}
          >
            {METHOD_LABEL[method] || titleCase(method)}
          </button>
        ))}
      </fieldset>

      <label>
        Note (optional)
        <input type="text" value={form.note} onChange={update('note')} placeholder="Add a note" />
      </label>

      <button type="button" className="attach" onClick={() => fileInput.current.click()}>
        <Icon name="camera" size={18} />
        {receipt ? `Attached: ${receipt.name}` : 'Attach receipt'}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="image/*,application/pdf"
        onChange={attach}
        hidden
      />
      {uploadError && <p className="error">{uploadError}</p>}

      <div className="button-row">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : `Save ${kind}`}
        </button>
        <button type="button" className="secondary" onClick={() => navigate(-1)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
