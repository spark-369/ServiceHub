'use client';

import { useState, useEffect } from 'react';

interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
  location: string;
  isActive: boolean;
  rating: number;
  reviewCount: number;
  createdAt: string;
  provider: {
    id: string;
    name: string;
    email: string;
  } | null;
  _count: {
    bookings: number;
    reviews: number;
  };
}

interface ServiceManagementProps {
  onDataChange?: () => void;
}

export default function ServiceManagement({ onDataChange }: ServiceManagementProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [categories, setCategories] = useState<string[]>([]);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        ...(searchTerm && { search: searchTerm }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(statusFilter !== '' && { isActive: statusFilter }),
      });

      const response = await fetch(`/api/admin/services?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setServices(data.services);
        setPagination(data.pagination);
        setCategories(data.categories || []);
      } else {
        setError(data.error || 'Failed to fetch services');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [currentPage, searchTerm, categoryFilter, statusFilter]);

  const handleUpdateService = async (serviceId: string, updates: any) => {
    try {
      const response = await fetch('/api/admin/services', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ serviceId, updates }),
      });

      if (response.ok) {
        setEditingService(null);
        fetchServices();
        onDataChange?.();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update service');
      }
    } catch (error) {
      setError('Network error occurred');
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/services?id=${serviceId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        fetchServices();
        onDataChange?.();
      } else {
        const data = await response.json();
        if (data.error && data.error.includes('active bookings')) {
          setError(`${data.error} (${data.details?.activeBookings || 0} active booking(s))`);
        } else {
          setError(data.error || 'Failed to delete service');
        }
      }
    } catch (error) {
      setError('Network error occurred');
    }
  };

  const toggleServiceStatus = async (serviceId: string, currentStatus: boolean) => {
    await handleUpdateService(serviceId, { isActive: !currentStatus });
  };

  if (loading && services.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg leading-6 font-medium text-slate-100">Service Management</h3>
          <p className="mt-1 text-sm text-slate-400">
            Manage service listings, categories, and provider offerings
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <input
            type="text"
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-900 text-slate-100 px-3 py-2 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-44"
          >
            <option value="" className="bg-slate-900 text-slate-100" style={{ minWidth: "176px" }}>All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category} className="bg-slate-900 text-slate-100" style={{ minWidth: "176px" }}>
                {category}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 text-slate-100 px-3 py-2 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-40"
          >
            <option value="" className="bg-slate-900 text-slate-100" style={{ minWidth: "160px" }}>All Status</option>
            <option value="true" className="bg-slate-900 text-slate-100" style={{ minWidth: "160px" }}>Active</option>
            <option value="false" className="bg-slate-900 text-slate-100" style={{ minWidth: "160px" }}>Inactive</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4">
          <div className="text-red-300 text-sm">{error}</div>
        </div>
      )}

      {/* Services Table */}
      <div className="bg-slate-900 border border-slate-800 shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-slate-800">
          {services.map((service) => (
            <li key={service.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-slate-100 truncate">
                        {service.name}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">{service.description}</p>
                      <div className="mt-1 text-sm text-slate-500">
                        Category: {service.category} • Location: {service.location}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-semibold text-slate-100">
                        ${service.price}
                      </div>
                      <div className="text-sm text-slate-500">
                        Duration: {service.duration} min
                      </div>
                      <div className="text-sm text-slate-500">
                        ⭐ {service.rating.toFixed(1)} ({service.reviewCount})
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center space-x-4 text-sm text-slate-400">
                    <span>👤 {service.provider?.name ?? "Unknown provider"}</span>
                    <span>📊 Bookings: {service._count.bookings}</span>
                    <span>💬 Reviews: {service._count.reviews}</span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${
                        service.isActive
                          ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
                          : 'bg-red-500/10 text-red-300 ring-red-500/20'
                      }`}
                    >
                      {service.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {service._count.bookings > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20">
                        ⚠️ Has Bookings
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex space-x-2">
                <button
                  onClick={() => setEditingService(service)}
                  className="inline-flex items-center px-3 py-1 border border-slate-700 text-sm font-medium rounded-md text-indigo-300 bg-slate-800 hover:bg-indigo-500/10"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleServiceStatus(service.id, service.isActive)}
                  className={`inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white ${
                    service.isActive
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {service.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDeleteService(service.id)}
                  disabled={service._count.bookings > 0}
                  className={`inline-flex items-center px-3 py-1 border text-sm font-medium rounded-md ${
                    service._count.bookings > 0
                      ? 'text-slate-500 border-slate-800 bg-slate-800/50 cursor-not-allowed'
                      : 'text-red-300 border-red-500/30 bg-slate-800 hover:bg-red-500/10'
                  }`}
                  title={service._count.bookings > 0 ? 'Cannot delete service with existing bookings' : 'Delete service'}
                >
                  {service._count.bookings > 0 ? '⚠️ Delete' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>

        {services.length === 0 && !loading && (
          <div className="px-6 py-8 text-center text-slate-400">
            No services found
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm border border-slate-700 rounded-md text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800"
            >
              Previous
            </button>
            <span className="px-3 py-2 text-sm text-slate-300">
              Page {currentPage} of {pagination.pages}
            </span>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === pagination.pages}
              className="px-3 py-2 text-sm border border-slate-700 rounded-md text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {editingService && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <h3 className="text-lg font-medium text-slate-100 mb-4">Edit Service</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const updates = {
                  name: formData.get('name'),
                  description: formData.get('description'),
                  category: formData.get('category'),
                  price: parseFloat(formData.get('price') as string),
                  duration: parseInt(formData.get('duration') as string),
                  location: formData.get('location'),
                  isActive: formData.get('isActive') === 'true',
                };
                handleUpdateService(editingService.id, updates);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-300">Name</label>
                <input
                  name="name"
                  defaultValue={editingService.name}
                  className="mt-1 block w-full border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Description</label>
                <textarea
                  name="description"
                  defaultValue={editingService.description}
                  rows={3}
                  className="mt-1 block w-full border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Category</label>
                <input
                  name="category"
                  defaultValue={editingService.category}
                  className="mt-1 block w-full border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Price ($)</label>
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    defaultValue={editingService.price}
                    className="mt-1 block w-full border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Duration (min)</label>
                  <input
                    name="duration"
                    type="number"
                    defaultValue={editingService.duration}
                    className="mt-1 block w-full border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Location</label>
                <input
                  name="location"
                  defaultValue={editingService.location}
                  className="mt-1 block w-full border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Status</label>
                <select
                  name="isActive"
                  defaultValue={editingService.isActive.toString()}
                  className="mt-1 block w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="true" className="bg-slate-900 text-slate-100" style={{ minWidth: "400px" }}>Active</option>
                  <option value="false" className="bg-slate-900 text-slate-100" style={{ minWidth: "400px" }}>Inactive</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}