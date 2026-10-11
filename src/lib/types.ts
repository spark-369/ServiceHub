/**
 * Shared client-side domain types.
 *
 * These mirror the shapes returned by the API routes and are the single source
 * of truth for the UI. Previously every page redeclared its own `interface
 * Service` / `Booking` / `Review`, which drifted over time — import from here
 * instead so a field rename is a one-line change.
 */

export type UserRole = "customer" | "provider" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface PublicUser {
  id: string;
  name: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  role?: UserRole;
}

export interface ServiceProvider extends PublicUser {
  name: string;
}

export interface ServiceAvailability {
  days: string[];
  startTime: string;
  endTime: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
  location: string;
  availability?: ServiceAvailability;
  tags?: string[];
  rating: number;
  reviewCount: number;
  isActive?: boolean;
  createdAt?: string;
  provider: ServiceProvider | null;
}

/** A service returned by the AI recommendations endpoint — adds a score. */
export interface Recommendation extends Service {
  relevanceScore: number;
}

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "refunded";

export interface Booking {
  id: string;
  date: string;
  status: BookingStatus | string;
  notes?: string | null;
  totalPrice: number;
  paymentStatus: PaymentStatus | string;
  /** Timestamp the payment was captured (null until paid). */
  paidAt?: string | null;
  /** Timestamp a refund was issued (null unless refunded). */
  refundedAt?: string | null;
  /** Stripe PaymentIntent id (null when settled outside Stripe). */
  stripePaymentId?: string | null;
  /** Stripe customer id on record for this booking. */
  stripeCustomerId?: string | null;
  service: Pick<Service, "id" | "name" | "description" | "price" | "duration">;
  user?: PublicUser;
  provider?: PublicUser;
  createdAt: string;
  updatedAt?: string;
}

export interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  user: { name: string };
  createdAt: string;
}
