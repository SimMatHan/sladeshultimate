import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState(() =>
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );

  useEffect(() => {
    const paramMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
    setMode((current) => (current === paramMode ? current : paramMode));
  }, [searchParams]);

  const handleModeChange = (nextMode) => {
    if (mode === nextMode) return;
    setMode(nextMode);
    const updated = new URLSearchParams(searchParams);
    updated.set("mode", nextMode);
    setSearchParams(updated, { replace: true });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    try {
      localStorage.setItem("signedIn", "1");
      localStorage.setItem("onboarded", "1");
    } catch (error) {
      console.warn("Unable to persist auth state during dev flow", error);
    }
    navigate("/home", { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg text-ink flex items-center">
      <div className="w-full max-w-[430px] mx-auto px-6">
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

        {/* Form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Full name"
              className="w-full px-4 py-3 rounded-md border border-line bg-surface text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          )}

          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-3 rounded-md border border-line bg-surface text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand"
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 rounded-md border border-line bg-surface text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand"
          />

          <button
            type="submit"
            className="w-full py-3 rounded-md bg-brand text-white font-semibold shadow-soft active:scale-95"
          >
            {mode === "signin" ? "Continue" : "Create account"}
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
              Don’t have an account?{" "}
              <button
                type="button"
                onClick={() => handleModeChange("signup")}
                className="text-brand font-medium"
              >
                Sign up
              </button>
            </p>
          </div>
        ) : (
          <div className="mt-6 text-center text-sm">
            <p className="text-muted">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => handleModeChange("signin")}
                className="text-brand font-medium"
              >
                Sign in
              </button>
            </p>
          </div>
        )}

        {/* Optional: social buttons (placeholder UI) */}
        <div className="mt-8 space-y-3">
          <button
            type="button"
            className="w-full py-3 rounded-md border border-line bg-surface text-ink font-semibold active:scale-95"
          >
            Continue with Apple
          </button>
          <button
            type="button"
            className="w-full py-3 rounded-md border border-line bg-surface text-ink font-semibold active:scale-95"
          >
            Continue with Google
          </button>
        </div>

        {/* Back to splash (hvis du vil linke dertil) */}
        <div className="mt-8 text-center">
          <Link to="/" className="text-muted text-sm hover:text-ink transition">Back to splash</Link>
        </div>
      </div>
    </div>
  );
}
