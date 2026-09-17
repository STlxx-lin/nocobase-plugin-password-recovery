export interface PasswordRecoveryPublicConfig {
  enabled: boolean;
  buttonText: string;
  codeLength?: number;
  codeExpiresInMinutes?: number;
}

export interface PasswordRecoveryFullConfig {
  id?: number;
  key: string;
  enabled: boolean;
  buttonText: string;
  workflowKey?: string;
  codeExpiresInMinutes: number;
  rateLimitPerMinute: number;
  maxFailedAttempts: number;
  codeLength: number;
  dailyLimitPerAccount: number;
  passwordPolicy: 'standard' | 'simple';
}

export interface PasswordRecoveryAuditLog {
  id: number;
  account: string;
  code?: string;
  userId?: number;
  username?: string;
  email?: string;
  phone?: string;
  nickname?: string;
  status: 'pending' | 'used' | 'expired' | 'test';
  ip?: string;
  createdAt: string;
  expiresAt?: string;
}

