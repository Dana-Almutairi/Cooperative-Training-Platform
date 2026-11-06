
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

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

interface InternshipResponse {
  success: boolean;
  internship: Internship;
}

interface ApiResponse {
  success: boolean;
  message?: string;
}

interface StudentApplication {
  id: number;
  internship_id: number;
  status: "pending" | "accepted" | "rejected";
}

interface MyApplicationsResponse {
  success: boolean;
  applications?: StudentApplication[];
  message?: string;
}

function InternshipDetails() {
  const { id } = useParams<{ id: string }>();

  const [internship, setInternship] =
    useState<Internship | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [applying, setApplying] = useState(false);
  const [checkingApplication, setCheckingApplication] =
    useState(true);

  const [applicationMessage, setApplicationMessage] =
    useState<string | null>(null);

  const [applicationSuccess, setApplicationSuccess] =
    useState(false);

  const [alreadyApplied, setAlreadyApplied] =
    useState(false);

  const [applicationCheckError, setApplicationCheckError] =
    useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPage() {
      setLoading(true);
      setCheckingApplication(true);
      setError(null);
      setApplicationCheckError(null);
      setApplicationMessage(null);
      setApplicationSuccess(false);
      setAlreadyApplied(false);
      setInternship(null);

      try {
        const response = await fetch(
          `${API_URL}/api/internships/${id}`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(
              "Training opportunity not found."
            );
          }

          throw new Error(
            "Failed to load training opportunity."
          );
        }

        const data: InternshipResponse =
          await response.json();

        if (!data.success || !data.internship) {
          throw new Error("Invalid internship data.");
        }

        if (!controller.signal.aborted) {
          setInternship(data.internship);
        }
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

      // Check whether the logged-in student
      // has already applied for this internship.
      try {
        const response = await fetch(
          `${API_URL}/api/applications/my`,
          {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
          }
        );

        // Visitors who are not logged in,
        // or users with other roles, cannot
        // access the student applications API.
        if (
          response.status === 401 ||
          response.status === 403
        ) {
          return;
        }

        if (!response.ok) {
          throw new Error(
            "Unable to check your previous applications."
          );
        }

        const data: MyApplicationsResponse =
          await response.json();

        if (
          !data.success ||
          !Array.isArray(data.applications)
        ) {
          throw new Error(
            "Invalid application history."
          );
        }

        const internshipId = Number(id);

        const hasApplied = data.applications.some(
          (application) =>
            application.internship_id === internshipId
        );

        if (!controller.signal.aborted) {
          setAlreadyApplied(hasApplied);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setApplicationCheckError(
          err instanceof Error
            ? err.message
            : "Unable to check application status."
        );
      } finally {
        if (!controller.signal.aborted) {
          setCheckingApplication(false);
        }
      }
    }

    loadPage();

    return () => controller.abort();
  }, [id]);

  async function handleApply() {
    if (
      !internship ||
      applying ||
      alreadyApplied ||
      checkingApplication ||
      applicationCheckError
    ) {
      return;
    }

    if (internship.status !== "open") {
      setApplicationSuccess(false);
      setApplicationMessage(
        "This opportunity is currently closed."
      );
      return;
    }

    try {
      setApplying(true);
      setApplicationMessage(null);
      setApplicationSuccess(false);

      // Get CSRF token using the current session
      const csrfResponse = await fetch(
        `${API_URL}/api/csrf-token`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!csrfResponse.ok) {
        throw new Error(
          "Unable to verify your session. Please try again."
        );
      }

      const csrfData = await csrfResponse.json();

      if (
        !csrfData.success ||
        typeof csrfData.csrfToken !== "string"
      ) {
        throw new Error(
          "Unable to obtain a security token."
        );
      }

      // Submit application
      const response = await fetch(
        `${API_URL}/api/applications`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfData.csrfToken,
          },
          body: JSON.stringify({
            internship_id: internship.id,
          }),
        }
      );

      const data: ApiResponse = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 401) {
          throw new Error(
            "Please log in as a student to apply."
          );
        }

        if (response.status === 403) {
          throw new Error(
            data.message ||
              "Only students can apply for internships."
          );
        }

        if (
          response.status === 409 &&
          data.message
            ?.toLowerCase()
            .includes("already applied")
        ) {
          setAlreadyApplied(true);
        }

        throw new Error(
          data.message ||
            "Failed to submit application."
        );
      }

      setApplicationSuccess(true);
      setAlreadyApplied(true);

      setApplicationMessage(
        data.message ||
          "Application submitted successfully!"
      );
    } catch (err) {
      setApplicationSuccess(false);
      setApplicationMessage(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setApplying(false);
    }
  }

  return (
    <main className="internship-details-page">
      <div className="internship-details-container">
        <Link
          to="/#opportunities"
          className="back-link"
        >
          ← Back to Opportunities
        </Link>

        {loading && (
          <p>Loading opportunity details...</p>
        )}

        {error && <p role="alert">{error}</p>}

        {!loading && !error && internship && (
          <article className="internship-details-card">
            <span className="internship-demo">
              Demo Opportunity
            </span>

            <h1>{internship.title}</h1>

            <p className="internship-company">
              {internship.company_name}
            </p>

            <div className="internship-details-info">
              <p>
                <strong>Location:</strong>{" "}
                {internship.location ||
                  "Not specified"}
              </p>

              <p>
                <strong>Status:</strong>{" "}
                {internship.status || "Unknown"}
              </p>
            </div>

            <h2>About This Opportunity</h2>

            <p className="internship-details-description">
              {internship.description ||
                "No description available."}
            </p>

            <Link
              to={`/companies/${internship.company_id}`}
              className="company-view-btn"
            >
              View Company →
            </Link>

            <div style={{ marginTop: "24px" }}>
              {internship.status === "open" ? (
                <button
                  type="button"
                  className="company-view-btn"
                  onClick={handleApply}
                  disabled={
                    applying ||
                    alreadyApplied ||
                    checkingApplication ||
                    !!applicationCheckError
                  }
                  style={{
                    cursor:
                      applying ||
                      alreadyApplied ||
                      checkingApplication ||
                      !!applicationCheckError
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      applying ||
                      alreadyApplied ||
                      checkingApplication ||
                      !!applicationCheckError
                        ? 0.65
                        : 1,
                  }}
                >
                  {checkingApplication
                    ? "Checking application..."
                    : applying
                    ? "Submitting..."
                    : alreadyApplied
                    ? "Already Applied"
                    : applicationCheckError
                    ? "Application Unavailable"
                    : "Apply for Internship"}
                </button>
              ) : (
                <p>
                  Applications are closed for this
                  opportunity.
                </p>
              )}

              {applicationCheckError && (
                <p
                  role="alert"
                  style={{
                    marginTop: "12px",
                    color: "#dc2626",
                  }}
                >
                  {applicationCheckError}
                </p>
              )}

              {applicationMessage && (
                <p
                  role="status"
                  style={{
                    marginTop: "12px",
                    color: applicationSuccess
                      ? "#15803d"
                      : "#dc2626",
                  }}
                >
                  {applicationMessage}
                </p>
              )}
            </div>
          </article>
        )}
      </div>
    </main>
  );
}

export default InternshipDetails;
