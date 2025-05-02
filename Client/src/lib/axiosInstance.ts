import axios from "axios";
import { toast } from "react-hot-toast";
const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const axiosInstance = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        toast.error(data?.message || "Unauthorized. Please log in again.", {
          duration: 3000,
          style: {
            borderRadius: "10px",
            background: "#333",
            color: "#fff",
          },
        });
      } else if (status === 403) {
        toast.error(data?.message || "You don't have permission.", {
          duration: 3000,
          style: {
            borderRadius: "10px",
            background: "#333",
            color: "#fff",
          },
        });
      } else if (status >= 500) {
        toast.error(data?.message || "Server error. Please try again later.", {
          duration: 3000,
          style: {
            borderRadius: "10px",
            background: "#333",
            color: "#fff",
          },
        });
      }
    } else if (error.request) {
      console.error("Network Error:", error.request);
      toast.error("Network error. Please check your connection.", {
        duration: 3000,
        style: {
          borderRadius: "10px",
          background: "#333",
          color: "#fff",
        },
      });
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
