/**
 * Initials avatar. Derives up to two initials from a display name and picks a
 * deterministic tint from the name so the same person always looks the same.
 */

const TINTS = [
  "bg-indigo-500/15 text-indigo-300",
  "bg-emerald-500/15 text-emerald-300",
  "bg-amber-500/15 text-amber-300",
  "bg-sky-500/15 text-sky-300",
  "bg-fuchsia-500/15 text-fuchsia-300",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function tintFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TINTS[hash % TINTS.length];
}

export default function Avatar({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dimensions = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  }[size];

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold ${tintFor(
        name
      )} ${dimensions} ${className}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
