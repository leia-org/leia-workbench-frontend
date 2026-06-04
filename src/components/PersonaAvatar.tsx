import React from "react";

interface PersonaAvatarProps {
  src?: string | null;
  alt: string;
  label?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  fallbackClassName?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
  xl: "w-44 h-44",
};

const textSizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
  xl: "text-7xl",
};

const avatarPublicBaseUrl = (import.meta.env.VITE_AVATAR_PUBLIC_URL || "")
  .replace(/\/+$/g, "");

export const resolveAvatarSrc = (value?: string | null): string => {
  const trimmedValue = typeof value === "string" ? value.trim() : "";
  if (!trimmedValue) return "";

  if (/^(https?:|data:image\/|blob:)/i.test(trimmedValue)) {
    return trimmedValue;
  }

  const normalizedValue = trimmedValue.replace(/^\/+/g, "");
  if (!normalizedValue.startsWith("images/")) {
    return "";
  }

  if (!avatarPublicBaseUrl) {
    return normalizedValue;
  }

  return `${avatarPublicBaseUrl}/${normalizedValue}`;
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
  alt,
  label,
  size = "md",
  className = "",
  fallbackClassName = "bg-blue-50 text-blue-700",
}) => {
  const resolvedSrc = resolveAvatarSrc(src);
  const [imageFailed, setImageFailed] = React.useState(false);
  const initials = getInitials(label || alt);

  React.useEffect(() => {
    setImageFailed(false);
  }, [resolvedSrc]);

  return (
    <div
      className={`${sizeClasses[size]} ${className} ${fallbackClassName} rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden`}
      title={label || alt}
      aria-label={alt}
    >
      {resolvedSrc && !imageFailed ? (
        <img
          src={resolvedSrc}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span
          className={`${textSizeClasses[size]} font-semibold leading-none`}
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
    </div>
  );
};
