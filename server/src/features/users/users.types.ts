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
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface DeleteAccountDto {
  password: string;
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
