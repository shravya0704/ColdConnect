import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const initialMode = (new URLSearchParams(location.search).get("mode") === "signup") ? "signup" : "signin";
  const [authMode, setAuthMode] = useState<"signin" | "signup">(initialMode);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) navigate("/generate");
    };
    check();
  }, [navigate]);

  // Google OAuth removed as requested

  const handleEmailSignIn = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setInfoMsg(null);
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;
      if (data.session) {
        navigate("/generate");
      }
    } catch (error: any) {
      console.error("Error signing in:", error);
      if (error?.message?.toLowerCase().includes("invalid login credentials")) {
        setErrorMsg("Invalid email or password. Try resetting your password.");
      } else {
        setErrorMsg(error.message || "Error signing in");
      }
      setLoading(false);
    }
  };

  const handleEmailSignUp = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setInfoMsg(null);
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;
      if (data.session) {
        navigate("/generate");
      } else {
        setInfoMsg("Check your email to confirm your account, then sign in.");
        setLoading(false);
      }
    } catch (error: any) {
      console.error("Error signing up:", error);
      // Only show the "already exists" message for the explicit case
      if (typeof error?.message === 'string' && error.message.toLowerCase().includes('already registered')) {
        setErrorMsg("An account with this email already exists. Try signing in or reset your password.");
      } else {
        setErrorMsg(error?.message || "Error signing up");
      }
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setInfoMsg(null);
      if (!email) {
        setErrorMsg("Enter your email above, then click 'Forgot password?' again.");
        setLoading(false);
        return;
      }
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setInfoMsg("Password reset email sent. Check your inbox.");
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      setErrorMsg(error.message || "Could not send password reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-primary-50 to-primary-100 flex flex-col items-center justify-center px-6">
      <div className="max-w-md mx-auto text-center">
        {/* ColdConnect Logo */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gradient mb-4">
            ColdConnect
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-primary-600 to-primary-800 mx-auto rounded-full"></div>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome Back
          </h2>
          <p className="text-gray-600">
            Sign in to start generating professional emails
          </p>
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-left">
            {errorMsg}
          </div>
        )}
        {infoMsg && (
          <div className="mb-4 text-sm text-primary-700 bg-primary-50 border border-primary-200 rounded-lg px-4 py-3 text-left">
            {infoMsg}
          </div>
        )}

        {/* Email / Password Auth */}
        <div className="my-4" />

        <div className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex justify-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setAuthMode("signin")}
              className={`px-4 py-2 rounded-lg text-sm font-medium border ${authMode === "signin" ? "bg-primary-600 text-white border-primary-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
              disabled={loading}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("signup")}
              className={`px-4 py-2 rounded-lg text-sm font-medium border ${authMode === "signup" ? "bg-primary-600 text-white border-primary-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
              disabled={loading}
            >
              Sign Up
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (authMode === "signin") {
                handleEmailSignIn();
              } else {
                handleEmailSignUp();
              }
            }}
            className="space-y-4"
          >
            <div className="text-left">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="text-left">
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <div className="mt-2 text-left">
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={loading}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authMode === "signin" ? (loading ? "Signing in..." : "Sign In") : (loading ? "Creating account..." : "Sign Up")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}