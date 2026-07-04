import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { setJwt } from "~/lib/auth";

/**
 * OAuth2 redirect callback.
 *
 * The backend (Spring Boot on Railway) redirects here after a successful
 * Google login, passing the JWT as a query parameter:
 *
 *   /oauth2/redirect?token=eyJhbGciOi...
 *
 * This component reads the token, stores it in localStorage, and navigates
 * to the dashboard.
 */
export default function OAuth2Redirect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (token) {
      setJwt(token);
      navigate("/", { replace: true });
    } else if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
    } else {
      navigate("/login?error=no_token", { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <p className="text-gray-500">Completando autenticación...</p>
    </div>
  );
}
