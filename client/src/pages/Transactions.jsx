import { useOutletContext } from 'react-router-dom';
import Filters from '../components/Filters.jsx';
import ExpenseTable from '../components/ExpenseTable.jsx';
import ImportExport from '../components/ImportExport.jsx';
import StatementImport from '../components/StatementImport.jsx';
import { emptyFilters } from '../useExpensesData.js';

export default function Transactions() {
  const { expenses, categories, filters, setFilters, sort, order, loading, handlers } =
    useOutletContext();

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
        <div className={loading ? 'refreshing' : undefined}>
          <ExpenseTable
            expenses={expenses}
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

      <StatementImport onImported={handlers.refresh} />

      <ImportExport onExport={handlers.exportCsv} onImport={handlers.importCsv} />
    </>
  );
}
