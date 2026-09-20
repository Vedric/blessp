export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateUserDto {
  locale?: 'en' | 'fr';
  currentPassword?: string;
  mfaToken?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface ChangePasswordDto {
  mfaToken?: string;
  currentPassword: string;
  newPassword: string;
}

export interface DeleteAccountDto {
  password?: string;
  mfaToken?: string;
}

export interface EmailPreferenceResponse {
  orderUpdates: boolean;
  promotions: boolean;
  newsletter: boolean;
  loyaltyAlerts: boolean;
}

export interface UpdateEmailPreferencesDto {
  orderUpdates?: boolean;
  promotions?: boolean;
  newsletter?: boolean;
  loyaltyAlerts?: boolean;
}
