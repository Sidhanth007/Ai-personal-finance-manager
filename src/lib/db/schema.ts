import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Money is stored as integer minor units (paise / cents) in `bigint` columns
 * read back as JS numbers. Never store floats for money.
 */

// ---------- enums ----------
export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense"]);
export const transactionSourceEnum = pgEnum("transaction_source", [
  "manual",
  "recurring",
  "import",
  "sandbox_payment",
]);
export const otpPurposeEnum = pgEnum("otp_purpose", ["signup", "login"]);
export const frequencyEnum = pgEnum("frequency", ["daily", "weekly", "monthly", "yearly"]);
export const billFrequencyEnum = pgEnum("bill_frequency", [
  "once",
  "weekly",
  "monthly",
  "yearly",
]);
export const billStatusEnum = pgEnum("bill_status", ["upcoming", "paid", "overdue"]);
export const billingCycleEnum = pgEnum("billing_cycle", ["weekly", "monthly", "yearly"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "paused",
  "cancelled",
]);
export const goalStatusEnum = pgEnum("goal_status", ["active", "completed", "archived"]);
export const aiRoleEnum = pgEnum("ai_role", ["user", "assistant", "system", "tool"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "otp",
  "bill_reminder",
  "subscription_reminder",
  "budget_alert",
  "weekly_digest",
  "system",
]);
export const notificationChannelEnum = pgEnum("notification_channel", ["email", "in_app"]);
export const notificationStatusEnum = pgEnum("notification_status", [
  "queued",
  "sent",
  "failed",
]);

// ---------- helpers ----------
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};
const money = (name: string) => bigint(name, { mode: "number" });

// ---------- users & auth ----------
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    email: text("email").notNull(),
    name: text("name"),
    currency: text("currency").notNull().default("INR"),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    weeklyDigestEnabled: boolean("weekly_digest_enabled").notNull().default(true),
    remindersEnabled: boolean("reminders_enabled").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    purpose: otpPurposeEnum("purpose").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("otp_codes_email_idx").on(t.email, t.createdAt)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_idx").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

// ---------- categories & transactions ----------
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: transactionTypeEnum("type").notNull(),
    icon: text("icon"),
    color: text("color"),
    isDefault: boolean("is_default").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("categories_user_name_type_idx").on(t.userId, t.name, t.type)],
);

export const recurringRules = pgTable(
  "recurring_rules",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    type: transactionTypeEnum("type").notNull(),
    amount: money("amount").notNull(),
    description: text("description").notNull(),
    frequency: frequencyEnum("frequency").notNull(),
    interval: integer("interval").notNull().default(1),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    nextRunOn: date("next_run_on").notNull(),
    lastRunOn: date("last_run_on"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("recurring_rules_user_next_idx").on(t.userId, t.isActive, t.nextRunOn)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    type: transactionTypeEnum("type").notNull(),
    amount: money("amount").notNull(),
    currency: text("currency").notNull().default("INR"),
    description: text("description").notNull(),
    merchant: text("merchant"),
    notes: text("notes"),
    occurredOn: date("occurred_on").notNull(),
    source: transactionSourceEnum("source").notNull().default("manual"),
    recurringRuleId: uuid("recurring_rule_id").references(() => recurringRules.id, {
      onDelete: "set null",
    }),
    externalRef: text("external_ref"),
    ...timestamps,
  },
  (t) => [
    index("transactions_user_date_idx").on(t.userId, t.occurredOn),
    index("transactions_user_category_idx").on(t.userId, t.categoryId),
    index("transactions_user_type_idx").on(t.userId, t.type),
  ],
);

// ---------- budgets ----------
export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** null = overall monthly budget across all expense categories */
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }),
    /** first day of the month this budget applies to */
    month: date("month").notNull(),
    amount: money("amount").notNull(),
    alertThresholdPct: integer("alert_threshold_pct").notNull().default(80),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("budgets_user_category_month_idx").on(t.userId, t.categoryId, t.month),
    index("budgets_user_month_idx").on(t.userId, t.month),
  ],
);

