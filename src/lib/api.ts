import axios from 'axios';
import { Listing, RoommateProfile } from './types'; 

// Changed to localhost to match your Google OAuth fix!
// Backend base URL. Always ends in /api (the Django routes live under /api/).
// If VITE_API_URL isn't set on the host, the live Render backend is used.
const RAW_API_URL = (import.meta.env.VITE_API_URL as string | undefined)
  || (import.meta.env.DEV ? 'http://localhost:8000/api' : 'https://setmystay-backend.onrender.com/api');
const API_URL = RAW_API_URL.replace(/\/+$/, '').replace(/(\/api)?$/, '/api');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- 🔐 AUTHENTICATION INTERCEPTOR ---
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- ADAPTERS ---
const adaptPropertyToListing = (data: any): Listing => {
  let mappedType = 'PG';
  if (data.property_type === 'RENTAL') mappedType = 'Rental';
  if (data.property_type === 'ROOMMATE') mappedType = 'Roommate';

  return {
    id: data.id.toString(),
    propertyType: mappedType as any, 
    title: data.title,
    rent: data.rent,
    area: data.sq_ft || 0,
    city: data.city,
    locality: data.area,
    state: 'Maharashtra',
    completeAddress: data.address,
    partialAddress: data.area,
    ownerName: data.owner_name || 'Owner',
    contactPhonePrimary: data.phone_primary || 'Hidden',
    contactPhoneSecondary: data.phone_secondary || undefined,
    description: data.description,
    furnishedStatus: data.furnishing || 'Unfurnished',
    
    // 👇 FIX: Regex strips the [, ], and " characters from the corrupted database strings
    amenities: data.amenities ? data.amenities.map((a: any) => a.name.replace(/[\[\]"]/g, '').trim()).filter(Boolean) : [],
    
    size: data.sq_ft ? `${data.sq_ft} sq ft` : 'N/A',
    images: data.images ? data.images.map((img: any) => img.image_url) : [],
    views: 0,
    ownerId: data.owner || '1',
    brokerStatus: data.is_broker ? 'With Broker' : 'Without Broker', 

    aadhaarCardUrl: data.document_aadhaar || undefined,
    electricityBillUrl: data.document_electricity || undefined,
    nocUrl: data.document_noc || undefined,
    
    lastAvailabilityCheck: data.created_at,
    submittedAt: data.created_at,
    status: data.status === 'APPROVED' ? 'approved' : data.status === 'REJECTED' ? 'rejected' : 'pending',
  };
};

const adaptRoommateToProfile = (data: any): RoommateProfile => {
  return {
    id: data.id.toString(),
    propertyType: 'Roommate',
    ownerName: data.user_name || 'User',
    age: 25,
    rent: data.budget,
    city: data.location_preference,
    locality: data.location_preference,
    state: 'Maharashtra',
    completeAddress: data.location_preference,
    partialAddress: data.location_preference,
    contactPhonePrimary: data.phone_primary || 'Hidden',
    description: `Looking for roommate in ${data.location_preference}`,
    preferences: [
        data.is_smoker ? 'Smoker' : 'Non-Smoker', 
        data.has_pets ? 'Has Pets' : 'No Pets'
    ],
    gender: 'Any',
    images: ['https://placehold.co/400x400'],
    views: 0,
    ownerId: data.user?.toString() || '1',
    hasProperty: false,
    submittedAt: data.created_at || '2025-01-01',
    status: data.status === 'APPROVED' ? 'approved' : data.status === 'REJECTED' ? 'rejected' : 'pending',
  };
};

// --- PAGINATION HELPER ---
// The API returns 50 items per page. Earlier code only read page 1, so listings
// beyond the first page silently disappeared. This follows `next` until done.
export async function fetchAllPages<T = any>(url: string, params: Record<string, any> = {}): Promise<T[]> {
  const out: T[] = [];
  let response = await api.get(url, { params: { page_size: 200, ...params } });
  for (let guard = 0; guard < 50; guard++) {
    const data = response.data;
    if (!data || !Array.isArray(data.results)) return Array.isArray(data) ? data : out;
    out.push(...data.results);
    if (!data.next) break;
    response = await api.get(data.next);
  }
  return out;
}

// --- API CALLS ---
export const getProperties = async (): Promise<Listing[]> => {
  try {
    const rawData = await fetchAllPages('/properties/');
    return rawData.map(adaptPropertyToListing);
  } catch (error) {
    console.error("Failed to fetch properties:", error);
    return [];
  }
};

/** Staff & admin panels: every listing (pending, approved, rejected). Throws if not signed in as staff. */
export const getAdminProperties = async (): Promise<Listing[]> => {
  const rawData = await fetchAllPages('/properties/', { admin: 'true' });
  return rawData.map(adaptPropertyToListing);
};

export interface ReviewSummary {
  pending_count: number;
  latest_pending_id: number | null;
  latest_pending_title: string | null;
  latest_pending_at: string | null;
  approved_count: number;
  rejected_count: number;
}
export const getReviewSummary = async (): Promise<ReviewSummary> => {
  const { data } = await api.get('/properties/review_summary/');
  return data;
};

// --- ADMIN / STAFF SIGN-IN (checked on the server; no secrets in this file) ---
const saveTokens = (data: any) => {
  if (data?.access) {
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
  }
};
export const adminLoginStep = async (step: 'password' | 'pin', password: string, pin = '') => {
  const { data } = await api.post('/auth/admin-login/', { step, password, pin }, { skipAuthRedirect: true } as any);
  return data;
};
export const adminLogin = async (password: string, pin: string, answer: string) => {
  const { data } = await api.post('/auth/admin-login/', { password, pin, answer }, { skipAuthRedirect: true } as any);
  saveTokens(data);
  return data;
};
export const getAdminQuestion = async (): Promise<string> => {
  const { data } = await api.get('/auth/admin-question/');
  return data.question;
};
export const changeAdminCredentials = async (body: {
  current_password: string; new_password?: string; new_pin?: string; new_question?: string; new_answer?: string;
}) => {
  const { data } = await api.post('/auth/admin-credentials/', body);
  return data;
};
export const staffLogin = async (username: string, password: string) => {
  const { data } = await api.post('/auth/staff-login/', { username, password }, { skipAuthRedirect: true } as any);
  saveTokens(data);
  return data;
};

// --- SITE SETTINGS (prices & contact details the admin edits; every visitor sees them) ---
export interface SiteSettings {
  pricing: { unlocks: { '1': number; '5': number; '10': number; unlimited: number }; listings: { roommate: number; pg: number; rental: number } };
  contact_email: string;
  contact_phone: string;
  contact_address: string;
}
export const getSiteSettings = async (): Promise<SiteSettings | null> => {
  try {
    const { data } = await api.get('/site-settings/');
    return data;
  } catch {
    return null;
  }
};
export const updateSiteSettings = async (body: Partial<SiteSettings>) => {
  const { data } = await api.put('/site-settings/', body);
  return data as SiteSettings;
};

/** Called after Razorpay checkout succeeds. The server verifies the signature before recording anything. */
export const verifyPayment = async (body: {
  razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string; plan_name: string; property_id?: string | null;
}) => {
  const { data } = await api.post('/payments/verify-local/', body);
  return data;
};

export const getRoommateProperties = async (): Promise<Listing[]> => {
  try {
    const response = await api.get('/properties/?property_type=ROOMMATE');
    const rawData = response.data.results ? response.data.results : response.data;
    return rawData.map(adaptPropertyToListing);
  } catch (error) {
    console.error("Failed to fetch roommate properties:", error);
    return [];
  }
};

export const getRoommates = async (): Promise<RoommateProfile[]> => {
  try {
    const response = await api.get('/roommates/');
    const rawData = response.data.results ? response.data.results : response.data;
    return rawData.map(adaptRoommateToProfile);
  } catch (error) {
    console.error("Failed to fetch roommates:", error);
    return [];
  }
};

export const createListing = async (formData: FormData) => {
  const response = await api.post('/properties/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const loginUser = async (credentials: { username: string; password: string }) => {
    const response = await api.post('/auth/login/', credentials);
    if (response.data.access) {
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
    }
    return response.data;
};

export const toggleFavoriteProperty = async (propertyId: string) => {
  try {
    const response = await api.post(`/properties/${propertyId}/toggle_favorite/`);
    return response.data;
  } catch (error) {
    console.error("Failed to toggle favorite:", error);
    throw error;
  }
};

export const getMyProperties = async (): Promise<Listing[]> => {
  try {
    const response = await api.get('/my-properties/'); 
    const rawData = response.data.results ? response.data.results : response.data;
    return rawData.map(adaptPropertyToListing);
  } catch (error) {
    console.error("Failed to fetch my properties:", error);
    return [];
  }
};

// --- STAFF PROPERTY & ROOMMATE MANAGEMENT ---
export const updatePropertyStatus = async (id: string, newStatus: string) => {
  try {
    const response = await api.post(`/properties/${id}/update_status/?admin=true`, { status: newStatus.toUpperCase() });
    return response.data;
  } catch (error) {
    console.error("Failed to update property status:", error);
    throw error;
  }
};

export const deleteProperty = async (id: string) => {
  try {
    const response = await api.delete(`/properties/${id}/?admin=true`);
    return response.data;
  } catch (error) {
    console.error("Failed to delete property:", error);
    throw error;
  }
};

export const updateRoommateStatus = async (id: string, newStatus: string) => {
  try {
    const response = await api.patch(`/roommates/${id}/`, { status: newStatus.toUpperCase() });
    return response.data;
  } catch (error) {
    console.error("Failed to update roommate status:", error);
    throw error;
  }
};

export const deleteRoommate = async (id: string) => {
  try {
    const response = await api.delete(`/roommates/${id}/`);
    return response.data;
  } catch (error) {
    console.error("Failed to delete roommate:", error);
    throw error;
  }
};

// --- RESPONSE INTERCEPTOR (WITH AUTO-REFRESH) ---
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 Unauthorized, and we haven't tried to refresh yet
    if (error.response && error.response.status === 401 && !originalRequest._retry && !originalRequest.skipAuthRedirect) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          // Request a new access token using standard axios (to avoid infinite interceptor loops)
          const refreshResponse = await axios.post(`${API_URL}/auth/refresh/`, {
            refresh: refreshToken,
          });

          const newAccessToken = refreshResponse.data.access;
          
          // Save the new token
          localStorage.setItem('access_token', newAccessToken);
          
          // If the backend also rotated the refresh token, save that too
          if (refreshResponse.data.refresh) {
             localStorage.setItem('refresh_token', refreshResponse.data.refresh);
          }

          // Update the failed request's header with the new token
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          
          // Retry the original request seamlessly
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh token expired too → sign out, and send panel users back to *their* login page.
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('setmystay_isLoggedIn');
          localStorage.removeItem('admin_authenticated');
          localStorage.removeItem('staff_authenticated');
          const path = window.location.pathname;
          if (!originalRequest.skipAuthRedirect) {
            if (path.startsWith('/admin') && path !== '/admin/login') window.location.href = '/admin/login';
            else if (path.startsWith('/staff') && path !== '/staff/login') window.location.href = '/staff/login';
          }
        }
      }
    }
    
    // Log if the user's token is valid, but they aren't an admin (403 Forbidden)
    if (error.response && error.response.status === 403) {
        console.warn("403 Forbidden:", originalRequest?.url);
    }

    return Promise.reject(error);
  }
);

