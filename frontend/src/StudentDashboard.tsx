
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

const API = "http://localhost:5000";

type ApplicationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "completed";

interface Application {
  id: number;
  student_id: number;
  internship_id: number;
  status: ApplicationStatus;
  applied_at: string;
  internship_title: string;
  internship_location: string | null;
  internship_status: string;
  company_id: number;
  company_name: string;
}

interface ApplicationsResponse {
  success: boolean;
  count?: number;
  applications?: Application[];
  message?: string;
}

interface StudentReview {
  id: number;
  student_id: number;
  company_id: number;
  company_name: string;
  rating: number;
  comment: string | null;
  created_at: string | null;
}

interface ReviewsResponse {
  success: boolean;
  count?: number;
  reviews?: StudentReview[];
  message?: string;
}

interface ReviewActionResponse {
  success: boolean;
  message?: string;
  review?: StudentReview;
}

function StudentDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [reviews, setReviews] = useState<StudentReview[]>([]);

  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState("");

  const [busyReviewId, setBusyReviewId] = useState<number | null>(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewActionError, setReviewActionError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchApplications() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${API}/api/applications/my`,
          {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
          }
        );

        const data: ApplicationsResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Failed to load your applications."
          );
        }

        if (!Array.isArray(data.applications)) {
          throw new Error("Invalid applications data.");
        }

        if (!controller.signal.aborted) {
          setApplications(data.applications);
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
    }

    async function fetchReviews() {
      try {
        setReviewsLoading(true);
        setReviewsError(null);

        const response = await fetch(
          `${API}/api/reviews/my`,
          {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
          }
        );

        const data: ReviewsResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Failed to load your reviews."
          );
        }

        if (!Array.isArray(data.reviews)) {
          throw new Error("Invalid reviews data.");
        }

        if (!controller.signal.aborted) {
          setReviews(data.reviews);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setReviewsError(
          err instanceof Error
            ? err.message
            : "Something went wrong."
        );
      } finally {
        if (!controller.signal.aborted) {
          setReviewsLoading(false);
        }
      }
    }

    fetchApplications();
    fetchReviews();

    return () => controller.abort();
  }, []);

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

  async function reviewRequest(
    reviewId: number,
    method: "PUT" | "DELETE",
    body?: { rating: number; comment: string }
  ): Promise<ReviewActionResponse> {
    const csrfToken = await getCsrfToken();

    const response = await fetch(
      `${API}/api/reviews/${reviewId}`,
      {
        method,
        credentials: "include",
        headers: {
          "x-csrf-token": csrfToken,
          ...(body
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }
    );

    const data: ReviewActionResponse = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Review request failed.");
    }

    return data;
  }

  function startEditingReview(review: StudentReview) {
    setEditingReviewId(review.id);
    setEditRating(review.rating);
    setEditComment(review.comment || "");
    setReviewMessage("");
    setReviewActionError("");
  }

  function cancelEditingReview() {
    setEditingReviewId(null);
    setEditRating(5);
    setEditComment("");
  }

  async function handleUpdateReview(
    event: FormEvent<HTMLFormElement>,
    review: StudentReview
  ) {
    event.preventDefault();

    if (busyReviewId !== null) return;

    if (
      !Number.isInteger(editRating) ||
      editRating < 1 ||
      editRating > 5
    ) {
      setReviewActionError("Please select a rating from 1 to 5.");
      return;
    }

    if (editComment.length > 2000) {
      setReviewActionError(
        "Comment must be 2000 characters or less."
      );
      return;
    }

    setBusyReviewId(review.id);
    setReviewMessage("");
    setReviewActionError("");

    try {
      const data = await reviewRequest(review.id, "PUT", {
        rating: editRating,
        comment: editComment.trim(),
      });

      if (!data.review) {
        throw new Error("Invalid updated review response.");
      }

      setReviews((previous) =>
        previous.map((item) =>
          item.id === review.id
            ? {
                ...item,
                ...data.review,
                company_name: item.company_name,
              }
            : item
        )
      );

      cancelEditingReview();
      setReviewMessage(
        data.message || "Review updated successfully."
      );
    } catch (err) {
      setReviewActionError(
        err instanceof Error
          ? err.message
          : "Failed to update review."
      );
    } finally {
      setBusyReviewId(null);
    }
  }

  async function handleDeleteReview(review: StudentReview) {
    if (busyReviewId !== null) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete your review for "${review.company_name}"?`
    );

    if (!confirmed) return;

    setBusyReviewId(review.id);
    setReviewMessage("");
    setReviewActionError("");

    try {
      const data = await reviewRequest(review.id, "DELETE");

      setReviews((previous) =>
        previous.filter((item) => item.id !== review.id)
      );

      if (editingReviewId === review.id) {
        cancelEditingReview();
      }

      setReviewMessage(
        data.message || "Review deleted successfully."
      );
    } catch (err) {
      setReviewActionError(
        err instanceof Error
          ? err.message
          : "Failed to delete review."
      );
    } finally {
      setBusyReviewId(null);
    }
  }

  function getStatusLabel(status: ApplicationStatus) {
    switch (status) {
      case "accepted":
        return "Accepted";
      case "rejected":
        return "Rejected";
      case "completed":
        return "Completed";
      default:
        return "Pending";
    }
  }

  function getStatusColor(status: ApplicationStatus) {
    switch (status) {
      case "accepted":
        return "#15803d";
      case "rejected":
        return "#dc2626";
      case "completed":
        return "#047857";
      default:
        return "#a16207";
    }
  }

  function getStatusDescription(status: ApplicationStatus) {
    switch (status) {
      case "pending":
        return "Your application is awaiting a decision from the company.";
      case "accepted":
        return "Congratulations! Your application has been accepted.";
      case "rejected":
        return "Your application was not accepted.";
      case "completed":
        return "You have successfully completed your training!";
    }
  }

  function formatDate(date: string | null) {
    if (!date) return "Not available";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Not available";
    }

    return parsedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function renderStars(rating: number) {
    const safeRating = Math.max(
      0,
      Math.min(5, Math.round(rating))
    );

    return (
      "★".repeat(safeRating) +
      "☆".repeat(5 - safeRating)
    );
  }

  const pendingCount = applications.filter(
    (application) => application.status === "pending"
  ).length;

  const acceptedCount = applications.filter(
    (application) => application.status === "accepted"
  ).length;

  const rejectedCount = applications.filter(
    (application) => application.status === "rejected"
  ).length;

  const completedCount = applications.filter(
    (application) => application.status === "completed"
  ).length;

  return (
    <div className="student-dashboard">
      <div className="dashboard-header">
        <h1>Student Dashboard</h1>
        <p>Welcome to your CoTrain student portal.</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h2>My Applications</h2>
          <p>Track your cooperative training applications.</p>
          <strong>{applications.length} Applications</strong>
        </div>

        <div className="dashboard-card">
          <h2>Pending</h2>
          <p>Applications awaiting company decisions.</p>
          <strong>{pendingCount}</strong>
        </div>

        <div className="dashboard-card">
          <h2>Accepted</h2>
          <p>Applications accepted by companies.</p>
          <strong>{acceptedCount}</strong>
        </div>

        <div className="dashboard-card">
          <h2>Completed Training</h2>
          <p>Successfully completed internships.</p>
          <strong>{completedCount}</strong>
        </div>
      </div>

      <section
        className="dashboard-card"
        style={{ marginTop: "24px" }}
      >
        <h2>My Training Applications</h2>

        {loading && (
          <p role="status">Loading your applications...</p>
        )}

        {error && (
          <p role="alert" style={{ color: "#dc2626" }}>
            {error}
          </p>
        )}

        {!loading && !error && applications.length === 0 && (
          <div>
            <p>You haven't applied for any internships yet.</p>
            <Link to="/#opportunities">
              Browse Opportunities →
            </Link>
          </div>
        )}

        {!loading && !error && applications.length > 0 && (
          <>
            <p>
              Total Applications:{" "}
              <strong>{applications.length}</strong>
            </p>

            <p>
              Rejected Applications:{" "}
              <strong>{rejectedCount}</strong>
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                marginTop: "16px",
              }}
            >
              {applications.map((application) => (
                <div
                  key={application.id}
                  className="dashboard-card"
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    padding: "20px",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>
                    {application.internship_title}
                  </h3>

                  <p>
                    <strong>Company:</strong>{" "}
                    {application.company_name}
                  </p>

                  <p>
                    <strong>Location:</strong>{" "}
                    {application.internship_location ||
                      "Not specified"}
                  </p>

                  <p>
                    <strong>Applied On:</strong>{" "}
                    {formatDate(application.applied_at)}
                  </p>

                  <p>
                    <strong>Application Status:</strong>{" "}
                    <span
                      style={{
                        color: getStatusColor(application.status),
                        fontWeight: 700,
                      }}
                    >
                      {getStatusLabel(application.status)}
                    </span>
                  </p>

                  <p>
                    {getStatusDescription(application.status)}
                  </p>

                  <div
                    className="dashboard-actions"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "12px",
                      marginTop: "16px",
                    }}
                  >
                    <Link
                      to={`/internships/${application.internship_id}`}
                    >
                      View Internship →
                    </Link>

                    {application.status === "completed" && (
                      <Link
                        to={`/companies/${application.company_id}`}
                      >
                        ⭐ Review Company →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <div
        className="dashboard-grid"
        style={{ marginTop: "24px" }}
      >
        <div className="dashboard-card">
          <h2>Saved Opportunities</h2>
          <p>View training opportunities you have saved.</p>
          <span>Coming Soon</span>
        </div>

        <div className="dashboard-card">
          <h2>My Profile</h2>
          <p>Manage your student information.</p>
          <span>Coming Soon</span>
        </div>

        <div className="dashboard-card">
          <h2>My Reviews</h2>
          <p>Reviews you have submitted to companies.</p>

          {reviewMessage && (
            <p role="status" style={{ color: "#15803d" }}>
              {reviewMessage}
            </p>
          )}

          {reviewActionError && (
            <p role="alert" style={{ color: "#dc2626" }}>
              {reviewActionError}
            </p>
          )}

          {reviewsLoading && (
            <p role="status">Loading your reviews...</p>
          )}

          {reviewsError && (
            <p role="alert" style={{ color: "#dc2626" }}>
              {reviewsError}
            </p>
          )}

          {!reviewsLoading &&
            !reviewsError &&
            reviews.length === 0 && (
              <p>
                You haven't submitted any reviews yet.
              </p>
            )}

          {!reviewsLoading &&
            !reviewsError &&
            reviews.length > 0 && (
              <>
                <p>
                  Total Reviews:{" "}
                  <strong>{reviews.length}</strong>
                </p>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    marginTop: "16px",
                  }}
                >
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      style={{
                        padding: "16px",
                        border: "1px solid #e5e7eb",
                        borderRadius: "12px",
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>
                        {review.company_name}
                      </h3>

                      {editingReviewId === review.id ? (
                        <form
                          onSubmit={(event) =>
                            handleUpdateReview(event, review)
                          }
                        >
                          <label
                            htmlFor={`edit-rating-${review.id}`}
                          >
                            Rating
                          </label>

                          <select
                            id={`edit-rating-${review.id}`}
                            value={editRating}
                            onChange={(event) =>
                              setEditRating(
                                Number(event.target.value)
                              )
                            }
                            disabled={busyReviewId !== null}
                            required
                          >
                            <option value={5}>5 Stars</option>
                            <option value={4}>4 Stars</option>
                            <option value={3}>3 Stars</option>
                            <option value={2}>2 Stars</option>
                            <option value={1}>1 Star</option>
                          </select>

                          <p
                            style={{
                              color: "#eab308",
                              fontSize: "22px",
                            }}
                          >
                            {renderStars(editRating)}
                          </p>

                          <label
                            htmlFor={`edit-comment-${review.id}`}
                          >
                            Your Comment
                          </label>

                          <textarea
                            id={`edit-comment-${review.id}`}
                            value={editComment}
                            onChange={(event) =>
                              setEditComment(event.target.value)
                            }
                            rows={4}
                            maxLength={2000}
                            disabled={busyReviewId !== null}
                            placeholder="Share your training experience"
                          />

                          <p>
                            {editComment.length} / 2000 characters
                          </p>

                          <div
                            className="dashboard-actions"
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "12px",
                              marginTop: "16px",
                            }}
                          >
                            <button
                              type="submit"
                              disabled={busyReviewId !== null}
                            >
                              {busyReviewId === review.id
                                ? "Saving..."
                                : "Save Changes"}
                            </button>

                            <button
                              type="button"
                              onClick={cancelEditingReview}
                              disabled={busyReviewId !== null}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
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
                            <strong>My Comment:</strong>
                          </p>

                          <p>
                            {review.comment ||
                              "No written comment."}
                          </p>

                          <p>
                            <strong>Reviewed On:</strong>{" "}
                            {formatDate(review.created_at)}
                          </p>

                          <div
                            className="dashboard-actions"
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "12px",
                              marginTop: "16px",
                            }}
                          >
                            <Link
                              to={`/companies/${review.company_id}`}
                            >
                              View Company →
                            </Link>

                            <button
                              type="button"
                              onClick={() =>
                                startEditingReview(review)
                              }
                              disabled={
                                busyReviewId !== null ||
                                editingReviewId !== null
                              }
                            >
                              Edit Review
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteReview(review)
                              }
                              disabled={busyReviewId !== null}
                            >
                              {busyReviewId === review.id
                                ? "Deleting..."
                                : "Delete Review"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
        </div>
      </div>

      <div className="dashboard-actions">
        <Link to="/">Back to Home</Link>
      </div>
    </div>
  );
}

export default StudentDashboard;
