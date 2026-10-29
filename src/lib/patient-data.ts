// NearShelf never handles patient data (GDPR special category). The handover
// chat is the one place someone could type it, so messages are checked:
// here first, for an instant explanation, and again by the database
// (contains_patient_details), which has the final say. Keep the two in step.

const CHECKS: { pattern: RegExp; reason: string }[] = [
  { pattern: /(^|[^0-9])[0-9]{3} ?[0-9]{3} ?[0-9]{4}([^0-9]|$)/, reason: "an NHS number" },
  {
    pattern: /(^|[^0-9])[0-9]{1,2}[/.-][0-9]{1,2}[/.-][0-9]{2,4}([^0-9]|$)/,
    reason: "a date (like a date of birth)",
  },
  {
    pattern: /(^|[^a-z0-9])[a-z]{1,2}[0-9][a-z0-9]? ?[0-9][a-z]{2}([^a-z0-9]|$)/i,
    reason: "a postcode",
  },
  { pattern: /(^|[^0-9])(\+44 ?|0)[0-9]( ?[0-9]){8,9}([^0-9]|$)/, reason: "a phone number" },
  {
    pattern: /(^|[^a-z])(dob|d\.o\.b|date of birth|nhs (no|num|number))([^a-z]|$)/i,
    reason: "patient details",
  },
];

/** Why `text` looks like it holds patient details, or null if it looks fine. */
export function findPatientDetails(text: string): string | null {
  return CHECKS.find((check) => check.pattern.test(text))?.reason ?? null;
}
