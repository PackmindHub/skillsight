import { initialsOf } from "./initials";

interface AvatarStackProps {
  emails: string[];
  max?: number;
}

export function AvatarStack({ emails, max = 4 }: AvatarStackProps) {
  const shown = emails.slice(0, max);
  const overflow = emails.length - shown.length;
  return (
    <span className="cohort-avatars">
      {shown.map((email, i) => (
        <span
          key={email}
          className="cohort-av"
          style={{ zIndex: max - i }}
          title={email}
        >
          {initialsOf(email)}
        </span>
      ))}
      {overflow > 0 && (
        <span className="cohort-av cohort-av-more" style={{ zIndex: 0 }}>
          +{overflow}
        </span>
      )}
    </span>
  );
}
