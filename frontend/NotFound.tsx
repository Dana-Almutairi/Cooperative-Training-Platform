
import { Link } from "react-router-dom";

function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
      }}
    >
      <h1>404 — Page Not Found</h1>

      <p>
        Sorry, the page you are looking for
        does not exist.
      </p>

      <Link to="/">
        Back to Home
      </Link>
    </main>
  );
}

export default NotFound;
