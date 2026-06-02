import { createTheme } from "@mui/material/styles";

// Custom palette extension so we can use `theme.palette.surfaces.*`
declare module "@mui/material/styles" {
  interface Palette {
    surfaces: {
      sidebar: string;
      subtle: string;
      hover: string;
      selected: string;
      accent: string;
    };
  }
  interface PaletteOptions {
    surfaces?: {
      sidebar: string;
      subtle: string;
      hover: string;
      selected: string;
      accent: string;
    };
  }
}

export const adminTheme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#FAFAF9",
      paper: "#FFFFFF",
    },
    divider: "#E7E5E4",
    text: {
      primary: "#0A0A0A",
      secondary: "#57534E",
      disabled: "#A8A29E",
    },
    primary: {
      main: "#2563EB",
      dark: "#1D4ED8",
      contrastText: "#FFFFFF",
    },
    success: { main: "#16A34A" },
    warning: { main: "#D97706" },
    error: { main: "#DC2626" },
    surfaces: {
      sidebar: "#FFFFFF",
      subtle: "#F5F5F4",
      hover: "#F4F4F5",
      selected: "#F1F5FE",
      accent: "#EFF6FF",
    },
  },
  shape: {
    borderRadius: 6,
  },
  typography: {
    fontFamily: "'Manrope Variable', system-ui, sans-serif",
    body1: {
      fontSize: 14,
      lineHeight: 1.5,
      fontWeight: 400,
    },
    body2: {
      fontSize: 13,
      lineHeight: 1.45,
      fontWeight: 400,
    },
    subtitle2: {
      fontSize: 14,
      fontWeight: 600,
      letterSpacing: "-0.005em",
    },
    caption: {
      fontSize: 12,
      lineHeight: 1.4,
      fontWeight: 400,
      color: "#57534E",
    },
    overline: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#A8A29E",
      lineHeight: 1.2,
    },
    h6: {
      fontSize: 18,
      fontWeight: 600,
      letterSpacing: "-0.01em",
    },
    button: {
      textTransform: "none",
      fontWeight: 500,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ".mono": {
          fontFamily:
            "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
        },
        body: {
          // Tailwind's preflight disables user-select on body; we re-enable
          // it on admin surfaces so things feel like a normal app.
          WebkitUserSelect: "text",
          userSelect: "text",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        size: "small",
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 6,
          textTransform: "none",
          fontWeight: 500,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
        color: "transparent",
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },
    MuiSelect: {
      defaultProps: {
        size: "small",
      },
    },
  },
  shadows: [
    "none",
    "0 1px 2px rgba(15,15,15,0.04), 0 1px 1px rgba(15,15,15,0.03)",
    "0 2px 4px rgba(15,15,15,0.05), 0 1px 2px rgba(15,15,15,0.03)",
    "0 4px 8px rgba(15,15,15,0.06), 0 2px 4px rgba(15,15,15,0.04)",
    "0 6px 12px rgba(15,15,15,0.07), 0 2px 4px rgba(15,15,15,0.04)",
    "0 8px 16px rgba(15,15,15,0.08), 0 3px 6px rgba(15,15,15,0.04)",
    "0 10px 20px rgba(15,15,15,0.08), 0 3px 6px rgba(15,15,15,0.05)",
    "0 12px 24px rgba(15,15,15,0.08), 0 4px 8px rgba(15,15,15,0.05)",
    "0 14px 28px rgba(15,15,15,0.09), 0 5px 10px rgba(15,15,15,0.05)",
    "0 16px 32px rgba(15,15,15,0.09), 0 6px 12px rgba(15,15,15,0.05)",
    "0 18px 36px rgba(15,15,15,0.10), 0 7px 14px rgba(15,15,15,0.06)",
    "0 20px 40px rgba(15,15,15,0.10), 0 8px 16px rgba(15,15,15,0.06)",
    "0 22px 44px rgba(15,15,15,0.10), 0 9px 18px rgba(15,15,15,0.06)",
    "0 24px 48px rgba(15,15,15,0.11), 0 10px 20px rgba(15,15,15,0.06)",
    "0 26px 52px rgba(15,15,15,0.11), 0 11px 22px rgba(15,15,15,0.07)",
    "0 28px 56px rgba(15,15,15,0.12), 0 12px 24px rgba(15,15,15,0.07)",
    "0 30px 60px rgba(15,15,15,0.12), 0 13px 26px rgba(15,15,15,0.07)",
    "0 32px 64px rgba(15,15,15,0.13), 0 14px 28px rgba(15,15,15,0.07)",
    "0 34px 68px rgba(15,15,15,0.13), 0 15px 30px rgba(15,15,15,0.08)",
    "0 36px 72px rgba(15,15,15,0.13), 0 16px 32px rgba(15,15,15,0.08)",
    "0 38px 76px rgba(15,15,15,0.14), 0 17px 34px rgba(15,15,15,0.08)",
    "0 40px 80px rgba(15,15,15,0.14), 0 18px 36px rgba(15,15,15,0.08)",
    "0 42px 84px rgba(15,15,15,0.14), 0 19px 38px rgba(15,15,15,0.09)",
    "0 44px 88px rgba(15,15,15,0.15), 0 20px 40px rgba(15,15,15,0.09)",
    "0 46px 92px rgba(15,15,15,0.15), 0 21px 42px rgba(15,15,15,0.09)",
  ],
});

export default adminTheme;
