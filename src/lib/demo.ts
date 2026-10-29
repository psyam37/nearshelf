// Demo accounts: password sign-in for showing NearShelf to pharmacies, without
// waiting for (or running out of) sign-in emails. Server only.
//
// Locally (`npm run dev`) any account may use it. On the live site only the
// addresses in DEMO_SIGNIN_EMAILS may, e.g.
//   DEMO_SIGNIN_EMAILS=hoxton@example.com,oldstreet@example.com
// Real pharmacy staff always sign in with an emailed link.
import "server-only";

export function demoSignInEmails(): string[] {
  return (process.env.DEMO_SIGNIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** Show the password form at all? */
export function demoSignInEnabled(): boolean {
  return process.env.NODE_ENV === "development" || demoSignInEmails().length > 0;
}

/** May this address sign in with a password? */
export function passwordSignInAllowed(email: string): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    demoSignInEmails().includes(email.trim().toLowerCase())
  );
}
