import { AppError } from './app.error';

export class EmailAlreadyTakenError extends AppError {
  readonly statusCode = 409;
  readonly code = 'EMAIL_ALREADY_TAKEN';

  constructor(email: string) {
    super('An account with this email address already exists.', { email });
  }
}

export class InvalidCredentialsError extends AppError {
  readonly statusCode = 401;
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('Invalid email or password.');
  }
}

export class TokenExpiredError extends AppError {
  readonly statusCode = 401;
  readonly code = 'TOKEN_EXPIRED';

  constructor(message: string = 'The token has expired.') {
    super(message);
  }
}

export class InsufficientStockError extends AppError {
  readonly statusCode = 422;
  readonly code = 'INSUFFICIENT_STOCK';

  constructor(productId: string) {
    super('Insufficient stock for the requested product.', { productId });
  }
}
