
import { useEffect, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";

import CompanyDetails from "./CompanyDetails";
import Companies from "./components/Companies";
import Internships from "./components/Internships";
import InternshipDetails from "./InternshipDetails";
import Register from "./Register";
import Login from "./Login";
import StudentDashboard from "./StudentDashboard";
import ProtectedRoute from "./ProtectedRoute";
import CompanyDashboard from "./CompanyDashboard";
import AdminDashboard from "./AdminDashboard";

import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

type User = {
  id: number;
  full_name: string;
  email: string;
  role: string;
};

function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  // Check if the user is logged in
  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const response = await fetch(
          `${API_URL}/api/auth/me`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          if (active) {
            setUser(null);
          }
          return;
        }

        const data = await response.json();

        if (active) {
          setUser(data.user);
        }
      } catch (error) {
        console.error(
          "Authentication check failed:",
          error
        );

        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setCheckingAuth(false);
        }
      }
    }

    checkAuth();

    return () => {
      active = false;
    };
  }, []);

  // Log out the current user
  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");

    try {
      // Step 1: Get CSRF token
      const csrfResponse = await fetch(
        `${API_URL}/api/csrf-token`,
        {
          credentials: "include",
        }
      );

      if (!csrfResponse.ok) {
        throw new Error(
          "Could not initialize security token."
        );
      }

      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.csrfToken;

      if (
        typeof csrfToken !== "string" ||
        !csrfToken
      ) {
        throw new Error("Invalid security token.");
      }

      // Step 2: Log out with CSRF token
      const response = await fetch(
        `${API_URL}/api/auth/logout`,
        {
          method: "POST",
          headers: {
            "x-csrf-token": csrfToken,
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Logout failed. Please try again."
        );
      }

      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);

      setLogoutError(
        "Could not log out. Please try again."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="app">
      <header className="navbar">
        <div className="logo">CoTrain.</div>

        <nav>
          <a href="#home">Home</a>
          <a href="#companies">Companies</a>
          <a href="#opportunities">
            Opportunities
          </a>
          <a href="#about">About</a>
        </nav>

        <div className="navbar-auth">
          {checkingAuth ? (
            <span>Loading...</span>
          ) : user ? (
            <>
              <span className="navbar-username">
                Welcome, {user.full_name}
              </span>

              {(user.role === "student" ||
                user.role === "company") && (
                <Link
                  to={
                    user.role === "student"
                      ? "/student/dashboard"
                      : "/company/dashboard"
                  }
                  className="dashboard-link"
                >
                  My Dashboard
                </Link>
              )}

              <button
                type="button"
                className="logout-btn"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut
                  ? "Logging Out..."
                  : "Logout"}
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="navbar-login-link"
              >
                Log In
              </Link>

              <Link
                to="/register"
                className="login-btn"
              >
                Register
              </Link>
            </>
          )}
        </div>

        {logoutError && (
          <p
            role="alert"
            className="auth-error"
          >
            {logoutError}
          </p>
        )}
      </header>

      <main>
        <section
          className="hero"
          id="home"
        >
          <div className="hero-content">
            <span className="badge">
              Your Career Journey Starts Here
            </span>

            <h1>
              Discover Your Next
              <span>
                {" "}Training Opportunity.
              </span>
            </h1>

            <p>
              Explore cooperative training
              opportunities, discover companies,
              and learn from real student
              experiences — all in one platform.
            </p>

            <div className="hero-buttons">
              <a
                href="#companies"
                className="primary-btn"
              >
                Explore Companies
              </a>

              <a
                href="#about"
                className="secondary-btn"
              >
                Learn More
              </a>
            </div>
          </div>
        </section>

        <Companies />
        <Internships />

        <section
          className="features"
          id="about"
        >
          <h2>
            Everything You Need to Start
            Your Career
          </h2>

          <p className="section-description">
            Find opportunities, explore
            companies, and make informed
            decisions about your training
            journey.
          </p>

          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">
                01
              </div>

              <h3>Discover Companies</h3>

              <p>
                Explore organizations offering
                cooperative training opportunities.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                02
              </div>

              <h3>Student Experiences</h3>

              <p>
                Learn from previous trainees
                and their experiences.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                03
              </div>

              <h3>Explore Opportunities</h3>

              <p>
                Browse available internships and use
                search filters to discover opportunities
                that interest you.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <h3>CoTrain.</h3>

        <p>
          Connecting Students with Opportunities.
        </p>

        <span>
          © 2026 CoTrain. All rights reserved.
        </span>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<HomePage />}
      />

      <Route
        path="/companies/:id"
        element={<CompanyDetails />}
      />

      <Route
        path="/internships/:id"
        element={<InternshipDetails />}
      />

      <Route
        path="/register"
        element={<Register />}
      />

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute
            allowedRoles={["student"]}
          >
            <StudentDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/company/dashboard"
        element={
          <ProtectedRoute
            allowedRoles={["company"]}
          >
            <CompanyDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute
            allowedRoles={["admin"]}
          >
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
