export function initialsOf(email: string): string {
  const [user] = email.split("@");
  if (!user) return "??";
  const parts = user.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return user.slice(0, 2).toUpperCase();
}
