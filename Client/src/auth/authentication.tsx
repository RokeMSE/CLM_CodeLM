import { useState, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import api from "@/lib/axiosInstance";
import { Spinner } from "@/components/ui/spinner";

export default function RequireAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState("pending"); // "pending" | "true" | "false"
  const location = useLocation();

  useEffect(() => {
    api
      .post("/check_token")
      .then((response) => {
        if (response.status === 200) {
          setIsAuthenticated("true");
        } else {
          setIsAuthenticated("false");
        }
      })
      .catch(() => {
        setIsAuthenticated("false");
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
    api
      .post("/check_token")
      .then((response) => {
        if (response.status === 200) {
          setIsAuthenticated("true");
        } else {
          setIsAuthenticated("false");
        }
      })
      .catch(() => {
        setIsAuthenticated("false");
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
