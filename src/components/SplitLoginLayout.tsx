import type { FC, ReactNode, Ref } from "react";
import { Box, Typography } from "@mui/material";

interface SplitLoginLayoutProps {
  /** Optional uppercase label rendered above the title. Skip the whole
   *  text block by leaving all three text props undefined. */
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  titleRef?: Ref<HTMLHeadingElement>;
  showBrandOnMobile?: boolean;
  fitViewport?: boolean;
  children: ReactNode;
}

// Two-column auth scaffold. Below `md` the brand panel collapses; the
// form panel takes the full screen on mobile so the user is never
// scrolling past decoration to reach the inputs.
export const SplitLoginLayout: FC<SplitLoginLayoutProps> = ({
  eyebrow,
  title,
  subtitle,
  titleRef,
  showBrandOnMobile = false,
  fitViewport = false,
  children,
}) => {
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        height: { md: fitViewport ? "100dvh" : undefined },
        overflow: { md: fitViewport ? "hidden" : undefined },
        gridTemplateRows: { xs: showBrandOnMobile ? "auto 1fr" : "1fr", md: fitViewport ? "minmax(0, 1fr)" : "auto" },
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
          display: { xs: showBrandOnMobile ? "flex" : "none", md: "flex" },
          gap: { xs: 3, md: 4 },
          flexDirection: "column",
          justifyContent: "space-between",
          p: { xs: 3, md: 6 },
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
                component="h1"
                ref={titleRef}
                tabIndex={titleRef ? -1 : undefined}
                sx={{
                  fontSize: { xs: 30, md: 42 },
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

        <Box sx={{ display: { xs: "none", md: "block" } }}>
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
          minHeight: 0,
          minWidth: 0,
          px: { xs: 3, md: 8 },
          py: { xs: 6, md: fitViewport ? "clamp(0.75rem, 4dvh, 2rem)" : 4 },
          bgcolor: "background.paper",
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
