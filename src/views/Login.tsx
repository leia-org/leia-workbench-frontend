import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  InputBase,
  ThemeProvider,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { adminTheme } from "../components/admin/theme";
import "@fontsource-variable/manrope/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";

function generateUID(length: number = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let uid = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    uid += chars[randomIndex];
  }
  return uid;
}

export const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [studentIdentifier, setStudentIdentifier] = useState("");
  const [experimentCode, setExperimentCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const sCode = searchParams.get("sCode");
    let email = searchParams.get("email");
    const code = searchParams.get("code");

    if (sCode || email) {
      if (email === "test") {
        email = generateUID() + "@test.com";
      } else if (email !== null && email.startsWith("_test_")) {
        const remainder = email.slice(6);
        email = remainder + generateUID() + "@test.com";
      }
      setStudentIdentifier(sCode || email || "");
    }
    if (code) setExperimentCode(code);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdentifier.trim() || !experimentCode.trim()) {
      setSuccess(false);
      setMessage("Please fill in all fields");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_APP_BACKEND}/api/v1/interactions`,
        {
          email: studentIdentifier.trim(),
          code: experimentCode.trim(),
        }
      );
      const data = response.data;
      if (response.status === 201 && data) {
        const { sessionId } = data;
        setSuccess(true);
        setMessage("Session started successfully!");
        localStorage.setItem("sessionId", sessionId);
        setTimeout(() => navigate(`/chat/${sessionId}`), 1000);
      } else {
        setSuccess(false);
        setMessage("Failed to start session. Please try again.");
      }
    } catch (error: unknown) {
      console.error("Error details:", error);
      setSuccess(false);
      const msg =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Failed to start session. Please try again.";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={adminTheme}>
      <CssBaseline />
      <SplitLoginLayout title="LEIA Workbench">
        <AuthForm
          onSubmit={handleSubmit}
          title="Start your session"
          description="Enter your email and the replication code your instructor shared."
          fields={[
            {
              id: "studentIdentifier",
              label: "Email",
              value: studentIdentifier,
              onChange: setStudentIdentifier,
              type: "text",
              autoComplete: "email",
              placeholder: "you@example.com",
            },
            {
              id: "experimentCode",
              label: "Replication code",
              value: experimentCode,
              onChange: setExperimentCode,
              type: "text",
              placeholder: "RM98F-RH1B6-QBNK7",
              mono: true,
            },
          ]}
          message={message}
          success={success}
          loading={loading}
          submitLabel="Start session"
        />
      </SplitLoginLayout>
    </ThemeProvider>
  );
};

// — Shared split layout shell ------------------------------------------

interface SplitLoginLayoutProps {
  /** Optional uppercase label rendered above the title. Skip the whole
   *  text block by leaving all three text props undefined. */
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

// Two-column auth scaffold. Below `md` the brand panel collapses; the
// form panel takes the full screen on mobile so the user is never
// scrolling past decoration to reach the inputs.
export const SplitLoginLayout: React.FC<SplitLoginLayoutProps> = ({
  eyebrow,
  title,
  subtitle,
  children,
}) => {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr" },
        bgcolor: "background.default",
      }}
    >
      {/* Left brand panel — solid color, pure typography. No SVG, no
          patterns, no gradients. Logo top-left, title block centered,
          footer bottom. That's it. */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          p: 6,
          color: "white",
          bgcolor: "#0B1A3D",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box
            component="img"
            src="/logo/leia_main_white.png"
            alt="LEIA"
            sx={{ width: 22, height: 22, objectFit: "contain" }}
          />
          <Typography
            sx={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}
          >
            LEIA
          </Typography>
        </Box>

        {title || subtitle || eyebrow ? (
          <Box sx={{ maxWidth: 500 }}>
            {eyebrow && (
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.55)",
                  mb: 2,
                }}
              >
                {eyebrow}
              </Typography>
            )}
            {title && (
              <Typography
                sx={{
                  fontSize: 42,
                  fontWeight: 700,
                  lineHeight: 1.04,
                  letterSpacing: "-0.035em",
                  mb: subtitle ? 2.5 : 0,
                  color: "white",
                }}
              >
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography
                sx={{
                  fontSize: 16,
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        ) : (
          <Box />
        )}

        <Box>
          <Typography
            sx={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}
          >
            © LEIA Workbench
          </Typography>
          <Typography
            sx={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 11,
              mt: 0.25,
            }}
          >
            Developed by the LEIA Team
          </Typography>
        </Box>
      </Box>

      {/* Right form panel */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 3, md: 8 },
          py: { xs: 6, md: 4 },
          bgcolor: "background.paper",
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

// — Bespoke auth form --------------------------------------------------

interface AuthFormField {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  mono?: boolean;
}

interface AuthFormProps {
  onSubmit: (e: React.FormEvent) => void;
  title: string;
  description: string;
  fields: AuthFormField[];
  message?: string;
  success: boolean;
  loading: boolean;
  submitLabel: string;
}

export const AuthForm: React.FC<AuthFormProps> = ({
  onSubmit,
  title,
  description,
  fields,
  message,
  success,
  loading,
  submitLabel,
}) => (
  <Box
    component="form"
    onSubmit={onSubmit}
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
      {title}
    </Typography>
    <Typography
      sx={{
        fontSize: 14,
        color: "text.secondary",
        mb: 4.5,
        lineHeight: 1.55,
      }}
    >
      {description}
    </Typography>

    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {fields.map((field, idx) => (
        <AuthField key={field.id} {...field} autoFocus={field.autoFocus ?? idx === 0} />
      ))}

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

      <Button
        type="submit"
        variant="contained"
        size="large"
        fullWidth
        disabled={loading}
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
          submitLabel
        )}
      </Button>
    </Box>
  </Box>
);

const AuthField: React.FC<AuthFormField> = ({
  id,
  label,
  value,
  onChange,
  type,
  placeholder,
  autoComplete,
  autoFocus,
  mono,
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
        fontFamily: mono
          ? "'JetBrains Mono Variable', ui-monospace, monospace"
          : undefined,
        letterSpacing: mono ? "0.02em" : undefined,
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

export default Login;
