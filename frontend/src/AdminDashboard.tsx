
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

type DashboardStats = {
  users: number;
  companies: number;
  internships: number;
  reviews: number;
};

function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadStats() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API}/api/admin/stats`,
          {
            credentials: "include",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load dashboard statistics."
          );
        }

        const data = await response.json();

        const receivedStats = data.stats;

        if (
          !receivedStats ||
          !["users", "companies", "internships", "reviews"].every(
            (key) =>
              typeof receivedStats[key] === "number" &&
              Number.isFinite(receivedStats[key]) &&
              receivedStats[key] >= 0
          )
        ) {
          throw new Error("Invalid dashboard statistics.");
        }

        if (!controller.signal.aborted) {
          setStats(receivedStats as DashboardStats);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadStats();

    return () => controller.abort();
  }, []);

  return (
    <main className="company-dashboard">
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>Platform management and overview.</p>
      </div>

      {loading && (
        <p role="status">Loading statistics...</p>
      )}

      {error && (
        <p role="alert">{error}</p>
      )}

      {!loading && !error && stats && (
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <h2>Users</h2>
            <p>Total registered users</p>
            <strong>{stats.users.toLocaleString()}</strong>
          </div>

          <div className="dashboard-card">
            <h2>Companies</h2>
            <p>Registered companies</p>
            <strong>{stats.companies.toLocaleString()}</strong>
          </div>

          <div className="dashboard-card">
            <h2>Internships</h2>
            <p>Training opportunities</p>
            <strong>{stats.internships.toLocaleString()}</strong>
          </div>

          <div className="dashboard-card">
            <h2>Reviews</h2>
            <p>Student reviews</p>
            <strong>{stats.reviews.toLocaleString()}</strong>
          </div>
        </div>
      )}

      <div className="dashboard-actions">
        <Link to="/">Back to Home</Link>
      </div>
    </main>
  );
}

export default AdminDashboard;
