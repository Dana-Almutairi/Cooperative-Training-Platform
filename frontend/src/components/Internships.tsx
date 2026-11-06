
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

interface Internship {
  id: number;
  company_id: number;
  title: string;
  description: string | null;
  location: string | null;
  status: string | null;
  company_name: string;
}

interface InternshipsResponse {
  success: boolean;
  count: number;
  internships: Internship[];
}

function Internships() {
  const [internships, setInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchInternships() {
      try {
        const response = await fetch(
          `${API_URL}/api/internships`,
          {
            credentials: "include",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load training opportunities.");
        }

        const contentType =
          response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          throw new Error("Server returned an unexpected response.");
        }

        const data: InternshipsResponse = await response.json();

        if (!data.success || !Array.isArray(data.internships)) {
          throw new Error("Invalid internship data.");
        }

        setInternships(data.internships);
        setError(null);
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

    fetchInternships();

    return () => controller.abort();
  }, []);

  const cities = useMemo(() => {
    return Array.from(
      new Set(
        internships
          .map((item) => item.location?.trim())
          .filter((city): city is string => Boolean(city))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [internships]);

  const filteredInternships = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    return internships.filter((internship) => {
      const matchesSearch =
        internship.title.toLowerCase().includes(search) ||
        internship.company_name.toLowerCase().includes(search) ||
        (internship.location ?? "").toLowerCase().includes(search);

      const matchesCity =
        selectedCity === "all" ||
        (internship.location ?? "").toLowerCase() ===
          selectedCity.toLowerCase();

      const matchesStatus =
        selectedStatus === "all" ||
        (internship.status ?? "").toLowerCase() ===
          selectedStatus.toLowerCase();

      return matchesSearch && matchesCity && matchesStatus;
    });
  }, [internships, searchTerm, selectedCity, selectedStatus]);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCity("all");
    setSelectedStatus("all");
  };

  return (
    <section className="internships-section" id="opportunities">
      <div className="internships-container">
        <span className="section-label">
          TRAINING OPPORTUNITIES
        </span>

        <h2>Explore Training Opportunities</h2>

        <p className="section-description">
          Discover cooperative training opportunities and take
          the next step toward your career.
        </p>

        <div className="internships-search">
          <input
            type="search"
            placeholder="Search by opportunity, company, or city..."
            aria-label="Search training opportunities"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="internships-filters">
          <div className="filter-group">
            <label htmlFor="city-filter">City</label>

            <select
              id="city-filter"
              value={selectedCity}
              onChange={(event) => setSelectedCity(event.target.value)}
            >
              <option value="all">All Cities</option>

              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="status-filter">Status</label>

            <select
              id="status-filter"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <div className="clear-filters-container">
          <button
            type="button"
            className="clear-filters-btn"
            onClick={clearFilters}
            disabled={
              searchTerm === "" &&
              selectedCity === "all" &&
              selectedStatus === "all"
            }
          >
            Clear Filters
          </button>
        </div>

        {loading && <p>Loading opportunities...</p>}

        {error && <p role="alert">{error}</p>}

        {!loading && !error && internships.length === 0 && (
          <p>No training opportunities available yet.</p>
        )}

        {!loading &&
          !error &&
          internships.length > 0 &&
          filteredInternships.length === 0 && (
            <p className="search-empty">
              No opportunities match your search.
            </p>
          )}

        {!loading && !error && filteredInternships.length > 0 && (
          <div className="internships-grid">
            {filteredInternships.map((internship) => {
              const status = (internship.status ?? "unknown")
                .trim()
                .toLowerCase();

              return (
                <article
                  className="internship-card"
                  key={internship.id}
                >
                  <div className="internship-card-header">
                    <span
                      className={`internship-status status-${status}`}
                    >
                      {internship.status || "Unknown"}
                    </span>

                    <span className="internship-demo">
                      Demo Opportunity
                    </span>
                  </div>

                  <h3>{internship.title}</h3>

                  <p className="internship-company">
                    {internship.company_name}
                  </p>

                  <p className="internship-location">
                    📍 {internship.location || "Location not specified"}
                  </p>

                  <p className="internship-description">
                    {internship.description ||
                      "No description available."}
                  </p>

                  <div className="internship-card-actions">
                    <Link
                      to={`/internships/${internship.id}`}
                      className="internship-details-btn"
                    >
                      View Details →
                    </Link>

                    <Link
                      to={`/companies/${internship.company_id}`}
                      className="company-view-btn"
                    >
                      View Company →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default Internships;
