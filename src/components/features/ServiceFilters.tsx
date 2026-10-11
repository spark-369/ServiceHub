"use client";

import { SERVICE_CATEGORIES } from "@/lib/constants";
import { Field, Input, Select } from "@/components/ui";

/**
 * Search / category / location filter bar. Extracted from the home page so the
 * bar can be reused and the search input debounced in one place.
 */
export default function ServiceFilters({
  search,
  category,
  location,
  onSearchChange,
  onCategoryChange,
  onLocationChange,
}: {
  search: string;
  category: string;
  location: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
}) {
  return (
    <div className="mb-8 rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Search Services" htmlFor="service-search">
          <Input
            id="service-search"
            type="text"
            placeholder="e.g., house cleaning, plumbing"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </Field>

        <Field label="Category" htmlFor="service-category">
          <Select
            id="service-category"
            value={category}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="" className="bg-slate-900 text-slate-100" style={{ minWidth: "240px" }}>All Categories</option>
            {SERVICE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat.toLowerCase()} className="bg-slate-900 text-slate-100" style={{ minWidth: "240px" }}>
                {cat}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Location" htmlFor="service-location">
          <Input
            id="service-location"
            type="text"
            placeholder="City or area"
            value={location}
            onChange={(event) => onLocationChange(event.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}
