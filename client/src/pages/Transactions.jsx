import { useOutletContext } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Filters from '../components/Filters.jsx';
import ExpenseTable from '../components/ExpenseTable.jsx';
import ImportExport from '../components/ImportExport.jsx';
import StatementImport from '../components/StatementImport.jsx';
import { emptyFilters } from '../useExpensesData.js';
import { formatMoney } from '../format.js';

export default function Transactions() {
  const { expenses, accounts, categories, filters, setFilters, sort, order, loading, handlers } =
    useOutletContext();

  const income = expenses.filter((row) => row.kind === 'income').reduce((sum, row) => sum + row.amount, 0);
  const spend = expenses.filter((row) => row.kind !== 'income').reduce((sum, row) => sum + row.amount, 0);

  return (
    <>
      <Filters
        categories={categories.expense}
        incomeCategories={categories.income}
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(emptyFilters)}
      />

      <section className="card">
        <div className="card-head">
          <h2>
            <Icon name="list" size={19} strokeWidth={1.9} />
            Transactions
          </h2>
          <span className="hint">
            {expenses.length} matching · {formatMoney(income)} in · {formatMoney(spend)} out
          </span>
        </div>

        <div className={loading ? 'refreshing' : undefined}>
          <ExpenseTable
            expenses={expenses}
            accounts={accounts}
            categories={categories.expense}
            incomeCategories={categories.income}
            paymentMethods={categories.paymentMethods}
            sort={sort}
            order={order}
            onSort={handlers.sortBy}
            onSave={handlers.update}
            onDelete={handlers.remove}
          />
        </div>
      </section>

      <div className="two-col">
        <StatementImport onImported={handlers.refresh} />
        <ImportExport onExport={handlers.exportCsv} onImport={handlers.importCsv} />
      </div>
    </>
  );
}
