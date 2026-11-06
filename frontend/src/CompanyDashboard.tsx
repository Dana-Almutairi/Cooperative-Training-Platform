
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

const API = "http://localhost:5000";

type Company = {
  id: number;
  user_id: number;
  company_name: string;
  industry: string | null;
  location: string | null;
  description: string | null;
  website: string | null;
};

type Internship = {
  id: number;
  company_id: number;
  title: string;
  description: string | null;
  location: string | null;
  status: string;
  created_at: string;
};

type ApplicationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "completed";

type Application = {
  id: number;
  student_id: number;
  internship_id: number;
  status: ApplicationStatus;
  applied_at: string;
  student_name: string;
  internship_title: string;
  company_name: string;
};

type CompanyReview = {
  id: number;
  student_id: number;
  company_id: number;
  rating: number;
  comment: string | null;
  created_at: string | null;
  student_name: string;
};

function CompanyDashboard() {
  const [company, setCompany] = useState<Company | null>(null);
  const [internships, setInternships] = useState<Internship[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [reviews, setReviews] = useState<CompanyReview[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState("");
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");

  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyApplicationId, setBusyApplicationId] =
    useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [applicationMessage, setApplicationMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadReviews(companyId: number) {
      try {
        setReviewsLoading(true);
        setReviewsError("");

        const response = await fetch(
          `${API}/api/companies/${companyId}/reviews`,
          {
            credentials: "include",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (
          !response.ok ||
          !data.success ||
          !Array.isArray(data.reviews)
        ) {
          throw new Error(
            data.message || "Failed to load company reviews."
          );
        }

        if (!controller.signal.aborted) {
          setReviews(data.reviews);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setReviewsError(
            err instanceof Error
              ? err.message
              : "Failed to load reviews."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setReviewsLoading(false);
        }
      }
    }

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const [companyResponse, internshipsResponse] =
          await Promise.all([
            fetch(`${API}/api/company/me`, {
              credentials: "include",
              signal: controller.signal,
            }),
            fetch(`${API}/api/company/internships`, {
              credentials: "include",
              signal: controller.signal,
            }),
          ]);

        if (!companyResponse.ok || !internshipsResponse.ok) {
          throw new Error("Failed to load dashboard.");
        }

        const companyData = await companyResponse.json();
        const internshipsData = await internshipsResponse.json();

        if (
          !companyData.company ||
          !Array.isArray(internshipsData.internships)
        ) {
          throw new Error("Invalid dashboard data.");
        }

        if (!controller.signal.aborted) {
          setCompany(companyData.company);
          setInternships(internshipsData.internships);
          await loadReviews(companyData.company.id);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong."
          );
          setReviewsLoading(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    async function loadApplications() {
      try {
        setApplicationsLoading(true);
        setApplicationsError("");

        const response = await fetch(
          `${API}/api/applications/company`,
          {
            credentials: "include",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Failed to load applications."
          );
        }

        if (!Array.isArray(data.applications)) {
          throw new Error("Invalid applications data.");
        }

        if (!controller.signal.aborted) {
          setApplications(data.applications);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setApplicationsError(
            err instanceof Error
              ? err.message
              : "Failed to load applications."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setApplicationsLoading(false);
        }
      }
    }

    loadDashboard();
    loadApplications();

    return () => controller.abort();
  }, []);

  function showError(err: unknown) {
    setActionError(
      err instanceof Error
        ? err.message
        : "Something went wrong."
    );
  }

  async function getCsrfToken(): Promise<string> {
    const response = await fetch(`${API}/api/csrf-token`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Could not initialize security token.");
    }

    const data = await response.json();

    if (
      typeof data.csrfToken !== "string" ||
      !data.csrfToken
    ) {
      throw new Error("Invalid security token.");
    }

    return data.csrfToken;
  }

  async function request(
    url: string,
    method: "POST" | "PUT" | "DELETE" | "PATCH",
    body?: object
  ) {
    const csrfToken = await getCsrfToken();

    const response = await fetch(`${API}${url}`, {
      method,
      credentials: "include",
      headers: {
        "x-csrf-token": csrfToken,
        ...(body
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Request failed.");
    }

    return data;
  }

  async function handleCreate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    setActionError("");

    try {
      const data = await request(
        "/api/company/internships",
        "POST",
        {
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
        }
      );

      setInternships((previous) => [
        data.internship,
        ...previous,
      ]);

      setTitle("");
      setDescription("");
      setLocation("");
      setMessage("Internship created successfully!");
    } catch (err) {
      showError(err);
    } finally {
      setCreating(false);
    }
  }

  function startEditing(internship: Internship) {
    setEditingId(internship.id);
    setEditTitle(internship.title);
    setEditDescription(internship.description || "");
    setEditLocation(internship.location || "");
    setMessage("");
    setActionError("");
  }

  async function handleSave(
    event: FormEvent<HTMLFormElement>,
    internship: Internship
  ) {
    event.preventDefault();
    setBusyId(internship.id);
    setMessage("");
    setActionError("");

    try {
      const data = await request(
        `/api/company/internships/${internship.id}`,
        "PUT",
        {
          title: editTitle.trim(),
          description: editDescription.trim(),
          location: editLocation.trim(),
          status: internship.status,
        }
      );

      setInternships((previous) =>
        previous.map((item) =>
          item.id === internship.id
            ? data.internship
            : item
        )
      );

      setEditingId(null);
      setMessage("Internship updated successfully!");
    } catch (err) {
      showError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleStatus(internship: Internship) {
    const newStatus =
      internship.status === "open" ? "closed" : "open";

    setBusyId(internship.id);
    setMessage("");
    setActionError("");

    try {
      const data = await request(
        `/api/company/internships/${internship.id}`,
        "PUT",
        {
          title: internship.title,
          description: internship.description || "",
          location: internship.location || "",
          status: newStatus,
        }
      );

      setInternships((previous) =>
        previous.map((item) =>
          item.id === internship.id
            ? data.internship
            : item
        )
      );

      setMessage(
        `Internship ${newStatus} successfully!`
      );
    } catch (err) {
      showError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(internship: Internship) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${internship.title}"?`
    );

    if (!confirmed) return;

    setBusyId(internship.id);
    setMessage("");
    setActionError("");

    try {
      await request(
        `/api/company/internships/${internship.id}`,
        "DELETE"
      );

      setInternships((previous) =>
        previous.filter(
          (item) => item.id !== internship.id
        )
      );

      if (editingId === internship.id) {
        setEditingId(null);
      }

      setMessage("Internship deleted successfully!");
    } catch (err) {
      showError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function handleApplicationDecision(
    application: Application,
    status: "accepted" | "rejected" | "completed"
  ) {
    const validTransition =
      (application.status === "pending" &&
        (status === "accepted" ||
          status === "rejected")) ||
      (application.status === "accepted" &&
        status === "completed");

    if (!validTransition) return;

    const action =
      status === "accepted"
        ? "accept"
        : status === "rejected"
        ? "reject"
        : "mark as completed";

    const confirmed = window.confirm(
      status === "completed"
        ? `Are you sure you want to mark ${application.student_name}'s training as completed?`
        : `Are you sure you want to ${action} ${application.student_name}'s application?`
    );

    if (!confirmed) return;

    setBusyApplicationId(application.id);
    setApplicationMessage("");
    setApplicationsError("");

    try {
      const data = await request(
        `/api/applications/${application.id}/status`,
        "PATCH",
        { status }
      );

      setApplications((previous) =>
        previous.map((item) =>
          item.id === application.id
            ? {
                ...item,
                status: data.application.status,
              }
            : item
        )
      );

      setApplicationMessage(data.message);
    } catch (err) {
      setApplicationsError(
        err instanceof Error
          ? err.message
          : "Failed to update application."
      );
    } finally {
      setBusyApplicationId(null);
    }
  }

  function formatDate(value: string | null) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not available";
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function statusColor(status: ApplicationStatus) {
    if (status === "accepted") return "#15803d";
    if (status === "completed") return "#15803d";
    if (status === "rejected") return "#dc2626";
    return "#a16207";
  }

  function renderStars(value: number) {
    const stars = Math.max(
      0,
      Math.min(5, Math.round(value))
    );

    return (
      "★".repeat(stars) +
      "☆".repeat(5 - stars)
    );
  }

  const totalReviews = reviews.length;

  const averageRating =
    totalReviews > 0
      ? reviews.reduce(
          (total, review) => total + review.rating,
          0
        ) / totalReviews
      : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map(
    (stars) => {
      const count = reviews.filter(
        (review) => review.rating === stars
      ).length;

      return {
        stars,
        count,
        percentage:
          totalReviews > 0
            ? (count / totalReviews) * 100
            : 0,
      };
    }
  );

  return (
    <div className="company-dashboard">
      <div className="dashboard-header">
        <h1>Company Dashboard</h1>
        <p>
          Manage your cooperative training opportunities.
        </p>

        {loading && <p>Loading dashboard...</p>}
        {error && <p role="alert">{error}</p>}

        {company && (
          <div className="company-profile-summary">
            <h2>{company.company_name}</h2>
            <p>
              Industry:{" "}
              {company.industry || "Not provided"}
            </p>
            <p>
              Location:{" "}
              {company.location || "Not provided"}
            </p>
            <p>
              {company.description ||
                "No description available."}
            </p>
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h2>My Internships</h2>
          <p>Manage training opportunities.</p>
          <strong>
            {internships.length} Opportunities
          </strong>
        </div>

        <div className="dashboard-card">
          <h2>Student Applications</h2>
          <p>Student applications management.</p>
          <strong>
            {applications.length} Applications
          </strong>
        </div>

        <div className="dashboard-card">
          <h2>Company Profile</h2>
          <p>Your company information.</p>
          <span>Available</span>
        </div>

        <div className="dashboard-card">
          <h2>Analytics</h2>
          <p>Training opportunities overview.</p>
          <span>Coming Soon</span>
        </div>
      </div>

      <section className="company-internships">
        <h2>Company Reviews & Ratings</h2>
        <p>
          View feedback from students who completed
          training at your company.
        </p>

        {reviewsLoading && (
          <p role="status">
            Loading company reviews...
          </p>
        )}

        {reviewsError && (
          <p role="alert">{reviewsError}</p>
        )}

        {!reviewsLoading && !reviewsError && (
          <>
            <div
              className="dashboard-grid"
              style={{ marginTop: "20px" }}
            >
              <div className="dashboard-card">
                <h3>Average Rating</h3>
                <div
                  style={{
                    fontSize: "42px",
                    fontWeight: 800,
                  }}
                >
                  {totalReviews > 0
                    ? averageRating.toFixed(1)
                    : "—"}
                </div>
                <p
                  style={{
                    color: "#eab308",
                    fontSize: "25px",
                  }}
                >
                  {totalReviews > 0
                    ? renderStars(averageRating)
                    : "☆☆☆☆☆"}
                </p>
                <p>Out of 5 stars</p>
              </div>

              <div className="dashboard-card">
                <h3>Total Reviews</h3>
                <div
                  style={{
                    fontSize: "42px",
                    fontWeight: 800,
                  }}
                >
                  {totalReviews}
                </div>
                <p>Student Reviews</p>
              </div>
            </div>

            <div
              className="dashboard-card"
              style={{ marginTop: "20px" }}
            >
              <h3>Rating Breakdown</h3>

              {ratingDistribution.map((item) => (
                <div
                  key={item.stars}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "65px minmax(0, 1fr) 45px",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "14px",
                  }}
                >
                  <strong>{item.stars} ★</strong>

                  <div
                    role="progressbar"
                    aria-label={`${item.stars} star reviews`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={item.percentage}
                    style={{
                      height: "12px",
                      backgroundColor: "#e5e7eb",
                      borderRadius: "999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${item.percentage}%`,
                        height: "100%",
                        backgroundColor: "#eab308",
                        borderRadius: "999px",
                      }}
                    />
                  </div>

                  <span>{item.count}</span>
                </div>
              ))}
            </div>

            <h3 style={{ marginTop: "25px" }}>
              Student Feedback
            </h3>

            {totalReviews === 0 && (
              <p>No student reviews yet.</p>
            )}

            {reviews.map((review) => (
              <div
                className="dashboard-card"
                key={review.id}
              >
                <h3>{review.student_name}</h3>

                <p
                  style={{
                    color: "#eab308",
                    fontSize: "22px",
                    letterSpacing: "2px",
                  }}
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  {renderStars(review.rating)}
                </p>

                <p>
                  <strong>Rating:</strong>{" "}
                  {review.rating} / 5
                </p>

                <p>
                  {review.comment ||
                    "No written comment."}
                </p>

                {review.created_at && (
                  <small>
                    {formatDate(review.created_at)}
                  </small>
                )}
              </div>
            ))}

            {company && (
              <Link
                to={`/companies/${company.id}`}
              >
                View Public Company Page →
              </Link>
            )}
          </>
        )}
      </section>

      <section className="company-internships">
        <h2>Student Applications</h2>
        <p>
          Review applications for your internship
          opportunities.
        </p>

        {applicationMessage && (
          <p role="status">
            {applicationMessage}
          </p>
        )}

        {applicationsLoading && (
          <p role="status">
            Loading applications...
          </p>
        )}

        {applicationsError && (
          <p role="alert">
            {applicationsError}
          </p>
        )}

        {!applicationsLoading &&
          !applicationsError &&
          applications.length === 0 && (
            <p>No student applications found.</p>
          )}

        {applications.map((application) => (
          <div
            className="dashboard-card"
            key={application.id}
          >
            <h3>{application.internship_title}</h3>

            <p>
              <strong>Student:</strong>{" "}
              {application.student_name}
            </p>

            <p>
              <strong>Company:</strong>{" "}
              {application.company_name}
            </p>

            <p>
              <strong>Applied On:</strong>{" "}
              {formatDate(application.applied_at)}
            </p>

            <p>
              <strong>Status:</strong>{" "}
              <span
                style={{
                  color: statusColor(
                    application.status
                  ),
                  fontWeight: 700,
                }}
              >
                {application.status.toUpperCase()}
              </span>
            </p>

            {application.status === "pending" && (
              <div className="dashboard-actions">
                <button
                  type="button"
                  disabled={
                    busyApplicationId !== null
                  }
                  onClick={() =>
                    handleApplicationDecision(
                      application,
                      "accepted"
                    )
                  }
                >
                  {busyApplicationId === application.id
                    ? "Processing..."
                    : "Accept"}
                </button>

                <button
                  type="button"
                  className="danger-btn"
                  disabled={
                    busyApplicationId !== null
                  }
                  onClick={() =>
                    handleApplicationDecision(
                      application,
                      "rejected"
                    )
                  }
                >
                  {busyApplicationId === application.id
                    ? "Processing..."
                    : "Reject"}
                </button>
              </div>
            )}

            {application.status === "accepted" && (
              <div className="dashboard-actions">
                <button
                  type="button"
                  disabled={
                    busyApplicationId !== null
                  }
                  onClick={() =>
                    handleApplicationDecision(
                      application,
                      "completed"
                    )
                  }
                >
                  {busyApplicationId === application.id
                    ? "Processing..."
                    : "Complete Training"}
                </button>
              </div>
            )}

            {application.status === "completed" && (
              <p role="status">
                Training completed successfully.
              </p>
            )}

            {application.status === "rejected" && (
              <p>
                This application has been rejected.
              </p>
            )}
          </div>
        ))}
      </section>

      <section className="company-internships">
        <h2>Create Internship</h2>

        <form
          onSubmit={handleCreate}
          className="dashboard-card"
        >
          <label htmlFor="create-title">
            Internship Title
          </label>

          <input
            id="create-title"
            type="text"
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            maxLength={200}
            required
            placeholder="Software Engineering Intern"
          />

          <label htmlFor="create-description">
            Description
          </label>

          <textarea
            id="create-description"
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            rows={4}
            placeholder="Describe the opportunity"
          />

          <label htmlFor="create-location">
            Location
          </label>

          <input
            id="create-location"
            type="text"
            value={location}
            onChange={(event) =>
              setLocation(event.target.value)
            }
            maxLength={200}
            placeholder="Saudi Arabia"
          />

          <button
            type="submit"
            disabled={
              creating ||
              loading ||
              !!error ||
              !company
            }
          >
            {creating
              ? "Creating..."
              : "Create Internship"}
          </button>
        </form>
      </section>

      <section className="company-internships">
        <h2>My Internship Opportunities</h2>

        {message && (
          <p role="status">{message}</p>
        )}

        {actionError && (
          <p role="alert">{actionError}</p>
        )}

        {!loading &&
          !error &&
          internships.length === 0 && (
            <p>No internships created yet.</p>
          )}

        {internships.map((internship) => (
          <div
            className="dashboard-card"
            key={internship.id}
          >
            {editingId === internship.id ? (
              <form
                onSubmit={(event) =>
                  handleSave(event, internship)
                }
              >
                <h3>Edit Internship</h3>

                <label
                  htmlFor={`edit-title-${internship.id}`}
                >
                  Title
                </label>

                <input
                  id={`edit-title-${internship.id}`}
                  type="text"
                  value={editTitle}
                  onChange={(event) =>
                    setEditTitle(event.target.value)
                  }
                  maxLength={200}
                  required
                />

                <label
                  htmlFor={`edit-description-${internship.id}`}
                >
                  Description
                </label>

                <textarea
                  id={`edit-description-${internship.id}`}
                  value={editDescription}
                  onChange={(event) =>
                    setEditDescription(event.target.value)
                  }
                  rows={4}
                />

                <label
                  htmlFor={`edit-location-${internship.id}`}
                >
                  Location
                </label>

                <input
                  id={`edit-location-${internship.id}`}
                  type="text"
                  value={editLocation}
                  onChange={(event) =>
                    setEditLocation(event.target.value)
                  }
                  maxLength={200}
                />

                <div className="dashboard-actions">
                  <button
                    type="submit"
                    disabled={busyId !== null}
                  >
                    {busyId === internship.id
                      ? "Saving..."
                      : "Save Changes"}
                  </button>

                  <button
                    type="button"
                    className="neutral-btn"
                    onClick={() =>
                      setEditingId(null)
                    }
                    disabled={busyId !== null}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h3>{internship.title}</h3>

                <p>
                  {internship.description ||
                    "No description"}
                </p>

                <p>
                  Location:{" "}
                  {internship.location ||
                    "Not specified"}
                </p>

                <p>
                  Status: {internship.status}
                </p>

                <div className="dashboard-actions">
                  <button
                    type="button"
                    onClick={() =>
                      startEditing(internship)
                    }
                    disabled={busyId !== null}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleToggleStatus(internship)
                    }
                    disabled={busyId !== null}
                  >
                    {internship.status === "open"
                      ? "Close"
                      : "Reopen"}
                  </button>

                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() =>
                      handleDelete(internship)
                    }
                    disabled={busyId !== null}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </section>

      <div className="dashboard-actions">
        <Link to="/">
          Back to Home
        </Link>
      </div>
    </div>
  );
}

export default CompanyDashboard;
