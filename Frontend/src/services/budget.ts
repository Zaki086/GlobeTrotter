import { USE_MOCK, request, delay } from '@/lib/api';
import { getBudget, getTripById, mockExpenses, computeBudget } from '@/services/mock-data';
import type {
  Budget,
  CreateExpenseInput,
  Expense,
  ListExpensesQuery,
  Paginated,
  UpdateBudgetInput,
} from '@/types';

export async function getTripBudget(tripId: string): Promise<Budget> {
  if (USE_MOCK) {
    await delay();
    return getBudget(tripId);
  }
  return request<Budget>({ method: 'GET', url: `/trips/${tripId}/budget` });
}

export async function updateTripBudget(
  tripId: string,
  input: UpdateBudgetInput,
): Promise<Budget> {
  if (USE_MOCK) {
    await delay();
    const trip = getTripById(tripId);
    if (!trip) throw new Error('Trip not found');
    if (trip.budget) {
      if (input.plannedTotal !== undefined) trip.budget.plannedTotal = input.plannedTotal;
      if (input.dailyLimit !== undefined) trip.budget.dailyLimit = input.dailyLimit;
      if (input.currency) trip.budget.currency = input.currency;
    }
    return getBudget(tripId);
  }
  return request<Budget>({ method: 'PATCH', url: `/trips/${tripId}/budget`, data: input });
}

export async function listTripExpenses(
  tripId: string,
  query: ListExpensesQuery = {},
): Promise<Paginated<Expense>> {
  if (USE_MOCK) {
    await delay();
    let items = mockExpenses.filter((e) => e.tripId === tripId);
    if (query.category) items = items.filter((e) => e.category === query.category);
    if (query.stopId) items = items.filter((e) => e.stopId === query.stopId);
    if (query.from) items = items.filter((e) => e.incurredOn >= query.from!);
    if (query.to) items = items.filter((e) => e.incurredOn <= query.to!);
    items.sort((a, b) => b.incurredOn.localeCompare(a.incurredOn));
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    return { items: items.slice(start, start + limit), total: items.length };
  }
  return request<Paginated<Expense>>({
    method: 'GET',
    url: `/trips/${tripId}/expenses`,
    params: query as Record<string, unknown>,
  });
}

export async function createTripExpense(
  tripId: string,
  input: CreateExpenseInput,
): Promise<Expense> {
  if (USE_MOCK) {
    await delay();
    const trip = getTripById(tripId);
    if (!trip) throw new Error('Trip not found');
    const expense: Expense = {
      id: `exp-${Date.now()}`,
      tripId,
      stopId: input.stopId ?? null,
      createdById: 'user-1',
      category: input.category,
      title: input.title,
      amount: input.amount,
      currency: input.currency ?? trip.currency,
      incurredOn: input.incurredOn,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockExpenses.push(expense);
    computeBudget(trip);
    return expense;
  }
  return request<Expense>({
    method: 'POST',
    url: `/trips/${tripId}/expenses`,
    data: input,
  });
}

export async function deleteTripExpense(tripId: string, expenseId: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    const idx = mockExpenses.findIndex((e) => e.id === expenseId && e.tripId === tripId);
    if (idx >= 0) mockExpenses.splice(idx, 1);
    const trip = getTripById(tripId);
    if (trip) computeBudget(trip);
    return;
  }
  await request<void>({ method: 'DELETE', url: `/trips/${tripId}/expenses/${expenseId}` });
}
