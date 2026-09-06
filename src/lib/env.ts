import "server-only";
import { z } from "zod";

/** Treat empty strings from .env files as "not set". */
const optional = (schema: z.ZodTypeAny) =>
  z.preprocess((v) => (v === "" || v === undefined ? undefined : v), schema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3020"),
  ADMIN_EMAIL: z.email().transform((e) => e.trim().toLowerCase()),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  BREVO_API_KEY: optional(z.string().min(1)),
  BREVO_SENDER_EMAIL: optional(z.email()),
  BREVO_SENDER_NAME: z.string().default("Finance Manager"),
  CRON_SECRET: optional(z.string().min(16)),
  GOOGLE_GENERATIVE_AI_API_KEY: optional(z.string().min(1)),
  STRIPE_SECRET_KEY: optional(z.string().min(1)),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optional(z.string().min(1)),
  STRIPE_WEBHOOK_SECRET: optional(z.string().min(1)),
  UPSTASH_REDIS_REST_URL: optional(z.url()),
  UPSTASH_REDIS_REST_TOKEN: optional(z.string().min(1)),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data as z.infer<typeof envSchema> & {
  BREVO_API_KEY?: string;
  BREVO_SENDER_EMAIL?: string;
  CRON_SECRET?: string;
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
};

export const isEmailConfigured = Boolean(env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL);
export const isAiConfigured = Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY);
export const isStripeConfigured = Boolean(env.STRIPE_SECRET_KEY && env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
export const isRedisConfigured = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
