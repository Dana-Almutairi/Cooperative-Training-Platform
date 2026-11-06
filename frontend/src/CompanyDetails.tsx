
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";


const API = (
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

interface Review {
  id: number;
  student_id: number;
  company_id: number;
  rating: number;
  comment: string | null;
  created_at: string | null;
  student_name: string;
}

interface CurrentUser {
  id: number;
  role: string;
}

function CompanyDetails() {
  const { id } = useParams<{ id: string }>();

  const [company, setCompany] = useState<Company | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPage() {
      setLoading(true);
      setError(null);
      setCompany(null);
      setReviews([]);
      setReviewMessage("");
      setReviewError("");

      try {
        const [companyResponse, reviewsResponse] =
          await Promise.all([
            fetch(`${API}/api/companies/${id}`, {
              signal: controller.signal,
            }),
            fetch(`${API}/api/companies/${id}/reviews`, {
              signal: controller.signal,
            }),
          ]);

        if (!companyResponse.ok) {
          throw new Error(
            companyResponse.status === 404
              ? "Company not found."
              : "Failed to load company details."
          );
        }

        if (!reviewsResponse.ok) {
          throw new Error("Failed to load company reviews.");
        }

        const companyData = await companyResponse.json();
        const reviewsData = await reviewsResponse.json();

        const currentCompany =
          companyData.company ?? companyData;

        if (
          !currentCompany ||
          !currentCompany.company_name
        ) {
          throw new Error("Invalid company data.");
        }

        if (!Array.isArray(reviewsData.reviews)) {
          throw new Error("Invalid reviews data.");
        }

        if (!controller.signal.aborted) {
          setCompany(currentCompany);
          setReviews(reviewsData.reviews);
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

    async function checkUser() {
      setCurrentUser(null);

      try {
        const response = await fetch(`${API}/api/auth/me`, {
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) return;

        const data = await response.json();
        const user = data.user ?? data;

        if (!controller.signal.aborted) {
          if (
            Number.isSafeInteger(Number(user?.id)) &&
            user?.role
          ) {
            setCurrentUser({
              id: Number(user.id),
              role: user.role,
            });
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setCurrentUser(null);
        }
      }
    }

    loadPage();
    checkUser();

    return () => controller.abort();
  }, [id]);

  async function getCsrfToken(): Promise<string> {
    const response = await fetch(`${API}/api/csrf-token`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(
        "Could not initialize security token."
      );
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

  async function handleSubmitReview(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!company || submitting) return;

    setSubmitting(true);
    setReviewMessage("");
    setReviewError("");

    try {
      const csrfToken = await getCsrfToken();

      const response = await fetch(
        `${API}/api/companies/${company.id}/reviews`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({
            rating,
            comment: comment.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to submit review."
        );
      }

      setReviewMessage("Review submitted successfully!");
      setRating(5);
      setComment("");

      const reviewsResponse = await fetch(
        `${API}/api/companies/${company.id}/reviews`
      );

      if (!reviewsResponse.ok) {
        throw new Error(
          "Review submitted, but could not refresh reviews."
        );
      }

      const reviewsData = await reviewsResponse.json();

      if (!Array.isArray(reviewsData.reviews)) {
        throw new Error("Invalid reviews data.");
      }

      setReviews(reviewsData.reviews);
    } catch (err) {
      setReviewError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
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

      const percentage =
        totalReviews > 0
          ? (count / totalReviews) * 100
          : 0;

      return {
        stars,
        count,
        percentage,
      };
    }
  );

  const hasReviewed =
    currentUser !== null &&
    reviews.some(
      (review) => review.student_id === currentUser.id
    );

  const starDisplay = (value: number) => {
    const rounded = Math.round(value);

    return (
      "★".repeat(Math.max(0, Math.min(5, rounded))) +
      "☆".repeat(Math.max(0, 5 - rounded))
    );
  };

  function formatDate(value: string | null) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <main className="company-details-page">
      <div className="company-details-container">
        <Link to="/" className="back-link">
          ← Back to Home
        </Link>

        {loading && <p>Loading company details...</p>}

        {error && <p role="alert">{error}</p>}

        {!loading && !error && company && (
          <>
            <article className="company-profile">
              <span className="section-label">
                COMPANY PROFILE
              </span>

              <div className="company-profile-avatar">
                {company.company_name.charAt(0)}
              </div>

              <h1>{company.company_name}</h1>

              <span className="company-industry">
                {company.industry ||
                  "Industry not specified"}
              </span>

              <div className="company-profile-info">
                <h2>About the Company</h2>

                <p>
                  {company.description ||
                    "No description available."}
                </p>

                <h2>Location</h2>

                <p>
                  {company.location || "Not specified"}
                </p>

                {company.website && (
                  <>
                    <h2>Website</h2>

                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Visit Company Website
                    </a>
                  </>
                )}
              </div>

              <p className="demo-notice">
                Demo company — for demonstration
                purposes only.
              </p>
            </article>

            <section className="company-profile">
              <span className="section-label">
                STUDENT FEEDBACK
              </span>

              <h2>Reviews & Ratings</h2>

              <p>
                Explore students' training experiences
                and feedback.
              </p>

              <div
                className="dashboard-card"
                style={{
                  display: "grid",
                  gap: "24px",
                  marginTop: "20px",
                }}
              >
                <div
                  style={{
                    textAlign: "center",
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "48px",
                      fontWeight: 800,
                      lineHeight: 1.2,
                    }}
                  >
                    {totalReviews > 0
                      ? averageRating.toFixed(1)
                      : "—"}
                  </div>

                  <div
                    style={{
                      color: "#eab308",
                      fontSize: "28px",
                      letterSpacing: "3px",
                      margin: "10px 0",
                    }}
                    aria-label={
                      totalReviews > 0
                        ? `Average rating ${averageRating.toFixed(1)} out of 5`
                        : "No ratings yet"
                    }
                  >
                    {totalReviews > 0
                      ? starDisplay(averageRating)
                      : "☆☆☆☆☆"}
                  </div>

                  <p>
                    <strong>{totalReviews}</strong>{" "}
                    {totalReviews === 1
                      ? "Student Review"
                      : "Student Reviews"}
                  </p>

                  <p>Overall Rating</p>
                </div>

                <div>
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
                      <span
                        style={{
                          whiteSpace: "nowrap",
                          fontWeight: 600,
                        }}
                      >
                        {item.stars} ★
                      </span>

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
                            height: "100%",
                            width: `${item.percentage}%`,
                            backgroundColor: "#eab308",
                            borderRadius: "999px",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>

                      <span
                        style={{
                          textAlign: "right",
                          fontWeight: 600,
                        }}
                      >
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <h2 style={{ marginTop: "30px" }}>
                Student Reviews
              </h2>

              {totalReviews === 0 && (
                <p>
                  No reviews yet. Be the first to share
                  your experience after completing
                  your training.
                </p>
              )}

              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="dashboard-card"
                  style={{
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <h3>{review.student_name}</h3>

                    {review.created_at && (
                      <small>
                        {formatDate(review.created_at)}
                      </small>
                    )}
                  </div>

                  <p
                    style={{
                      color: "#eab308",
                      fontSize: "22px",
                      letterSpacing: "2px",
                    }}
                    aria-label={`${review.rating} out of 5 stars`}
                  >
                    {starDisplay(review.rating)}
                  </p>

                  <p>
                    {review.comment ||
                      "No written comment."}
                  </p>
                </div>
              ))}

              <h2 style={{ marginTop: "30px" }}>
                Write a Review
              </h2>

              {reviewMessage && (
                <p role="status">{reviewMessage}</p>
              )}

              {reviewError && (
                <p role="alert">{reviewError}</p>
              )}

              {currentUser?.role === "student" ? (
                hasReviewed ? (
                  <div className="dashboard-card">
                    <p>
                      ✓ You have already reviewed this
                      company.
                    </p>
                    <p>
                      Thank you for sharing your
                      training experience!
                    </p>
                  </div>
                ) : (
                  <>
                    <p>
                      Only students who have completed
                      training at this company can
                      submit a review.
                    </p>

                    <form
                      onSubmit={handleSubmitReview}
                      className="dashboard-card"
                    >
                      <label htmlFor="review-rating">
                        Rating
                      </label>

                      <select
                        id="review-rating"
                        value={rating}
                        onChange={(event) =>
                          setRating(
                            Number(event.target.value)
                          )
                        }
                      >
                        <option value={5}>
                          5 — Excellent
                        </option>

                        <option value={4}>
                          4 — Very Good
                        </option>

                        <option value={3}>
                          3 — Good
                        </option>

                        <option value={2}>
                          2 — Fair
                        </option>

                        <option value={1}>
                          1 — Poor
                        </option>
                      </select>

                      <label htmlFor="review-comment">
                        Your Review
                      </label>

                      <textarea
                        id="review-comment"
                        value={comment}
                        onChange={(event) =>
                          setComment(event.target.value)
                        }
                        maxLength={2000}
                        rows={4}
                        placeholder="Share your training experience..."
                      />

                      <button
                        type="submit"
                        disabled={submitting}
                      >
                        {submitting
                          ? "Submitting..."
                          : "Submit Review"}
                      </button>
                    </form>
                  </>
                )
              ) : (
                <p>
                  Only logged-in students can submit
                  reviews.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default CompanyDetails;
