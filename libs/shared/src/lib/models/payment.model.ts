import {
  IsString,
  IsOptional,
  IsEnum,
  IsDate,
  IsNumber,
  IsUUID,
  IsArray,
  IsBoolean,
  Min,
} from 'class-validator';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
  TRIALING = 'trialing',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PAID = 'paid',
  VOID = 'void',
  UNCOLLECTIBLE = 'uncollectible',
}

export enum PaymentType {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_ACCOUNT = 'bank_account',
  PAYPAL = 'paypal',
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
}

export enum BillingInterval {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum UsageFeature {
  MEETING_MINUTES = 'meeting_minutes',
  TRANSCRIPTION_MINUTES = 'transcription_minutes',
  AI_SUMMARIES = 'ai_summaries',
  QA_QUERIES = 'qa_queries',
  STORAGE_GB = 'storage_gb',
}

export interface PlanLimits {
  monthlyMeetings: number;
  transcriptionMinutes: number;
  storageGB: number;
  participantsPerMeeting: number;
  apiCallsPerMonth: number;
}

export interface PlanFeature {
  name: string;
  description: string;
  included: boolean;
}

export class SubscriptionPlan {
  @IsUUID()
  id!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsString()
  currency!: string;

  @IsEnum(BillingInterval)
  interval!: BillingInterval;

  @IsArray()
  features!: PlanFeature[];

  limits!: PlanLimits;

  @IsBoolean()
  isActive!: boolean;

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;

  constructor(partial: Partial<SubscriptionPlan>) {
    Object.assign(this, partial);
  }
}

export class UserSubscription {
  @IsUUID()
  id!: string;

  @IsUUID()
  userId!: string;

  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsString()
  stripeSubscriptionId?: string;

  @IsEnum(SubscriptionStatus)
  status!: SubscriptionStatus;

  @IsDate()
  currentPeriodStart!: Date;

  @IsDate()
  currentPeriodEnd!: Date;

  @IsBoolean()
  cancelAtPeriodEnd!: boolean;

  @IsOptional()
  @IsDate()
  trialEnd?: Date;

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;

  constructor(partial: Partial<UserSubscription>) {
    Object.assign(this, partial);
  }
}

export class PaymentMethod {
  @IsUUID()
  id!: string;

  @IsUUID()
  userId!: string;

  @IsString()
  stripePaymentMethodId!: string;

  @IsEnum(PaymentType)
  type!: PaymentType;

  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;

  @IsOptional()
  @IsString()
  last4?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsNumber()
  expiryMonth?: number;

  @IsOptional()
  @IsNumber()
  expiryYear?: number;

  @IsBoolean()
  isDefault!: boolean;

  @IsBoolean()
  isValid!: boolean;

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;

  constructor(partial: Partial<PaymentMethod>) {
    Object.assign(this, partial);
  }
}

export interface BillingPeriod {
  start: Date;
  end: Date;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  periodStart?: Date;
  periodEnd?: Date;
  createdAt: Date;
}

export class Invoice {
  @IsUUID()
  id!: string;

  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @IsOptional()
  @IsString()
  stripeInvoiceId?: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsNumber()
  @Min(0)
  tax!: number;

  @IsNumber()
  @Min(0)
  total!: number;

  @IsString()
  currency!: string;

  @IsEnum(InvoiceStatus)
  status!: InvoiceStatus;

  @IsDate()
  dueDate!: Date;

  @IsOptional()
  @IsDate()
  paidAt?: Date;

  @IsArray()
  items!: InvoiceItem[];

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;

  constructor(partial: Partial<Invoice>) {
    Object.assign(this, partial);
  }
}

export class UsageRecord {
  @IsUUID()
  id!: string;

  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @IsEnum(UsageFeature)
  feature!: UsageFeature;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsString()
  billingPeriod!: string; // YYYY-MM format

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsDate()
  createdAt!: Date;

  constructor(partial: Partial<UsageRecord>) {
    Object.assign(this, partial);
  }
}

// DTOs
export interface CreateSubscriptionDto {
  userId: string;
  planId: string;
  paymentMethodId: string;
  trialDays?: number;
}

export interface UpdateSubscriptionDto {
  planId?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface CreatePaymentMethodDto {
  userId: string;
  stripePaymentMethodId: string;
  type: PaymentType;
  isDefault?: boolean;
}

export interface CreateInvoiceDto {
  userId: string;
  subscriptionId?: string;
  amount: number;
  tax?: number;
  currency?: string;
  dueDate: Date;
  items: Omit<InvoiceItem, 'id' | 'invoiceId' | 'createdAt'>[];
}

export interface CreateUsageRecordDto {
  userId: string;
  subscriptionId?: string;
  feature: UsageFeature;
  quantity: number;
  billingPeriod: string;
  metadata?: Record<string, unknown>;
}

// Response interfaces
export interface SubscriptionResponse {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
  createdAt: Date;
}

export interface PaymentMethodResponse {
  id: string;
  type: PaymentType;
  provider: PaymentProvider;
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  isValid: boolean;
  createdAt: Date;
}

export interface UsageReport {
  userId: string;
  billingPeriod: string;
  usage: {
    feature: UsageFeature;
    quantity: number;
    limit: number;
    percentage: number;
  }[];
  totalCost: number;
}

export interface PaymentIntent {
  amount: number;
  currency: string;
  paymentMethodId: string;
  customerId: string;
  description?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentIntentId: string;
  status: string;
  error?: string;
}

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface TaxCalculation {
  amount: number;
  rate: number;
  jurisdiction: string;
}

export interface PromoCodeResult {
  valid: boolean;
  discountAmount?: number;
  discountPercentage?: number;
  error?: string;
}

export interface InvoiceFilters {
  status?: InvoiceStatus;
  startDate?: Date;
  endDate?: Date;
  subscriptionId?: string;
}
