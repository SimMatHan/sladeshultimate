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
  const [username, setUsername] = useState("");
  const [enablePromille, setEnablePromille] = useState(false);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [gender, setGender] = useState("");
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
    setUsername("");
    setEnablePromille(false);
    setHeightCm("");
    setWeightKg("");
    setGender("");
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
        const trimmedFullName = fullName.trim();
        const normalizedUsername = username.trim().toLowerCase();
        const usernamePattern = /^[a-z0-9._-]{3,20}$/;
        const heightValue = Number(heightCm);
        const weightValue = Number(weightKg);

        if (!trimmedFullName) {
          setError("Fulde navn er påkrævet");
          setIsSubmitting(false);
          return;
        }
        if (!normalizedUsername) {
          setError("Brugernavn er påkrævet");
          setIsSubmitting(false);
          return;
        }
        if (!usernamePattern.test(normalizedUsername)) {
          setError("Brugernavn må kun indeholde a-z, 0-9, . _ - og være 3-20 tegn.");
          setIsSubmitting(false);
          return;
        }

        if (enablePromille) {
          if (!heightCm || Number.isNaN(heightValue) || heightValue <= 0) {
            setError("Angiv din højde i centimeter for promille counteren.");
            setIsSubmitting(false);
            return;
          }
          if (!weightKg || Number.isNaN(weightValue) || weightValue <= 0) {
            setError("Angiv din vægt i kilo for promille counteren.");
            setIsSubmitting(false);
            return;
          }
          if (!gender) {
            setError("Vælg køn for promille counteren.");
            setIsSubmitting(false);
            return;
          }
        }

        const promilleSettings = enablePromille
          ? {
              enabled: true,
              heightCm: heightValue,
              weightKg: weightValue,
              gender,
            }
          : { enabled: false };

        await signUp(email, password, trimmedFullName, normalizedUsername, null, promilleSettings);
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
      setError(error.message || "Der opstod en fejl. Prøv igen.");
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
        <p className="text-muted mb-6">{mode === "signin" ? "Velkommen tilbage 👋" : "Opret din konto for at komme i gang"}</p>

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
            Log ind
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
            Opret konto
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
              placeholder="Fulde navn"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-md border border-line bg-surface text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
            />
          )}

          {mode === "signup" && (
            <input
              type="text"
              placeholder="@brugernavn"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-md border border-line bg-surface text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed font-mono"
            />
          )}

          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isSubmitting}
            className="w-full px-4 py-3 rounded-md border border-line bg-surface text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
          />

          <input
            type="password"
            placeholder="Adgangskode"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isSubmitting}
            minLength={6}
            className="w-full px-4 py-3 rounded-md border border-line bg-surface text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {mode === "signup" && (
            <div className="rounded-md border border-line bg-subtle px-4 py-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-ink">Vil du prøve promille counter?</p>
                  <p className="text-xs text-muted">Valgfrit. Gemmer højde, vægt og køn, hvis du vil teste den.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnablePromille((prev) => !prev)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                    enablePromille ? "bg-brand" : "bg-line"
                  }`}
                  aria-pressed={enablePromille}
                  aria-label="Aktivér promille counter"
                  disabled={isSubmitting}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                      enablePromille ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {enablePromille && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Højde (cm)"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    min="0"
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 rounded-md border border-line bg-surface text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Vægt (kg)"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    min="0"
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 rounded-md border border-line bg-surface text-ink placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 rounded-md border border-line bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed sm:col-span-2"
                  >
                    <option value="">Køn</option>
                    <option value="male">Mand</option>
                    <option value="female">Kvinde</option>
                    <option value="other">Andet</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || loading}
            className="w-full py-3 rounded-md bg-brand text-white font-semibold shadow-soft active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting || loading
              ? "Vent venligst..."
              : mode === "signin"
              ? "Fortsæt"
              : "Opret konto"}
          </button>
        </form>

        {/* Footer links */}
        {mode === "signin" ? (
          <div className="mt-6 text-center text-sm">
            <p className="text-muted">
              Glemt adgangskode?
              {" "}
              <Link to="/reset" className="text-brand font-medium">Nulstil</Link>
            </p>
            <p className="text-muted mt-2">
              Mangler du en konto? Brug fanen "Opret konto" ovenfor.
            </p>
          </div>
        ) : (
          <div className="mt-6 text-center text-sm">
            <p className="text-muted">
              Har du allerede en konto? Brug fanen "Log ind" ovenfor.
            </p>
          </div>
        )}

        {/* Back to splash (hvis du vil linke dertil) */}
        <div className="mt-8 text-center">
          <Link to="/" className="text-muted text-sm hover:text-ink transition">Tilbage til splash</Link>
        </div>
      </div>
    </motion.div>
  );
}
