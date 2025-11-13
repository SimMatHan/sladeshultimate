import { Link } from "react-router-dom";

export default function Splash() {
  return (
    <div className="min-h-screen bg-bg text-ink flex items-center">
      <div className="w-full max-w-full mx-auto px-6 flex flex-col items-center text-center">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Sladesh</h1>
        <p className="text-muted mb-10">Your drinking buddy nr. 1</p>

        <div className="w-full space-y-3">
          <Link to="/signup" className="block">
            <button className="w-full py-3 rounded-md bg-brand text-white font-semibold shadow-soft active:scale-95">
              Sign up
            </button>
          </Link>

          <Link to="/signin" className="block">
            <button className="w-full py-3 rounded-md border border-line text-ink font-semibold bg-surface active:scale-95">
              Sign in
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
