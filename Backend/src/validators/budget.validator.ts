import { z } from 'zod';
import { ExpenseCategory } from '@prisma/client';
import { currencyCode, isoDate, money, pagination, uuid } from './common.validator';

export const updateBudgetSchema = z
  .object({
    /** Overall ceiling for the trip. */
    plannedTotal: money.nullable().optional(),
    /** Per-day ceiling; days above it are flagged as overbudget. */
    dailyLimit: money.nullable().optional(),
    currency: currencyCode.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const createExpenseSchema = z.object({
  category: z.nativeEnum(ExpenseCategory),
  title: z.string().trim().min(1, 'Title is required').max(160),
  amount: money,
  currency: currencyCode.optional(),
  incurredOn: isoDate,
  stopId: uuid.optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const listExpensesQuerySchema = pagination.extend({
  category: z.nativeEnum(ExpenseCategory).optional(),
  stopId: uuid.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const expenseParamsSchema = z.object({
  id: uuid,
  expenseId: uuid,
});

export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
