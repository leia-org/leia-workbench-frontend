import React from "react";
import { Avatar as MuiAvatar } from "@mui/material";
import { buildAvatarCandidateSources } from "../lib/avatar";

interface PersonaAvatarProps {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  label?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  fallbackClassName?: string;
}

const sizeStyles = {
  sm: { dimension: 32, fontSize: 12 },
  md: { dimension: 48, fontSize: 14 },
  lg: { dimension: 64, fontSize: 18 },
  xl: { dimension: 176, fontSize: 72 },
};

export const getInitials = (value?: string | null): string => {
  const cleanValue = (value || "")
    .replace(/\bavatar\b/gi, "")
    .trim();

  if (!cleanValue) return "L";

  const parts = cleanValue
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return "L";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const PersonaAvatar: React.FC<PersonaAvatarProps> = ({
  src,
  fallbackSrc,
  alt,
  label,
  size = "md",
  className = "",
  fallbackClassName = "bg-blue-50 text-blue-700",
}) => {
  const candidateSources = React.useMemo(
    () => buildAvatarCandidateSources(src, fallbackSrc),
    [src, fallbackSrc],
  );
  const [currentSourceIndex, setCurrentSourceIndex] = React.useState(0);
  const resolvedSrc = candidateSources[currentSourceIndex] || "";
  const initials = getInitials(label || alt);
  const { dimension, fontSize } = sizeStyles[size];

  React.useEffect(() => {
    setCurrentSourceIndex(0);
  }, [candidateSources]);

  const handleImageError = () => {
    setCurrentSourceIndex((previousIndex) => {
      const nextIndex = previousIndex + 1;
      return nextIndex < candidateSources.length
        ? nextIndex
        : candidateSources.length;
    });
  };

  return (
    <MuiAvatar
      className={`${className} ${fallbackClassName}`.trim()}
      src={resolvedSrc || undefined}
      alt={alt}
      title={label || alt}
      aria-label={alt}
      imgProps={{ loading: "lazy", onError: handleImageError }}
      sx={{
        width: dimension,
        height: dimension,
        flexShrink: 0,
        fontSize,
        fontWeight: 600,
      }}
    >
      {initials}
    </MuiAvatar>
  );
};
