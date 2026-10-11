"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Badge, Button, ButtonLink, Field, Input, Rating, Textarea } from "@/components/ui";
import { SpinnerPanel } from "@/components/ui/Spinner";
import { formatDate, formatDuration, formatMoney } from "@/lib/format";
import type { Review, Service } from "@/lib/types";

export default function ServiceDetailPage() {
  const [service, setService] = useState<Service | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState("");
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (id) {
      fetchServiceDetails();
    }
  }, [id]);

  const fetchServiceDetails = async () => {
    try {
      const response = await fetch(`/api/services/${id}`);
      const data = await response.json();
      if (response.ok) {
        setService(data.service);
        setReviews(data.reviews);
      } else {
        setError(data.error);
      }
    } catch (error) {
      console.error("Error fetching service details:", error);
      setError("Failed to load service details");
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push("/auth/login");
      return;
    }

    setBookingLoading(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          serviceId: id,
          date: bookingDate,
          notes: bookingNotes,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success("Booking created successfully!");
        router.push("/bookings");
      } else {
        setError(data.error);
        toast.error(data.error || "Failed to create booking");
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      setError("Failed to create booking");
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return <SpinnerPanel label="Loading service" />;
  }

  if (error || !service) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-400">{error || "Service not found"}</p>
        <Link
          href="/"
          className="mt-4 inline-block text-indigo-400 hover:text-indigo-300"
        >
          Back to services
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Service Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-100">{service.name}</h1>
            <p className="mt-2 text-lg text-slate-400">{service.description}</p>
            <div className="mt-4 flex items-center gap-4">
              <Badge tone="info">{service.category}</Badge>
              <Rating value={service.rating} count={service.reviewCount} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-slate-100">
              {formatMoney(service.price)}
            </div>
            <div className="text-sm text-slate-500">
              {formatDuration(service.duration)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Provider Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-4">
              Service Provider
            </h2>
            {service.provider ? (
              <div className="space-y-2 text-slate-300">
                <p>
                  <strong className="text-slate-200">Name:</strong>{" "}
                  {service.provider.name}
                </p>
                <p>
                  <strong className="text-slate-200">Email:</strong>{" "}
                  {service.provider.email || "—"}
                </p>
                <p>
                  <strong className="text-slate-200">Phone:</strong>{" "}
                  {service.provider.phone || "—"}
                </p>
                <p>
                  <strong className="text-slate-200">Address:</strong>{" "}
                  {service.provider.address || "—"}
                </p>
              </div>
            ) : (
              <p className="text-slate-400">
                Provider details are not available for this listing.
              </p>
            )}
          </div>

          {/* Availability */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-4">
              Availability
            </h2>
            <div className="space-y-2 text-slate-300">
              <p>
                <strong className="text-slate-200">Days:</strong>{" "}
                {service.availability?.days?.length
                  ? service.availability.days.join(", ")
                  : "—"}
              </p>
              <p>
                <strong className="text-slate-200">Hours:</strong>{" "}
                {service.availability?.startTime && service.availability?.endTime
                  ? `${service.availability.startTime} - ${service.availability.endTime}`
                  : "—"}
              </p>
              <p>
                <strong className="text-slate-200">Location:</strong>{" "}
                {service.location}
              </p>
            </div>
          </div>

          {/* Tags */}
          {service.tags && service.tags.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-100 mb-4">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {service.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 ring-1 ring-inset ring-slate-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-slate-100 mb-4">
              Reviews ({reviews.length})
            </h2>
            {reviews.length === 0 ? (
              <p className="text-slate-400">No reviews yet.</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="border-b border-slate-800 pb-4 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Rating value={review.rating} />
                        <span className="text-sm text-slate-400">
                          by {review.user.name}
                        </span>
                      </div>
                      <span className="text-sm text-slate-500">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="mt-2 text-slate-300">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Booking Form */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-sm p-6 sticky top-24">
            <h2 className="text-xl font-semibold text-slate-100 mb-4">
              Book This Service
            </h2>
            {user ? (
              <form onSubmit={handleBooking} className="space-y-4">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded">
                    {error}
                  </div>
                )}
                <Field label="Select Date & Time" htmlFor="date" required>
                  <Input
                    type="datetime-local"
                    id="date"
                    required
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </Field>
                <Field label="Notes" htmlFor="notes" hint="Optional">
                  <Textarea
                    id="notes"
                    rows={3}
                    placeholder="Any special instructions..."
                    value={bookingNotes}
                    onChange={(e) => setBookingNotes(e.target.value)}
                  />
                </Field>
                <Button
                  type="submit"
                  loading={bookingLoading}
                  className="w-full"
                >
                  Book Now
                </Button>
              </form>
            ) : (
              <div className="text-center">
                <p className="mb-4 text-slate-400">
                  Please sign in to book this service
                </p>
                <ButtonLink href="/auth/login">Sign In to Book</ButtonLink>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
