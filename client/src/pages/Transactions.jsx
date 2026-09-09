import { useOutletContext } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Filters from '../components/Filters.jsx';
import ExpenseTable from '../components/ExpenseTable.jsx';
import ImportExport from '../components/ImportExport.jsx';
import StatementImport from '../components/StatementImport.jsx';
import { emptyFilters } from '../useExpensesData.js';
import { TableSkeleton } from '../components/Skeleton.jsx';
import { formatMoney } from '../format.js';

export default function Transactions() {
  const {
    expenses,
    accounts,
    categories,
    filters,
    setFilters,
    sort,
    order,
    loading,
    periodLoading,
    handlers
  } =
    useOutletContext();

  // A period change reloads the list too, so it gets placeholders rather than
  // the previous period's rows.
  const firstLoad = periodLoading || (loading && expenses.length === 0);

  const income = expenses.filter((row) => row.kind === 'income').reduce((sum, row) => sum + row.amount, 0);
  const spend = expenses.filter((row) => row.kind !== 'income').reduce((sum, row) => sum + row.amount, 0);

  return (
    <>
      {filters.searchAll && filters.q && (
        <p className="notice" role="status">
          <Icon name="search" size={16} strokeWidth={1.9} />
          <span>
            Showing every date for “{filters.q}”.{' '}
            <button
              type="button"
              className="link"
              onClick={() => setFilters({ ...filters, q: '', searchAll: false })}
            >
              Back to the selected period
            </button>
          </span>
        </p>
      )}

      <Filters
        categories={categories.expense}
        incomeCategories={categories.income}
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(emptyFilters)}
      />

      {firstLoad && <TableSkeleton />}

      {!firstLoad && (
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
      )}

      <div className="two-col">
        <StatementImport onImported={handlers.refresh} />
        <ImportExport onExport={handlers.exportCsv} onImport={handlers.importCsv} />
      </div>
    </>
  );
}
