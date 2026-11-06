
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

interface Company {
  id: number;
  company_name: string;
  industry: string | null;
  location: string | null;
  description: string | null;
  website: string | null;
}

interface CompaniesResponse {
  success: boolean;
  count: number;
  companies: Company[];
}

function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchCompanies() {
      try {
        const response = await fetch(
          `${API_URL}/api/companies`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch companies.");
        }

        const contentType =
          response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          throw new Error(
            "Server returned an unexpected response."
          );
        }

        const data: CompaniesResponse =
          await response.json();

        if (
          !data.success ||
          !Array.isArray(data.companies)
        ) {
          throw new Error("Invalid API response.");
        }

        setCompanies(data.companies);
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchCompanies();

    return () => controller.abort();
  }, []);

  return (
    <section
      className="companies-section"
      id="companies"
    >
      <div className="companies-container">
        <span className="section-label">
          EXPLORE COMPANIES
        </span>

        <h2>Find Your Ideal Training Company</h2>

        <p className="section-description">
          Explore organizations and discover
          training opportunities that match
          your career goals.
        </p>

        {loading && <p>Loading companies...</p>}

        {error && (
          <p role="alert">{error}</p>
        )}

        {!loading &&
          !error &&
          companies.length === 0 && (
            <p>No companies available yet.</p>
          )}

        {!loading && !error && (
          <div className="companies-grid">
            {companies.map((company) => (
              <article
                className="company-card"
                key={company.id}
              >
                <div className="company-avatar">
                  {company.company_name.charAt(0)}
                </div>

                <h3>{company.company_name}</h3>

                <span className="company-industry">
                  {company.industry ||
                    "Industry not specified"}
                </span>

                <p className="company-location">
                  📍{" "}
                  {company.location ||
                    "Location not specified"}
                </p>

                <p className="company-description">
                  {company.description ||
                    "No description available."}
                </p>

                <span className="company-demo-label">
                  Demo Company
                </span>

                <Link
                  to={`/companies/${company.id}`}
                  className="company-view-btn"
                >
                  View Company →
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default Companies;
