import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Bed,
  Car,
  Plus,
  ShoppingBag,
  Ticket,
  Trash2,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import {
  createTripExpense,
  deleteTripExpense,
  getTripBudget,
  listTripExpenses,
  updateTripBudget,
} from '@/services/budget';
import { listTrips } from '@/services/trip';
import { GlassCard } from '@/components/GlassCard';
import { BottomSheet } from '@/components/BottomSheet';
import { CountUp } from '@/components/CountUp';
import { SectionHeader } from '@/components/SectionHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { EXPENSE_CATEGORY_LABELS } from '@/lib/constants';
import { formatDateShort, formatMoney, formatMoneyPrecise } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ExpenseCategory } from '@/types';

const CATEGORY_META: Record<
  keyof typeof CATEGORY_COLORS,
  { label: string; icon: typeof Car }
> = {
  transport: { label: 'Transport', icon: Car },
  stay: { label: 'Stay', icon: Bed },
  meals: { label: 'Meals', icon: UtensilsCrossed },
  activities: { label: 'Activities', icon: Ticket },
  other: { label: 'Other', icon: ShoppingBag },
};

const CATEGORY_COLORS = {
  transport: 'var(--chart-1)',
  stay: 'var(--chart-2)',
  meals: 'var(--chart-3)',
  activities: 'var(--chart-4)',
  other: 'var(--chart-5)',
} as const;

const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