// --- COUPON API ---
export const getCoupons = async () => {
  const res = await api.get('/coupons/');
  const raw = res.data.results ? res.data.results : res.data;
  return raw.map((c: any) => ({ ...c, discountPercentage: c.discount_percentage, isActive: c.is_active }));
};
export const createCoupon = async (data: any) => await api.post('/coupons/', { code: data.code, discount_percentage: data.discountPercentage, is_active: data.isActive });
export const updateCoupon = async (id: string, data: any) => await api.patch(`/coupons/${id}/`, { code: data.code, discount_percentage: data.discountPercentage, is_active: data.isActive });
export const deleteCoupon = async (id: string) => await api.delete(`/coupons/${id}/`);

// --- ADVERTISEMENT API ---
export const getAdvertisements = async () => {
  const res = await api.get('/advertisements/');
  const raw = res.data.results ? res.data.results : res.data;
  return raw.map((a: any) => ({ ...a, isActive: a.is_active }));
};
export const createAdvertisement = async (formData: FormData) => await api.post('/advertisements/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateAdvertisement = async (id: string, formData: FormData) => await api.patch(`/advertisements/${id}/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteAdvertisement = async (id: string) => await api.delete(`/advertisements/${id}/`);

// --- STAFF API ---
export const getStaff = async () => {
  const res = await api.get('/staff/');
  const raw = res.data.results ? res.data.results : res.data;
  return raw.map((s: any) => ({
    id: s.id.toString(),
    name: s.first_name || s.username, // Fallback to username if name is empty
    userId: s.username,
    approved_count: s.approved_count,
    rejected_count: s.rejected_count,
    avg_processing_hours: s.avg_processing_hours,
  }));
};
export const createStaff = async (data: any) => {
    return await api.post('/staff/', { first_name: data.name, username: data.userId, password: data.password });
};
export const updateStaff = async (id: string, data: any) => {
    return await api.patch(`/staff/${id}/`, { first_name: data.name, username: data.userId, password: data.password });
};
export const deleteStaff = async (id: string) => {
    return await api.delete(`/staff/${id}/`);
};

export interface PurchaseRecord {
  id: string;
  user_name: string;
  user_email: string;
  plan_name: string;
  amount: string;
  razorpay_payment_id: string;
  created_at: string;
  status: string;
}

export const getMyPurchases = async (): Promise<PurchaseRecord[]> => {
  const response = await api.get('/payments/my-history/');
  return response.data.results ? response.data.results : response.data;
};

export const getAllPurchasesAdmin = async (): Promise<PurchaseRecord[]> => {
  const response = await api.get('/payments/all-history/');
  return response.data.results ? response.data.results : response.data;
};

export default api;

