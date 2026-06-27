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
});
export type RegisterInput = z.infer<typeof registerSchema>;

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
