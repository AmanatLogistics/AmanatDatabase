/**
 * The password rule, stated once.
 *
 * No `server-only` here on purpose: the setup form shows the rule to the person
 * typing, and the server enforces it. Both need the same number, and a rule the
 * form and the server disagree about is worse than either alone.
 */

export const MIN_PASSWORD_LENGTH = 10;

/**
 * Length, and nothing else. Character-class rules push people towards
 * "Passw0rd!" and away from a long phrase, which is the opposite of what helps.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters. A short sentence works well.`;
  }
  if (password.length > 200) return "That is too long.";
  return null;
}
