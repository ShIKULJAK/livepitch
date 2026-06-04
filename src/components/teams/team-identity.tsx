type TeamAvatarProps = {
  name: string;
  profileImageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

type TeamIdentityProps = TeamAvatarProps & {
  showName?: boolean;
  nameClassName?: string;
  gapClassName?: string;
};

const sizeClassMap = {
  sm: "h-4 w-4 text-[10px]",
  md: "h-5 w-5 text-xs",
  lg: "h-6 w-6 text-sm",
} as const;

export function TeamAvatar({ name, profileImageUrl, size = "sm", className = "" }: TeamAvatarProps) {
  const sizeClass = sizeClassMap[size];

  if (profileImageUrl) {
    return <img src={profileImageUrl} alt={name} className={`${sizeClass} rounded-full object-cover ${className}`.trim()} loading="lazy" />;
  }

  return <span className={`inline-flex items-center justify-center ${sizeClass} ${className}`.trim()}>🛡️</span>;
}

export function TeamIdentity({
  name,
  profileImageUrl,
  size = "sm",
  className = "",
  showName = true,
  nameClassName = "",
  gapClassName = "gap-2",
}: TeamIdentityProps) {
  return (
    <span className={`flex items-center ${gapClassName} ${className}`.trim()}>
      <TeamAvatar name={name} profileImageUrl={profileImageUrl} size={size} />
      {showName ? <span className={nameClassName}>{name}</span> : null}
    </span>
  );
}
