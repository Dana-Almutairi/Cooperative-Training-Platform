
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");
function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }

    if (new TextEncoder().encode(password).length > 72) {
      setError("Password must not exceed 72 bytes.");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Get CSRF token
      const csrfResponse = await fetch(
        `${API_URL}/api/csrf-token`,
        {
          credentials: "include",
        }
      );

      if (!csrfResponse.ok) {
        throw new Error("Could not initialize security token.");
      }

      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.csrfToken;

      if (typeof csrfToken !== "string" || !csrfToken) {
        throw new Error("Invalid security token.");
      }

      // Step 2: Register with CSRF token
      const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          credentials: "include",
          body: JSON.stringify({
            full_name: fullName,
            email,
            password,
            role,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Registration failed."
        );
      }

      setSuccess(
        "Account created successfully! You can now log in."
      );

      setFullName("");
      setEmail("");
      setPassword("");
      setRole("student");

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create an Account</h1>
        <p>Join CoTrain and start your journey.</p>

        {error && (
          <p role="alert" className="auth-error">
            {error}
          </p>
        )}

        {success && (
          <p role="status" className="auth-success">
            {success}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label htmlFor="fullName">Full Name</label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
            autoComplete="name"
            required
          />

          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 12 characters"
            minLength={12}
            autoComplete="new-password"
            required
          />

          <label htmlFor="role">Account Type</label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="student">Student</option>
            <option value="company">Company</option>
          </select>

          <button type="submit" disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{" "}
          <Link to="/login">Log In</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
