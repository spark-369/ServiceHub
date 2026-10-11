/**
 * Design-system barrel.
 *
 * Import primitives from `@/components/ui` so page code stays short and the
 * concrete file layout can change without touching every consumer.
 */
export { default as Button, ButtonLink } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";
export { Card, CardHeader, CardBody, CardFooter } from "./Card";
export { Input, Textarea, Select, Field } from "./Input";
export type { FieldProps } from "./Input";
export {
  Badge,
  StatusBadge,
  ActiveBadge,
  bookingTone,
  paymentTone,
} from "./Badge";
export type { BadgeTone } from "./Badge";
export { default as Modal } from "./Modal";
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonGrid,
  SkeletonTable,
} from "./Skeleton";
export { default as EmptyState } from "./EmptyState";
export { default as Spinner, SpinnerPanel } from "./Spinner";
export { default as Rating } from "./Rating";
export { default as Avatar } from "./Avatar";