// ---------- bills & subscriptions ----------
export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    amount: money("amount").notNull(),
    dueDate: date("due_date").notNull(),
    frequency: billFrequencyEnum("frequency").notNull().default("monthly"),
    status: billStatusEnum("status").notNull().default("upcoming"),
    reminderDaysBefore: integer("reminder_days_before").notNull().default(3),
    lastRemindedAt: timestamp("last_reminded_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    autoCreateTransaction: boolean("auto_create_transaction").notNull().default(true),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("bills_user_due_idx").on(t.userId, t.status, t.dueDate)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    amount: money("amount").notNull(),
    billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
    nextBillingDate: date("next_billing_date").notNull(),
    startedOn: date("started_on"),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    reminderDaysBefore: integer("reminder_days_before").notNull().default(3),
    lastRemindedAt: timestamp("last_reminded_at", { withTimezone: true }),
    autoCreateTransaction: boolean("auto_create_transaction").notNull().default(true),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("subscriptions_user_next_idx").on(t.userId, t.status, t.nextBillingDate)],
);

// ---------- savings goals ----------
export const savingsGoals = pgTable(
  "savings_goals",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetAmount: money("target_amount").notNull(),
    currentAmount: money("current_amount").notNull().default(0),
    targetDate: date("target_date"),
    status: goalStatusEnum("status").notNull().default("active"),
    icon: text("icon"),
    color: text("color"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("savings_goals_user_idx").on(t.userId, t.status)],
);

export const goalContributions = pgTable(
  "goal_contributions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => savingsGoals.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    contributedOn: date("contributed_on").notNull(),
    note: text("note"),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("goal_contributions_goal_idx").on(t.goalId, t.contributedOn)],
);

// ---------- AI ----------
export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    ...timestamps,
  },
  (t) => [index("ai_conversations_user_idx").on(t.userId, t.updatedAt)],
);

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: aiRoleEnum("role").notNull(),
    content: text("content").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

// ---------- notifications & admin ----------
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    channel: notificationChannelEnum("channel").notNull().default("email"),
    subject: text("subject").notNull(),
    status: notificationStatusEnum("status").notNull().default("queued"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    payload: jsonb("payload"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    adminUserId: uuid("admin_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_audit_log_created_idx").on(t.createdAt)],
);

export const cronStatusEnum = pgEnum("cron_status", ["running", "success", "failed"]);

export const cronRuns = pgTable(
  "cron_runs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    job: text("job").notNull(),
    status: cronStatusEnum("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    summary: jsonb("summary"),
    error: text("error"),
  },
  (t) => [index("cron_runs_job_started_idx").on(t.job, t.startedAt)],
);

// ---------- relations ----------
export const usersRelations = relations(users, ({ many }) => ({
  categories: many(categories),
  transactions: many(transactions),
  budgets: many(budgets),
  bills: many(bills),
  subscriptions: many(subscriptions),
  savingsGoals: many(savingsGoals),
  sessions: many(sessions),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  recurringRule: one(recurringRules, {
    fields: [transactions.recurringRuleId],
    references: [recurringRules.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, { fields: [budgets.userId], references: [users.id] }),
  category: one(categories, { fields: [budgets.categoryId], references: [categories.id] }),
}));

export const savingsGoalsRelations = relations(savingsGoals, ({ one, many }) => ({
  user: one(users, { fields: [savingsGoals.userId], references: [users.id] }),
  contributions: many(goalContributions),
}));

export const goalContributionsRelations = relations(goalContributions, ({ one }) => ({
  goal: one(savingsGoals, { fields: [goalContributions.goalId], references: [savingsGoals.id] }),
}));

export const aiConversationsRelations = relations(aiConversations, ({ one, many }) => ({
  user: one(users, { fields: [aiConversations.userId], references: [users.id] }),
  messages: many(aiMessages),
}));

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
  conversation: one(aiConversations, {
    fields: [aiMessages.conversationId],
    references: [aiConversations.id],
  }),
}));

// ---------- inferred types ----------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type RecurringRule = typeof recurringRules.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type GoalContribution = typeof goalContributions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
