import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { adminTheme } from "../components/admin/theme";
import { SplitLoginLayout, AuthForm } from "./Login";
import "@fontsource-variable/manrope/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();

  const [adminCode, setAdminCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminCode.trim()) {
      setSuccess(false);
      setMessage("Please enter the administrator code");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/secret`,
        { secret: adminCode.trim() }
      );

      if (response.status === 200 && response.data) {
        setSuccess(true);
        setMessage("Authentication successful! Redirecting...");
        localStorage.setItem("adminSecret", adminCode.trim());
        setTimeout(() => navigate("/administration"), 1000);
      } else {
        setSuccess(false);
        setMessage("Invalid code. Please try again.");
      }
    } catch (error: unknown) {
      console.error("Validation error:", error);
      setSuccess(false);
      const msg =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Authentication error. Please try again.";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={adminTheme}>
      <CssBaseline />
      <SplitLoginLayout
        eyebrow="Administration"
        title="Run replications. Watch sessions. Audit conversations."
        subtitle="Sign in with the administrator code to unlock the workbench."
      >
        <AuthForm
          onSubmit={handleSubmit}
          title="Admin sign in"
          description="Enter the administrator code to access the workbench."
          fields={[
            {
              id: "adminCode",
              label: "Administrator code",
              value: adminCode,
              onChange: setAdminCode,
              type: "password",
              autoComplete: "current-password",
              placeholder: "••••••••••••",
              autoFocus: true,
            },
          ]}
          message={message}
          success={success}
          loading={loading}
          submitLabel="Sign in"
        />
      </SplitLoginLayout>
    </ThemeProvider>
  );
};

export default AdminLogin;