export function BudgetPage() {
  const { tripId: routeTripId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);

  const tripsQuery = useQuery({
    queryKey: ['trips', { filter: 'all', limit: 50 }],
    queryFn: () => listTrips({ filter: 'all', limit: 50 }),
    enabled: !routeTripId,
  });

  const tripId = routeTripId ?? tripsQuery.data?.items[0]?.id;

  const budgetQuery = useQuery({
    queryKey: ['budget', tripId],
    queryFn: () => getTripBudget(tripId!),
    enabled: !!tripId,
  });

  const expensesQuery = useQuery({
    queryKey: ['expenses', tripId],
    queryFn: () => listTripExpenses(tripId!),
    enabled: !!tripId,
  });

  const budget = budgetQuery.data;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['budget', tripId] });
    void queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
    void queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const removeExpense = useMutation({
    mutationFn: (expenseId: string) => deleteTripExpense(tripId!, expenseId),
    onSuccess: () => {
      invalidate();
      toast('Expense removed', 'success');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const donutData = useMemo(() => {
    if (!budget) return [];
    return (Object.keys(CATEGORY_COLORS) as (keyof typeof CATEGORY_COLORS)[])
      .map((key) => ({
        key,
        name: CATEGORY_META[key].label,
        value: budget.breakdown[key],
        color: CATEGORY_COLORS[key],
      }))
      .filter((d) => d.value > 0);
  }, [budget]);

  const dailyData = useMemo(
    () =>
      budget?.daily.map((d) => ({
        date: formatDateShort(d.date),
        total: d.total,
        over: d.isOverBudget,
      })) ?? [],
    [budget],
  );

  if (!routeTripId && tripsQuery.isLoading) return <LoadingSkeleton count={4} />;

  if (!tripId) {
    return (
      <EmptyState
        title="No trips yet"
        message="Budgets appear once you create a trip."
        action={
          <Button onClick={() => navigate('/trips/new')} className="rounded-2xl">
            Create a trip
          </Button>
        }
      />
    );
  }

  if (budgetQuery.isLoading) return <LoadingSkeleton count={5} />;

  if (budgetQuery.isError || !budget) {
    return (
      <ErrorState title="Could not load the budget" onRetry={() => void budgetQuery.refetch()} />
    );
  }

  const spentPercent =
    budget.plannedTotal && budget.plannedTotal > 0
      ? Math.min((budget.total / budget.plannedTotal) * 100, 100)
      : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Budget</h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{budget.tripName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-2xl" onClick={() => setLimitOpen(true)}>
            Set limits
          </Button>
          <Button className="rounded-2xl" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Expense
          </Button>
        </div>
      </header>

      {/* Trip switcher */}
      {!routeTripId && (tripsQuery.data?.items.length ?? 0) > 1 && (
        <div className="snap-x-rail -mx-4 px-4 md:mx-0 md:px-0">
          {tripsQuery.data?.items.map((trip) => (
            <button
              key={trip.id}
              onClick={() => navigate(`/trips/${trip.id}/budget`)}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors',
                trip.id === tripId
                  ? 'bg-primary text-primary-foreground'
                  : 'glass text-muted-foreground hover:text-foreground',
              )}
            >
              {trip.name}
            </button>
          ))}
        </div>
      )}

      {/* Headline */}
      <GlassCard className="rounded-3xl p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Estimated total
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums md:text-4xl">
              <CountUp value={budget.total} format={(v) => formatMoney(v, budget.currency)} />
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatMoney(budget.perDayAverage, budget.currency)} / day ·{' '}
              {formatMoney(budget.perPersonTotal, budget.currency)} / person
            </p>
          </div>

          {budget.plannedTotal !== null && (
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Remaining
              </p>
              <p
                className={cn(
                  'mt-1 text-2xl font-semibold tabular-nums',
                  budget.isOverBudget ? 'text-destructive' : 'text-success',
                )}
              >
                {formatMoney(budget.remaining ?? 0, budget.currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                of {formatMoney(budget.plannedTotal, budget.currency)}
              </p>
            </div>
          )}
        </div>

        {spentPercent !== null && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  budget.isOverBudget ? 'bg-destructive' : 'bg-primary',
                )}
                initial={{ width: 0 }}
                animate={{ width: `${spentPercent}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {Math.round(spentPercent)}% of the planned budget
            </p>
          </div>
        )}

        {budget.isOverBudget && (
          <p className="mt-4 flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This itinerary is over the planned budget.
          </p>
        )}
      </GlassCard>

      {/* Breakdown */}
      <section className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="rounded-3xl p-5">
          <SectionHeader title="Where it goes" className="mb-4" />

          {donutData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing costed yet.
            </p>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="58%"
                      outerRadius="88%"
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatMoney(Number(value ?? 0), budget.currency)}
                      contentStyle={{
                        borderRadius: 16,
                        border: '1px solid var(--border)',
                        background: 'var(--popover)',
                        color: 'var(--popover-foreground)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <ul className="mt-3 space-y-2">
                {donutData.map((entry) => {
                  const Icon = CATEGORY_META[entry.key].icon;
                  const percent = budget.breakdownPercentage[entry.key];
                  return (
                    <li key={entry.key} className="flex items-center gap-3">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: entry.color }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{entry.name}</span>
                        <span className="block text-xs text-muted-foreground">{percent}%</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatMoney(entry.value, budget.currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </GlassCard>

        <GlassCard className="rounded-3xl p-5">
          <SectionHeader
            title="Daily spend"
            subtitle={
              budget.overBudgetDayCount > 0
                ? `${budget.overBudgetDayCount} day${budget.overBudgetDayCount > 1 ? 's' : ''} over the limit`
                : undefined
            }
            className="mb-4"
          />

          {dailyData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No days to show.</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)' }}
                    formatter={(value) => formatMoney(Number(value ?? 0), budget.currency)}
                    contentStyle={{
                      borderRadius: 16,
                      border: '1px solid var(--border)',
                      background: 'var(--popover)',
                      color: 'var(--popover-foreground)',
                    }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {dailyData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.over ? 'var(--destructive)' : 'var(--chart-1)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {budget.dailyLimit !== null && (
            <p className="mt-3 text-xs text-muted-foreground">
              Daily limit: {formatMoney(budget.dailyLimit, budget.currency)}
            </p>
          )}
        </GlassCard>
      </section>

      {/* Per-stop */}
      {budget.byStop.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="By destination" />
          <div className="space-y-2">
            {budget.byStop.map((stop) => (
              <GlassCard key={stop.stopId} className="flex items-center gap-4 rounded-2xl p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{stop.city}</p>
                  <p className="text-xs text-muted-foreground">
                    {stop.days} {stop.days === 1 ? 'day' : 'days'} · {stop.country}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatMoney(stop.total, budget.currency)}
                </p>
              </GlassCard>
            ))}
          </div>
        </section>
      )}

      {/* Expenses */}
      <section className="space-y-3">
        <SectionHeader
          title="Logged expenses"
          icon={Wallet}
          subtitle={
            expensesQuery.data ? `${expensesQuery.data.total} recorded` : undefined
          }
        />

        {expensesQuery.isLoading ? (
          <LoadingSkeleton count={3} />
        ) : (expensesQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No expenses logged"
            message="Record what you actually spend to keep the budget honest."
            action={
              <Button className="rounded-2xl" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Log an expense
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {expensesQuery.data?.items.map((expense) => (
              <li key={expense.id}>
                <GlassCard className="group flex items-center gap-3 rounded-2xl p-4">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{expense.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {EXPENSE_CATEGORY_LABELS[expense.category]} ·{' '}
                      {formatDateShort(expense.incurredOn)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatMoneyPrecise(expense.amount, expense.currency)}
                  </span>
                  <button
                    onClick={() => removeExpense.mutate(expense.id)}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Delete ${expense.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </GlassCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddExpenseSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        tripId={tripId}
        currency={budget.currency}
        onAdded={invalidate}
      />

      <SetLimitsSheet
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        tripId={tripId}
        currency={budget.currency}
        plannedTotal={budget.plannedTotal}
        dailyLimit={budget.dailyLimit}
        onSaved={invalidate}
      />
    </div>
  );
}

function AddExpenseSheet({
  open,
  onClose,
  tripId,
  currency,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  currency: string;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [category, setCategory] = useState<ExpenseCategory>('MEALS');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [incurredOn, setIncurredOn] = useState(new Date().toISOString().slice(0, 10));

  const mutation = useMutation({
    mutationFn: () =>
      createTripExpense(tripId, {
        category,
        title: title.trim(),
        amount: Number(amount),
        currency,
        incurredOn,
      }),
    onSuccess: () => {
      onAdded();
      toast('Expense logged', 'success');
      setTitle('');
      setAmount('');
      onClose();
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const invalid = title.trim().length === 0 || !amount || Number(amount) < 0;

  return (
    <BottomSheet open={open} onClose={onClose} title="Log an expense">
      <div className="space-y-4 pb-2">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Category</legend>
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((value) => (
              <button
                key={value}
                onClick={() => setCategory(value)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                  category === value
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground',
                )}
                aria-pressed={category === value}
              >
                {EXPENSE_CATEGORY_LABELS[value]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="expense-title">Description</Label>
          <Input
            id="expense-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Shinkansen Tokyo → Kyoto"
            maxLength={160}
            className="rounded-2xl"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="expense-amount">Amount ({currency})</Label>
            <Input
              id="expense-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-date">Date</Label>
            <Input
              id="expense-date"
              type="date"
              value={incurredOn}
              onChange={(e) => setIncurredOn(e.target.value)}
              className="rounded-2xl"
            />
          </div>
        </div>

        <Button
          className="w-full rounded-2xl"
          size="lg"
          disabled={invalid || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Saving…' : 'Log expense'}
        </Button>
      </div>
    </BottomSheet>
  );
}

function SetLimitsSheet({
  open,
  onClose,
  tripId,
  currency,
  plannedTotal,
  dailyLimit,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  currency: string;
  plannedTotal: number | null;
  dailyLimit: number | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [planned, setPlanned] = useState(plannedTotal?.toString() ?? '');
  const [daily, setDaily] = useState(dailyLimit?.toString() ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      updateTripBudget(tripId, {
        plannedTotal: planned ? Number(planned) : undefined,
        dailyLimit: daily ? Number(daily) : undefined,
      }),
    onSuccess: () => {
      onSaved();
      toast('Budget limits updated', 'success');
      onClose();
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  return (
    <BottomSheet open={open} onClose={onClose} title="Budget limits">
      <div className="space-y-4 pb-2">
        <div className="space-y-1.5">
          <Label htmlFor="planned-total">Total budget ({currency})</Label>
          <Input
            id="planned-total"
            type="number"
            inputMode="decimal"
            min={0}
            value={planned}
            onChange={(e) => setPlanned(e.target.value)}
            placeholder="5000"
            className="rounded-2xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="daily-limit">Daily limit ({currency})</Label>
          <Input
            id="daily-limit"
            type="number"
            inputMode="decimal"
            min={0}
            value={daily}
            onChange={(e) => setDaily(e.target.value)}
            placeholder="400"
            className="rounded-2xl"
          />
          <p className="text-xs text-muted-foreground">
            Days above this are highlighted in the daily chart.
          </p>
        </div>

        <Button
          className="w-full rounded-2xl"
          size="lg"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Saving…' : 'Save limits'}
        </Button>
      </div>
    </BottomSheet>
  );
}
