"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import PageHeader from "@/components/layout/PageHeader";
import StatCard from "@/components/features/StatCard";
import { Button, Modal } from "@/components/ui";
import { formatMoney, formatRating } from "@/lib/format";
import { SERVICE_CATEGORIES } from "@/lib/constants";

interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
  location: string;
  availability: {
    days: string[];
    startTime: string;
    endTime: string;
  } | null;
  tags: string[];
  rating: number;
  reviewCount: number;
  isActive: boolean;
  createdAt: string;
}

export default function ProviderDashboard() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    duration: "",
    location: "",
    availability: {
      days: [] as string[],
      startTime: "",
      endTime: "",
    },
    tags: "",
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const { user } = useAuth();

  const fetchServices = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      // Ask the API for this provider's own services directly (the endpoint is
      // paginated, so filtering the first page client-side would hide services
      // once the platform has more than one page of listings).
      const params = new URLSearchParams({
        providerId: user.id,
        limit: "100",
      });
      const response = await fetch(`/api/services?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setServices(data.services || []);
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const serviceData = {
        ...formData,
        price: parseFloat(formData.price),
        duration: parseInt(formData.duration),
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag),
      };

      const url = editingService
        ? `/api/services/${editingService.id}`
        : "/api/services";
      const method = editingService ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(serviceData),
      });

      const data = await response.json();
      if (response.ok) {
        fetchServices();
        setShowCreateForm(false);
        setEditingService(null);
        resetForm();
        toast.success(
          editingService ? "Service updated" : "Service created"
        );
      } else {
        toast.error(data.error || "Failed to save service");
      }
    } catch (error) {
      console.error("Error saving service:", error);
      toast.error("Failed to save service");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description,
      category: service.category,
      price: service.price.toString(),
      duration: service.duration.toString(),
      location: service.location,
      // `availability` may be null for older listings — fall back to an empty
      // schedule so the edit form always has the expected shape.
      availability: service.availability ?? {
        days: [],
        startTime: "",
        endTime: "",
      },
      tags: service.tags.join(", "),
      isActive: service.isActive,
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;

    try {
      const response = await fetch(`/api/services/${serviceId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        setServices(services.filter((service) => service.id !== serviceId));
        toast.success("Service deleted");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete service");
      }
    } catch (error) {
      console.error("Error deleting service:", error);
      toast.error("Failed to delete service");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "",
      price: "",
      duration: "",
      location: "",
      availability: {
        days: [],
        startTime: "",
        endTime: "",
      },
      tags: "",
      isActive: true,
    });
  };

  const handleDayToggle = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        days: prev.availability.days.includes(day)
          ? prev.availability.days.filter((d) => d !== day)
          : [...prev.availability.days, day],
      },
    }));
  };

  const daysOfWeek = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  // Fetch services only after user is loaded
  useEffect(() => {
    if (user) {
      fetchServices();
    }
  }, [user]);

  if (loading || !user) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-slate-800 bg-slate-900"
            />
          ))}
        </div>
        <div className="animate-pulse rounded-lg border border-slate-800 bg-slate-900 p-6">
          <div className="h-4 w-1/3 rounded bg-slate-800" />
        </div>
      </div>
    );
  }

  const activeCount = services.filter((s) => s.isActive).length;
  const avgRating = services.length
    ? services.reduce((sum, s) => sum + s.rating, 0) / services.length
    : 0;
  const totalReviews = services.reduce((sum, s) => sum + s.reviewCount, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Services"
        description="Manage your service offerings and availability."
        actions={
          <Button
            onClick={() => {
              setEditingService(null);
              resetForm();
              setShowCreateForm(true);
            }}
          >
            Add Service
          </Button>
        }
      />

      {/* KPI summary */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard
          label="Services"
          value={services.length}
          hint={`${activeCount} active`}
        />
        <StatCard
          label="Average rating"
          value={`${formatRating(avgRating)} ★`}
          hint={`${totalReviews} reviews`}
        />
        <StatCard
          label="Revenue potential"
          value={formatMoney(
            services.reduce((sum, s) => sum + (s.price || 0), 0)
          )}
          hint="Sum of list prices"
        />
      </div>

      {/* Create/Edit Form Modal */}
      <Modal
        isOpen={showCreateForm}
        onClose={() => {
          if (!submitting) {
            setShowCreateForm(false);
            setEditingService(null);
            resetForm();
          }
        }}
        title={editingService ? "Edit Service" : "Create New Service"}
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setEditingService(null);
                resetForm();
              }}
              className="inline-flex justify-center py-2 px-4 border border-slate-700 shadow-sm text-sm font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="service-form"
              disabled={submitting}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
            >
              {submitting
                ? "Saving..."
                : editingService
                ? "Update Service"
                : "Create Service"}
            </button>
          </>
        }
      >
        <form id="service-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Service Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    className="pl-2 mt-1 block w-full border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor="category"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Category
                  </label>
                  <select
                    id="category"
                    required
                    className="mt-1 block w-full bg-slate-900 text-slate-100 border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                  >
                    <option value="" className="bg-slate-900 text-slate-100" style={{ minWidth: "480px" }}>Select Category</option>
                    {SERVICE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat.toLowerCase()} className="bg-slate-900 text-slate-100" style={{ minWidth: "480px" }}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="price"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Price ($)
                  </label>
                  <input
                    type="number"
                    id="price"
                    required
                    min="0"
                    step="0.01"
                    className="pl-2 mt-1 block w-full border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor="duration"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    id="duration"
                    required
                    min="1"
                    className="pl-2 mt-1 block w-full border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData({ ...formData, duration: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-slate-300"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  required
                  rows={3}
                  className="pl-2 mt-1 block w-full border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="location"
                  className="block text-sm font-medium text-slate-300"
                >
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  required
                  className="pl-2 mt-1 block w-full border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                />
              </div>

              {/* Availability */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Available Days
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {daysOfWeek.map((day) => (
                    <label key={day} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.availability.days.includes(day)}
                        onChange={() => handleDayToggle(day)}
                        className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-slate-300 capitalize">
                        {day}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="startTime"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Start Time
                  </label>
                  <input
                    type="time"
                    id="startTime"
                    required
                    className="mt-1 block w-full border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.availability.startTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        availability: {
                          ...formData.availability,
                          startTime: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor="endTime"
                    className="block text-sm font-medium text-slate-300"
                  >
                    End Time
                  </label>
                  <input
                    type="time"
                    id="endTime"
                    required
                    className="mt-1 block w-full border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.availability.endTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        availability: {
                          ...formData.availability,
                          endTime: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="tags"
                  className="block text-sm font-medium text-slate-300"
                >
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  id="tags"
                  className="pl-2 mt-1 block w-full border-slate-700 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="e.g., professional, reliable, experienced"
                  value={formData.tags}
                  onChange={(e) =>
                    setFormData({ ...formData, tags: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="isActive"
                  className="ml-2 block text-sm text-slate-300"
                >
                  Service is active
                </label>
              </div>

            </form>
      </Modal>

      {/* Services List */}
      <div className="mt-8">
        {services.length !== 0 ? (
          <div className="bg-slate-900 border border-slate-800 shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-slate-800">
              {services.map((service) => (
                <li key={service.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-slate-100">
                            {service.name}
                          </h3>
                          <p className="text-sm text-slate-400">
                            {service.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-slate-100">
                            ${service.price}
                          </div>
                          <div className="text-sm text-slate-500">
                            {service.duration} min
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center space-x-4 text-sm text-slate-400">
                        <span className="capitalize">{service.category}</span>
                        <span>📍 {service.location}</span>
                        <span>
                          ⭐ {service.rating.toFixed(1)} ({service.reviewCount}{" "}
                          reviews)
                        </span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${
                            service.isActive
                              ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                              : "bg-red-500/10 text-red-300 ring-red-500/20"
                          }`}
                        >
                          {service.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div className="mt-2 text-sm text-slate-400">
                        🕒 {service.availability?.days?.length
                          ? service.availability.days.join(", ")
                          : "No availability set"}
                        {service.availability?.startTime && service.availability?.endTime
                          ? `: ${service.availability.startTime} - ${service.availability.endTime}`
                          : ""}
                      </div>

                      {service.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {service.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 ring-1 ring-inset ring-slate-700"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => handleEdit(service)}
                      className="inline-flex items-center px-3 py-1 border border-slate-700 text-sm font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="inline-flex items-center px-3 py-1 border border-red-500/30 text-sm font-medium rounded-md text-red-300 bg-slate-800 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400">No services created yet.</p>
            <button
              onClick={() => {
                setEditingService(null);
                resetForm();
                setShowCreateForm(true);
              }}
              className="text-indigo-400 hover:text-indigo-300 mt-4 inline-block"
            >
              Create your first service
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
