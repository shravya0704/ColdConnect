import { useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleSession = async () => {
      await supabase.auth.getSession();
      navigate("/generate");
    };
    handleSession();
  }, [navigate]);

  return (
    <div className="h-screen flex items-center justify-center">
      <p className="text-lg text-gray-600">Finishing login...</p>
    </div>
  );
}