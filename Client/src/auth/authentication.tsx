import { useState, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Spinner } from "@/components/ui/spinner";

export default function RequireAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState("pending"); // "pending" | "true" | "false"
  const location = useLocation();

  useEffect(() => {
    axios
      .post(
        "http://localhost:8000/check_token",
        {},
        {
          withCredentials: true,
        },
      )
      .then((response) => {
        if (response.status === 200) {
          setIsAuthenticated("true");
          toast.success("Session is valid", {
            duration: 2000,
            style: {
              borderRadius: "10px",
              background: "#333",
              color: "#fff",
            },
          });
        } else {
          setIsAuthenticated("false");
          toast.error("Session expired. Please log in again.", {
            duration: 2000,
            style: {
              borderRadius: "10px",
              background: "#333",
              color: "#fff",
            },
          });
        }
      })
      .catch(() => {
        setIsAuthenticated("false");
        toast.error("Session expired. Please log in again.", {
          duration: 2000,
          style: {
            borderRadius: "10px",
            background: "#333",
            color: "#fff",
          },
        });
      });
  }, []);

  if (isAuthenticated === "false") {
    return <Navigate to="/login" state={{ from: location }} />;
  } else if (isAuthenticated === "pending") {
    return (
      <div className="w-full h-screen bg-zinc-900 flex items-center justify-center">
        <Spinner size={"large"} />
      </div>
    );
  }
  return <Outlet />;
}

export function PublicAuth() {
  // check auth in login and register and reset
  const [isAuthenticated, setIsAuthenticated] = useState("pending"); // "pending" | "true" | "false"
  const location = useLocation();

  useEffect(() => {
    axios
      .post(
        "http://localhost:8000/check_token",
        {},
        {
          withCredentials: true,
        },
      )
      .then((response) => {
        if (response.status === 200) {
          setIsAuthenticated("true");
          toast.success("Session is valid", {
            duration: 2000,
            style: {
              borderRadius: "10px",
              background: "#333",
              color: "#fff",
            },
          });
        } else {
          setIsAuthenticated("false");
          toast.error("Session expired. Please log in again.", {
            duration: 2000,
            style: {
              borderRadius: "10px",
              background: "#333",
              color: "#fff",
            },
          });
        }
      })
      .catch(() => {
        setIsAuthenticated("false");
        toast.error("Session expired. Please log in again.", {
          duration: 2000,
          style: {
            borderRadius: "10px",
            background: "#333",
            color: "#fff",
          },
        });
      });
  }, []);

  if (isAuthenticated === "true") {
    return <Navigate to="/chats" state={{ from: location }} />;
  } else if (isAuthenticated === "pending") {
    return (
      <div className="w-full h-screen bg-zinc-900 flex items-center justify-center">
        <Spinner size={"large"} />
      </div>
    );
  }
  // If the user is not authenticated, render the child components
  return <Outlet />;
}
