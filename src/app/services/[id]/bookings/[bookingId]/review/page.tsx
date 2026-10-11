"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Field,
  Textarea,
} from "@/components/ui";

interface Booking {
  id: string;
  status: string;
  service: {
    id: string;
    name: string;
  };
  provider: {
    name: string;
  } | null;
}

/** Human-friendly descriptors shown next to the selected rating. */
const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};

/** Interactive star input. Hovered state highlights up to the cursor, keyboard
 *  works via the arrow keys on the focused first star. */
function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onFocus={() => setHovered(star)}
          onBlur={() => setHovered(0)}
          aria-label={`Rate ${star} out of 5 stars`}
          aria-pressed={value === star}
          className="group rounded-md p-0.5 transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 hover:scale-110 active:scale-95"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className={`h-8 w-8 transition-colors duration-100 ${
              star <= active
                ? "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.35)]"
                : "text-slate-700 group-hover:text-slate-600"
            }`}
          >
            <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L10 14.77l-5.2 2.73.99-5.78-4.21-4.1 5.82-.85L10 1.5z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function ReviewPage() {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const params = useParams();
  const serviceId = params.id as string;
  const bookingId = params.bookingId as string;
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (bookingId && user) {
      fetchBookingDetails();
    }
  }, [bookingId, user]);

  const fetchBookingDetails = async () => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setBooking(data.booking);
      } else {
        setError(data.error || "Booking not found");
      }
    } catch (error) {
      console.error("Error fetching booking details:", error);
      setError("Failed to load booking details");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication required");
        return;
      }

      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId: bookingId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success("Review submitted successfully!");
        router.push("/bookings");
      } else {
        setError(data.error || "Failed to submit review");
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      setError("Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Validate required parameters
  if (!serviceId || !bookingId) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">
          Invalid review URL. Missing required parameters.
        </p>
        <Link
          href="/bookings"
          className="text-indigo-400 hover:text-indigo-300 mt-4 inline-block"
        >
          Back to bookings
        </Link>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="flex items-center justify-center h-[80vh] px-4">
        <div className="bg-slate-900 border border-slate-800 shadow-lg rounded-lg p-8 max-w-md w-full text-center">
          <p className="text-amber-400 text-lg font-semibold mb-4">
            {error || "Booking not found"}
          </p>
          <Link
            href="/bookings"
            className="inline-block mt-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded hover:bg-indigo-500 transition-colors duration-200"
          >
            Back to bookings
          </Link>
        </div>
      </div>
    );
  }

  if (booking.status !== "completed") {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">You can only review completed bookings</p>
        <Link
          href="/bookings"
          className="text-indigo-400 hover:text-indigo-300 mt-4 inline-block"
        >
          Back to bookings
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="overflow-hidden">
        <CardHeader
          title="Leave a Review"
          description="Your feedback helps your neighbours find reliable service providers."
        />

        <CardBody className="space-y-8">
          {/* Service info */}
          <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-800/40 p-4">
            <Avatar name={booking.service.name} size="lg" />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-slate-100">
                {booking.service.name}
              </h2>
              <p className="mt-0.5 truncate text-sm text-slate-400">
                Provided by {booking.provider?.name ?? "Unknown provider"}
              </p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Rating */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  id="rating-label"
                  className="text-sm font-medium text-slate-300"
                >
                  Rating
                </label>
                <span className="text-sm font-semibold text-amber-400">
                  {RATING_LABELS[rating]}
                </span>
              </div>
              <div
                className="mt-2"
                role="radiogroup"
                aria-labelledby="rating-label"
                aria-label="Rating"
              >
                <StarRatingInput value={rating} onChange={setRating} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {rating} out of 5 stars
              </p>
            </div>

            {/* Comment */}
            <Field
              htmlFor="comment"
              label="Your Review"
              hint={`${comment.length}/2000 characters`}
            >
              <Textarea
                id="comment"
                rows={5}
                maxLength={2000}
                placeholder="Share your experience — what went well, and what could be improved..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </Field>

            <CardFooter className="-mx-6 -mb-6 bg-slate-800/20">
              <ButtonLink href="/bookings" variant="secondary">
                Cancel
              </ButtonLink>
              <Button type="submit" loading={submitting}>
                {submitting ? "Submitting..." : "Submit Review"}
              </Button>
            </CardFooter>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
