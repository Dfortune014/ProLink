import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from "axios";
import { authService } from "./auth";

// API Response types
interface ApiError {
  error: string;
  message?: string;
}

interface Profile {
  id?: string;
  user_id?: string;  // Alternative ID field
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  avatar_url?: string;  // Primary field for profile images (from profiles table)
  profile_image_url?: string;  // Backward compatibility
  avatar_key?: string;  // S3 key for the image
  email?: string;
  resume_url?: string;
  resumeUrl?: string;
  resume_key?: string;
  resumeKey?: string;
  show_resume?: boolean;
  [key: string]: unknown;
}

interface Link {
  id: string;
  title: string;
  url: string;
  description?: string;
  order?: number;
  [key: string]: unknown;
}

interface UploadUrlResponse {
  upload_url?: string;  // Lambda returns this
  uploadUrl?: string;  // For backward compatibility
  key: string;
  url: string;
  content_type?: string;  // Exact Content-Type that was signed in the presigned URL
}

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_GATEWAY_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 seconds
});

// Validate API configuration on initialization
if (typeof window !== "undefined" && !import.meta.env.VITE_API_GATEWAY_URL) {
  console.error("⚠️ VITE_API_GATEWAY_URL is not set! API calls will fail.");
}

// Track if we're currently refreshing to avoid multiple refresh calls
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (error?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor: Add Authorization header
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Skip Authorization header for public endpoints
    const publicEndpoints = ['/username/check'];
    const isPublicEndpoint = publicEndpoints.some(endpoint => 
      config.url?.includes(endpoint)
    );
    
    if (isPublicEndpoint) {
      // Don't add Authorization header for public endpoints
      return config;
    }
    
    try {
      const token = await authService.getAccessToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Failed to get access token:", error);
      // Continue without token - some endpoints might be public
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle 401 errors, refresh token, retry request
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError<ApiError> | Error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh the token
        const newToken = await authService.refreshToken();
        
        if (newToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }

        processQueue(null, newToken);
        isRefreshing = false;

        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        isRefreshing = false;

        // Refresh failed - sign out user
        await authService.signOut();
        
        // Redirect to login page
        if (typeof window !== "undefined") {
          window.location.href = "/auth";
        }

        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    return Promise.reject(error);
  }
);

// API Methods

/**
 * Profiles API
 */
export const profilesApi = {
  /**
   * Create or update a user profile (protected)
   */
  createOrUpdate: async (profileData: Partial<Profile>): Promise<Profile> => {
    const response = await api.post<Profile>("/profiles", profileData);
    return response.data;
  },

  /**
   * Get a profile by username (public)
   */
  getByUsername: async (username: string): Promise<Profile> => {
    console.log("🌐 API: Fetching profile for username:", username);
    const response = await api.get<Profile>(`/profiles/${username}`);
    console.log("🌐 API: Profile response received:", {
      status: response.status,
      data: response.data,
      resume_url: response.data?.resume_url,
      resumeUrl: response.data?.resumeUrl,
      resume_key: response.data?.resume_key,
      show_resume: response.data?.show_resume,
      headers: response.headers,
    });
    return response.data;
  },

  /**
   * Get current user's profile status (protected)
   */
  getCurrentUser: async (): Promise<{ user_id: string; username?: string; email?: string; profile_complete: boolean; date_of_birth?: string; fullname?: string }> => {
    const response = await api.get<{ user_id: string; username?: string; email?: string; profile_complete: boolean; date_of_birth?: string; fullname?: string }>("/users/me");
    return response.data;
  },
};

/**
 * Links API
 */
export const linksApi = {
  /**
   * Create a new link (protected)
   */
  create: async (linkData: Omit<Link, "id">): Promise<Link> => {
    const response = await api.post<Link>("/links", linkData);
    return response.data;
  },

  /**
   * Delete a link by ID (protected)
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/links/${id}`);
  },
};

/**
 * Upload API
 */
export const uploadApi = {
  /**
   * Get a presigned URL for file upload (protected)
   * @param fileName - Original filename (e.g., "photo.jpg")
   * @param fileType - MIME type (e.g., "image/jpeg")
   * @param uploadType - Type of upload: "profile_image" or "resume" (defaults to "profile_image")
   */
  getUploadUrl: async (
    fileName: string, 
    fileType: string, 
    uploadType: "profile_image" | "project_image" | "resume" = "profile_image"
  ): Promise<UploadUrlResponse> => {
    // Extract file extension from fileName
    const fileExtension = fileName.includes('.') 
      ? '.' + fileName.split('.').pop()?.toLowerCase() 
      : '';
    
    const response = await api.post<UploadUrlResponse>("/upload-url", {
      file_type: uploadType,
      content_type: fileType,
      file_extension: fileExtension,
    });
    
    return response.data;
  },

  /**
   * Get a presigned URL for viewing/downloading a file (protected)
   * @param key - S3 object key (e.g., "users/123/profile/image.jpg")
   */
  getPresignedUrl: async (key: string): Promise<string> => {
    const response = await api.get<{ url: string; key: string; expires_in: number }>(
      `/presigned-url?key=${encodeURIComponent(key)}`
    );
    return response.data.url;
  },

  /**
   * Get a presigned URL for viewing/downloading a public profile asset (no auth required)
   * @param key - S3 object key (e.g., "users/123/profile/image.jpg" or "users/123/resume/file.pdf")
   */
  getPublicPresignedUrl: async (key: string): Promise<string> => {
    // Use direct fetch for public endpoint (no auth token needed)
    const apiUrl = import.meta.env.VITE_API_GATEWAY_URL;
    
    if (!apiUrl) {
      throw new Error('VITE_API_GATEWAY_URL is not set');
    }
    
    try {
      const response = await fetch(
        `${apiUrl}/public/presigned-url?key=${encodeURIComponent(key)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const error = await response.json();
          errorMessage = error.message || error.error || errorMessage;
        } catch {
          // If response is not JSON, use status text
          const text = await response.text();
          if (text) {
            errorMessage = text;
          }
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      if (!data.url) {
        throw new Error('Presigned URL not found in response');
      }
      return data.url;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to get presigned URL: ${String(error)}`);
    }
  },
};

/**
 * Username Availability Check API
 */
export const authApi = {
    checkUsernameAvailability: async (username: string): Promise<{ available: boolean; username: string }> => {
      const response = await api.get<{ available: boolean; username: string }>(
        `/username/check?username=${encodeURIComponent(username)}`
      );
      return response.data;
    },
  };

// Export the axios instance for custom requests if needed
export { api };
export type { Profile, Link, UploadUrlResponse, ApiError };