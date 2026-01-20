export const BACKEND_URL = "http://127.0.0.1:8000";

import axios from "axios";

export const api_public = axios.create({
  baseURL: BACKEND_URL + "/api/",
});

const api = axios.create({
  baseURL: BACKEND_URL + "/api/",
});

// -------------------------------
// REQUEST INTERCEPTOR
// -------------------------------
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("access") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token");


    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// -------------------------------
// RESPONSE INTERCEPTOR
// -------------------------------
api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // no server response
    if (!error.response) {
      return Promise.reject(error);
    }

    // If refresh_token no longer exists -> logout immediately
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      return Promise.reject(error);
    }

    // If request unauthorized and can be retried
    if (
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const res = await api_public.post("/token/refresh/", {
          refresh: refreshToken,
        });

        const newAccessToken = res.data.access;

        localStorage.setItem("access", newAccessToken);
        localStorage.setItem("access_token", newAccessToken);


        api.defaults.headers.common["Authorization"] =
          "Bearer " + newAccessToken;
        originalRequest.headers["Authorization"] =
          "Bearer " + newAccessToken;

        return api(originalRequest);
      } catch (refreshError) {
        // refresh failed → cleanup tokens & logout
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");

        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
