import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <p className="text-6xl font-bold text-indigo-400">404</p>
        <h1 className="mt-4 text-2xl font-semibold text-slate-100">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          This page doesn&apos;t exist or has moved.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink href="/">Back to home</ButtonLink>
          <ButtonLink href="/bookings" variant="secondary">
            My bookings
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
