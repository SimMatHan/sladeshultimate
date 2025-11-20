import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signUp, signIn, currentUser, loading, error: authError } = useAuth();
  const [mode, setMode] = useState(() =>
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already signed in
  useEffect(() => {
    if (currentUser && !loading) {
      navigate("/home", { replace: true });
    }
  }, [currentUser, loading, navigate]);

  useEffect(() => {
    const paramMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
    setMode((current) => (current === paramMode ? current : paramMode));
  }, [searchParams]);

  // Update error when authError changes
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const handleModeChange = (nextMode) => {
    if (mode === nextMode) return;
    setMode(nextMode);
    setError("");
    setEmail("");
    setPassword("");
    setFullName("");
    const updated = new URLSearchParams(searchParams);
    updated.set("mode", nextMode);
    setSearchParams(updated, { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        if (!fullName.trim()) {
          setError("Full name is required");
          setIsSubmitting(false);
          return;
        }
        await signUp(email, password, fullName.trim());
        // User will be automatically created in Firestore via useAuth hook
        // Navigate after successful signup
        navigate("/onboarding", { replace: true });
      } else {
        await signIn(email, password);
        // Navigate after successful signin
        navigate("/home", { replace: true });
      }
    } catch (error) {
      // Error is handled by useAuth hook and set via authError
      console.error("Authentication error:", error);
      setError(error.message || "An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      className="min-h-screen bg-bg text-ink flex items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        ease: [0.2, 0, 0.2, 1], // ease-in cubic bezier
      }}
    >
      <div className="w-full max-w-full mx-auto px-6">
        {/* Header */}
        <h1 className="text-[28px] font-extrabold tracking-tight mb-2">Sladesh</h1>
        <p className="text-muted mb-6">{mode === "signin" ? "Welcome back 👋" : "Create your account to get started"}</p>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            type="button"
            onClick={() => handleModeChange("signin")}
            className={`py-2.5 rounded-md border font-semibold transition active:scale-95 ${
              mode === "signin"
                ? "text-brand border-brand bg-brand/10"
                : "text-muted border-line bg-subtle hover:bg-surface"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("signup")}
            className={`py-2.5 rounded-md border font-semibold transition active:scale-95 ${
              mode === "signup"
                ? "text-brand border-brand bg-brand/10"
                : "text-muted border-line bg-subtle hover:bg-surface"
            }`}
          >
            Sign up
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-md border border-line bg-surface text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isSubmitting}
            className="w-full px-4 py-3 rounded-md border border-line bg-surface text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isSubmitting}
            minLength={6}
            className="w-full px-4 py-3 rounded-md border border-line bg-surface text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
          />

          <button
            type="submit"
            disabled={isSubmitting || loading}
            className="w-full py-3 rounded-md bg-brand text-white font-semibold shadow-soft active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting || loading
              ? "Please wait..."
              : mode === "signin"
              ? "Continue"
              : "Create account"}
          </button>
        </form>

        {/* Footer links */}
        {mode === "signin" ? (
          <div className="mt-6 text-center text-sm">
            <p className="text-muted">
              Forgot password?
              {/* Opdatér evt. sti */}
              {" "}
              <Link to="/reset" className="text-brand font-medium">Reset</Link>
            </p>
            <p className="text-muted mt-2">
              Need an account? Use the Sign up tab above.
            </p>
          </div>
        ) : (
          <div className="mt-6 text-center text-sm">
            <p className="text-muted">
              Already have an account? Use the Sign in tab above.
            </p>
          </div>
        )}

        {/* Back to splash (hvis du vil linke dertil) */}
        <div className="mt-8 text-center">
          <Link to="/" className="text-muted text-sm hover:text-ink transition">Back to splash</Link>
        </div>
      </div>
    </motion.div>
  );
}
