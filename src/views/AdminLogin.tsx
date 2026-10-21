import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  IconButton,
  InputAdornment,
  InputBase,
  ThemeProvider,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { adminTheme } from "../components/admin/theme";
import { SplitLoginLayout } from "./Login";
import { useAuth } from "../context";
import type { DecodedToken } from "../context";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { isTurnstileEnabled } from "../config/turnstile";
import "@fontsource-variable/manrope/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, token } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [isManualLogin, setIsManualLogin] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);

  const handleTurnstileTokenChange = useCallback((value: string) => {
    setTurnstileToken(value);
  }, []);

  const rawRedirect = searchParams.get("redirect");
  const redirectTo =
    rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/administration";
      
  useEffect(() => {
    if (token && !isManualLogin) {
      navigate(redirectTo);
      toast.info(
        redirectTo === "/administration"
          ? "You are already logged in, redirecting to admin panel..."
          : "You are already logged in, redirecting to the requested page..."
      );
    }
  }, [token, navigate, isManualLogin, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setSuccess(false);
      setMessage("Please fill in all fields");
      return;
    }
    if (isTurnstileEnabled && !turnstileToken) {
      setSuccess(false);
      setMessage("Please complete the verification challenge.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_AUTH_SERVICE_BACKEND}/api/v1/users/login`,
        {
          email: email.trim(),
          password: password.trim(),
          ...(isTurnstileEnabled && {
            "cf-turnstile-response": turnstileToken,
          }),
        },
        { withCredentials: true },
      );
      const newToken = response.data.token;

      if (newToken) {
        const { role } = jwtDecode<DecodedToken>(newToken);

        if (!["admin", "advanced"].includes(role)) {
          setSuccess(false);
          setMessage("Instructors cannot access workbench administration.");
          setTurnstileToken("");
          setTurnstileKey((key) => key + 1);
          return;
        }

        setSuccess(true);
        setMessage("Logged in successfully!");
        setIsManualLogin(true);
        login(newToken);

        setTimeout(() => navigate(redirectTo), 1000);
      } else {
        setSuccess(false);
        setMessage("Something went wrong, please try again later.");
      }
    } catch (error: unknown) {
      setSuccess(false);

      let errorMessage = "An error occurred";

      if (axios.isAxiosError(error) && error.response) {
        const { status, data } = error.response;

        if (status === 400 && data?.validationErrors) {
          const validationErrors = Object.values(
            data.validationErrors
          ) as string[];
          errorMessage = validationErrors.join(", ");
        } else if (data?.message) {
          errorMessage = data.message;
        }
      }

      setMessage(errorMessage);
      setTurnstileToken("");
      setTurnstileKey((key) => key + 1);
    } finally {
      setLoading(false);
    }
  };

  if (token && !isManualLogin) {
    return null;
  }

  const submitDisabled = loading || (isTurnstileEnabled && !turnstileToken);

  return (
    <ThemeProvider theme={adminTheme}>
      <CssBaseline />
      <SplitLoginLayout
        eyebrow="Administration"
        title="Run replications. Watch sessions. Audit conversations."
        subtitle="Sign in with your administrator account to unlock the workbench."
      >
        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ width: "100%", maxWidth: 420 }}
        >
          <Typography
            sx={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: "text.primary",
              mb: 1,
              lineHeight: 1.15,
            }}
          >
            Admin sign in
          </Typography>
          <Typography
            sx={{
              fontSize: 14,
              color: "text.secondary",
              mb: 4.5,
              lineHeight: 1.55,
            }}
          >
            Enter your administrator credentials to access the workbench.
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <AuthField
              id="email"
              label="Email"
              value={email}
              onChange={setEmail}
              type="text"
              autoComplete="email"
              placeholder="you@example.com"
              autoFocus
            />

            <AuthField
              id="password"
              label="Password"
              value={password}
              onChange={setPassword}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••••"
              endAdornment={
                <InputAdornment position="end" sx={{ mr: 0.5 }}>
                  <IconButton
                    aria-label="Toggle password visibility"
                    onClick={() => setShowPassword((prev) => !prev)}
                    edge="end"
                    size="small"
                  >
                    {showPassword ? (
                      <VisibilityOffOutlinedIcon sx={{ fontSize: 20 }} />
                    ) : (
                      <VisibilityOutlinedIcon sx={{ fontSize: 20 }} />
                    )}
                  </IconButton>
                </InputAdornment>
              }
            />

            {message && (
              <Alert
                severity={success ? "success" : "error"}
                variant="standard"
                sx={{
                  py: 0.75,
                  fontSize: 13,
                  borderRadius: 1.5,
                  "& .MuiAlert-message": { py: 0.25 },
                }}
              >
                {message}
              </Alert>
            )}

            {isTurnstileEnabled && (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <TurnstileWidget
                  key={turnstileKey}
                  onTokenChange={handleTurnstileTokenChange}
                />
              </Box>
            )}

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={submitDisabled}
              endIcon={
                loading ? undefined : <ArrowForwardIcon sx={{ fontSize: 18 }} />
              }
              sx={{
                mt: 1,
                py: 1.5,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "-0.005em",
                borderRadius: 1.5,
                textTransform: "none",
              }}
            >
              {loading ? (
                <CircularProgress size={18} sx={{ color: "white" }} />
              ) : (
                "Sign in"
              )}
            </Button>
          </Box>
        </Box>
      </SplitLoginLayout>
    </ThemeProvider>
  );
};

interface AuthFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  endAdornment?: React.ReactNode;
}

const AuthField: React.FC<AuthFieldProps> = ({
  id,
  label,
  value,
  onChange,
  type,
  placeholder,
  autoComplete,
  autoFocus,
  endAdornment,
}) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
    <Typography
      component="label"
      htmlFor={id}
      sx={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "text.disabled",
      }}
    >
      {label}
    </Typography>
    <InputBase
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      endAdornment={endAdornment}
      required
      fullWidth
      sx={{
        px: 1.75,
        py: 1.25,
        fontSize: 14.5,
        bgcolor: "surfaces.subtle",
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        transition: "border-color 120ms ease, background-color 120ms ease",
        "& input::placeholder": {
          color: "text.disabled",
          opacity: 1,
        },
        "&:hover": {
          borderColor: "text.disabled",
        },
        "&.Mui-focused, &:focus-within": {
          borderColor: "primary.main",
          bgcolor: "background.paper",
          boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.12)",
        },
      }}
    />
  </Box>
);

export default AdminLogin;
