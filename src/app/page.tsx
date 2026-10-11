"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import ReviewModal from "@/components/features/ReviewModal";
import ServiceFilters from "@/components/features/ServiceFilters";
import ServiceGrid from "@/components/features/ServiceGrid";
import { ButtonLink, Badge } from "@/components/ui";
import { useDebounce } from "@/hooks/useDebounce";
import { apiFetch } from "@/lib/api-client";
import type { Service } from "@/lib/types";

interface PlatformStats {
  verifiedProviders: number;
  averageRating: number;
  completedBookings: number;
  activeServices: number;
}

/** Compact a large count into a friendly label, e.g. 5230 → "5k+". */
function formatCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1)}k+`;
  }
  return value.toLocaleString();
}

function TrustStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{label}</p>
    </div>
  );
}

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Search & compare",
    description:
      "Browse local services by category, keyword or location and compare ratings, prices and reviews.",
  },
  {
    step: "2",
    title: "Book instantly",
    description:
      "Pick a time slot, add notes, and secure your booking with secure Stripe payments.",
  },
  {
    step: "3",
    title: "Rate your experience",
    description:
      "After the job is done, leave a review to help your neighbours choose well.",
  },
];

export default function Home() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const { user } = useAuth();

  // Debounce the free-text search so we fetch once the user pauses, not on
  // every keystroke.
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Load platform-wide marketing stats (independent of the service query).
  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      try {
        const data = await apiFetch<{ stats?: PlatformStats }>("/api/stats");
        if (active && data.stats) setStats(data.stats);
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };
    void fetchStats();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const fetchServices = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.append("q", debouncedSearch);
        if (category) params.append("category", category);
        if (location) params.append("location", location);

        const data = await apiFetch<{ services?: Service[] }>(
          `/api/services?${params}`
        );
        if (active) setServices(data.services ?? []);
      } catch (error) {
        console.error("Error fetching services:", error);
        if (active) setServices([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchServices();
    return () => {
      active = false;
    };
  }, [debouncedSearch, category, location]);

  const handleViewReviews = (service: Service) => {
    setSelectedService(service);
  };

  const handleCloseReviews = () => {
    setSelectedService(null);
  };

  const isFiltering = Boolean(debouncedSearch || category || location);

  return (
    <div className="px-0">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 px-6 py-14 text-center sm:px-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-100 sm:text-5xl">
          Find trusted local <span className="text-indigo-400">services</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
          Book verified professionals for cleaning, plumbing, tutoring and more —
          compare ratings, prices and reviews in one place.
        </p>

        {/* Trust stats (populated from the database) */}
        <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          <TrustStat
            value={stats ? formatCount(stats.verifiedProviders) : "—"}
            label="Verified pros"
          />
          <TrustStat
            value={stats ? `${stats.averageRating.toFixed(1)}★` : "—"}
            label="Average rating"
          />
          <TrustStat
            value={stats ? formatCount(stats.completedBookings) : "—"}
            label="Bookings completed"
          />
          <TrustStat
            value={stats ? formatCount(stats.activeServices) : "—"}
            label="Active services"
          />
        </div>
      </section>

      {/* How it works */}
      <section className="mt-10">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-semibold text-slate-100">
            How it works
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Three simple steps to get your job done
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map((item) => (
            <div
              key={item.step}
              className="rounded-lg border border-slate-800 bg-slate-900 p-6"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/15 text-sm font-semibold text-indigo-300">
                {item.step}
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-100">
                {item.title}
              </h3>
              <p className="mt-1 text-sm text-slate-400">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Browse & search */}
      <section className="mt-12">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-100">
              Browse services
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {isFiltering
                ? "Results matching your filters"
                : "Popular local services near you"}
            </p>
          </div>
          {!loading && (
            <Badge tone="info">
              {services.length} service{services.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>

        <ServiceFilters
          search={searchQuery}
          category={category}
          location={location}
          onSearchChange={setSearchQuery}
          onCategoryChange={setCategory}
          onLocationChange={setLocation}
        />

        {/* Services Grid */}
        <ServiceGrid
          services={services}
          loading={loading}
          onViewReviews={handleViewReviews}
          emptyTitle="No services found"
          emptyDescription="Try adjusting your search criteria or clearing your filters."
        />
      </section>

      {/* Call to Action for Providers */}
      {user?.role === "provider" && (
        <div className="mt-12 rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-6 text-center">
          <h2 className="mb-4 text-2xl font-bold text-slate-100">
            Ready to offer your services?
          </h2>
          <p className="mb-6 text-slate-400">
            Create and manage your service listings to reach more customers.
          </p>
          <ButtonLink href="/provider" size="lg">
            Manage My Services
          </ButtonLink>
        </div>
      )}

      {/* Review Modal */}
      {selectedService && (
        <ReviewModal
          serviceId={selectedService.id}
          serviceName={selectedService.name}
          isOpen={!!selectedService}
          onClose={handleCloseReviews}
        />
      )}
    </div>
  );
}
