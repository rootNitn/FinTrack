export type UserRole = 'USER' | 'ADMIN';
export type PlanTier = 'FREE' | 'PLUS' | 'PRO';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  dateOfBirth: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  totpEnabled?: boolean;
  planTier: PlanTier;
  planExpiresAt: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}

export interface TwoFactorRequiredResponse {
  requiresTwoFactor: true;
  twoFactorToken: string;
}

export type LoginResult = AuthResponse | TwoFactorRequiredResponse;

export function isTwoFactorRequired(result: LoginResult): result is TwoFactorRequiredResponse {
  return (result as TwoFactorRequiredResponse).requiresTwoFactor === true;
}

export interface TwoFactorVerifyLoginPayload {
  twoFactorToken: string;
  code: string;
  rememberMe?: boolean;
}

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface TwoFactorEnableResponse {
  message: string;
  backupCodes: string[];
}

export interface TwoFactorStatus {
  enabled: boolean;
  remainingBackupCodes: number;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface GoogleLoginPayload {
  idToken: string;
  rememberMe?: boolean;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface DeleteAccountPayload {
  password?: string;
  confirmation: string;
}

export interface UpdateProfilePayload {
  name?: string;
  avatarUrl?: string | null;
  dateOfBirth?: string | null;
}

export interface TwoFactorDisablePayload {
  password: string;
}
