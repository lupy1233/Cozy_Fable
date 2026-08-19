import { z } from 'zod';

// Scheme Zod comune auth — frontend (RHF) + potential backend.
// Mesajele de eroare se mapeaza in frontend pe chei i18n, nu pe text.

export const loginSchema = z.object({
  email: z.string().email('invalidEmail').max(254),
  password: z.string().min(8, 'passwordTooShort').max(72),
  totpCode: z.string().length(6).optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email('invalidEmail').max(254),
  password: z.string().min(8, 'passwordTooShort').max(72),
  name: z.string().min(2, 'nameTooShort').max(100),
  phone: z.string().max(20).optional().or(z.literal('')),
  role: z.enum(['CLIENT', 'COMPANY_USER']),
  languagePreference: z.enum(['RO', 'EN']).optional(),
  // L0-A: acceptarea termenilor e obligatorie la inregistrare
  termsAccepted: z.literal(true, { errorMap: () => ({ message: 'termsRequired' }) }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// L0-A: retrimitere email de confirmare / parola uitata (raspuns uniform pe server)
export const emailOnlySchema = z.object({
  email: z.string().email('invalidEmail').max(254),
});
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;

// parola noua + confirmare (reset si change) — politica identica cu register
const newPasswordFields = {
  newPassword: z.string().min(8, 'passwordTooShort').max(72),
  confirmPassword: z.string(),
};

export const resetPasswordSchema = z
  .object({ token: z.string().length(64), ...newPasswordFields })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'passwordsMismatch',
    path: ['confirmPassword'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'required').max(72), ...newPasswordFields })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'passwordsMismatch',
    path: ['confirmPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: 'CLIENT' | 'COMPANY_USER' | 'ADMIN';
  languagePreference: 'RO' | 'EN';
  emailVerifiedAt: string | null;
  twoFactorEnabled: boolean;
}
