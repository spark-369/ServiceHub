"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Rating from "@/components/ui/Rating";
import Spinner from "@/components/ui/Spinner";
import { formatDate } from "@/lib/format";
import type { Review } from "@/lib/types";

interface ReviewModalProps {
  serviceId: string;
  serviceName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReviewModal({ 
  serviceId, 
  serviceName, 
  isOpen, 
  onClose 
}: ReviewModalProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && serviceId) {
      fetchReviews();
    }
  }, [isOpen, serviceId]);

  const fetchReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/services/${serviceId}`);
      const data = await response.json();
      if (response.ok) {
        setReviews(data.reviews || []);
      } else {
        setError(data.error || "Failed to fetch reviews");
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
      setError("Failed to fetch reviews");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={`Reviews for ${serviceName}`}
    >
      {error && (
        <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center">
          <Spinner size="md" className="mx-auto" />
          <p className="mt-2 text-slate-400">Loading reviews...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-slate-400">No reviews yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="border-b border-slate-800 pb-4 last:border-b-0"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
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
    </Modal>
  );
}