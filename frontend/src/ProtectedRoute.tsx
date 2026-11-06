
import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";

type User = {
  id: number;
  full_name: string;
  email: string;
  role: string;
};

type ProtectedRouteProps = {
  children: ReactNode;
  allowedRoles?: string[];
};

function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkAuthentication() {
      try {
        const response = await fetch(
          "http://localhost:5000/api/auth/me",
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (active) {
          setUser(data.user);
        }
      } catch (error) {
        console.error("Authentication error:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    checkAuthentication();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p>Checking authentication...</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <p>403 - Access Denied</p>;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
