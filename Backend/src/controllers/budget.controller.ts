import type { Request } from 'express';
import { buildPaginationMeta, sendCreated, sendSuccess } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { resolvePagination } from '../utils/pagination';
import type { RequestContext } from '../types';
import { BudgetService } from '../services/budget.service';

function contextOf(req: Request): RequestContext {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

export const getBudget = asyncHandler(async (req, res) => {
  const budget = await BudgetService.getBudget(req.params.id, req.auth!.userId);
  return sendSuccess(res, budget, 'Budget retrieved');
});

export const updateBudget = asyncHandler(async (req, res) => {
  const budget = await BudgetService.updateBudget(
    req.params.id,
    req.auth!.userId,
    req.body,
    contextOf(req),
  );
  return sendSuccess(res, budget, 'Budget updated successfully');
});

export const listExpenses = asyncHandler(async (req, res) => {
  const query = req.query as Record<string, never>;
  const { page, limit, skip, take } = resolvePagination({
    page: Number(query.page ?? 1),
    limit: Number(query.limit ?? 20),
  });

  const { items, total } = await BudgetService.listExpenses(req.params.id, req.auth!.userId, {
    skip,
    take,
    category: query.category,
    stopId: query.stopId,
    from: query.from,
    to: query.to,
  });

  return sendSuccess(res, items, 'Expenses retrieved', 200, buildPaginationMeta(page, limit, total));
});

export const createExpense = asyncHandler(async (req, res) => {
  const expense = await BudgetService.addExpense(
    req.params.id,
    req.auth!.userId,
    req.body,
    contextOf(req),
  );
  return sendCreated(res, expense, 'Expense recorded');
});

export const deleteExpense = asyncHandler(async (req, res) => {
  await BudgetService.removeExpense(
    req.params.id,
    req.auth!.userId,
    req.params.expenseId,
    contextOf(req),
  );
  return sendSuccess(res, {}, 'Expense deleted');
});
