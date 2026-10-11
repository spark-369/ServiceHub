"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import ReviewModal from "@/components/features/ReviewModal";
import ServiceCard from "@/components/features/ServiceCard";
import { Button, ButtonLink, Input, Badge, EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import type { Recommendation, Service } from "@/lib/types";

const EXAMPLE_QUERIES = [
  "house cleaning service",
  "plumbing repair",
  "personal trainer",
  "home tutoring",
  "car maintenance",
  "hair styling",
  "garden landscaping",
  "electrical work",
];

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const { token } = useAuth();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ recommendations?: Recommendation[] }>(
        `/api/recommendations?q=${encodeURIComponent(trimmed)}`,
        {
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : undefined,
        }
      );
      setRecommendations(data.recommendations ?? []);
      setSearched(true);
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      setError("Could not load recommendations. Please try again.");
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReviews = (service: Service) => {
    setSelectedService(service);
  };

  const handleCloseReviews = () => {
    setSelectedService(null);
  };

  const runExample = (example: string) => {
    setQuery(example);
    const trimmed = example.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    apiFetch<{ recommendations?: Recommendation[] }>(
      `/api/recommendations?q=${encodeURIComponent(trimmed)}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }
    )
      .then((data) => {
        setRecommendations(data.recommendations ?? []);
        setSearched(true);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load recommendations. Please try again.");
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="mx-auto max-w-6xl">
      <header className="py-8 text-center">
        <h1 className="text-3xl font-bold text-slate-100 sm:text-4xl">
          AI Recommendations
        </h1>
        <p className="mt-3 text-slate-400">
          Describe what you need and we&apos;ll rank the best local matches using
          on-device semantic search.
        </p>
      </header>

      {/* Search Form */}
      <form
        onSubmit={handleSearch}
        className="mx-auto mb-8 flex max-w-2xl flex-col gap-3 sm:flex-row"
      >
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe what you're looking for..."
          aria-label="Search query"
          className="flex-1"
        />
        <Button type="submit" loading={loading} size="lg">
          {loading ? "Searching..." : "Find Services"}
        </Button>
      </form>

      {error && (
        <div className="mx-auto mb-6 max-w-2xl rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Example Queries */}
      {!searched && (
        <div className="mx-auto mb-8 max-w-4xl">
          <h2 className="mb-4 text-base font-medium text-slate-300">
            Not sure what to search? Try one of these:
          </h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => runExample(example)}
                className="rounded-md border border-slate-800 bg-slate-900 p-3 text-left text-sm text-slate-300 transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/10"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {searched && (
        <div>
          {!loading && recommendations.length > 0 && (
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">
                Found {recommendations.length} match
                {recommendations.length !== 1 ? "es" : ""} for &ldquo;{query}
                &rdquo;
              </h2>
              <Badge tone="success">Ranked by relevance</Badge>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-lg border border-slate-800 bg-slate-900"
                />
              ))}
            </div>
          ) : recommendations.length === 0 ? (
            <EmptyState
              title="No recommendations found"
              description="Try different or more general keywords to broaden your search."
              action={
                <ButtonLink href="/" variant="secondary">
                  Browse all services
                </ButtonLink>
              }
              icon={
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
                  />
                </svg>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  matchScore={service.relevanceScore}
                  onViewReviews={handleViewReviews}
                />
              ))}
            </div>
          )}
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
