const MIN_PASSWORD_LENGTH = 6;

export type PasswordValidationMessages = {
  minLength: string;
  uppercase: string;
  number: string;
};

export const PASSWORD_VALIDATION_MESSAGES: PasswordValidationMessages = {
  minLength: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  uppercase: 'Password must contain at least one uppercase letter.',
  number: 'Password must contain at least one number.',
};

/** Returns every failed rule so callers can show all messages at once. */
export function getPasswordValidationErrors(password: string): string[] {
  const errors: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(PASSWORD_VALIDATION_MESSAGES.minLength);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push(PASSWORD_VALIDATION_MESSAGES.uppercase);
  }
  if (!/[0-9]/.test(password)) {
    errors.push(PASSWORD_VALIDATION_MESSAGES.number);
  }
  return errors;
}

export function isPasswordValid(password: string): boolean {
  return getPasswordValidationErrors(password).length === 0;
}
