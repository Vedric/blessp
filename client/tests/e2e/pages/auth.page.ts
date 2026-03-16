import { type Page, type Locator } from '@playwright/test';

export class AuthPage {
  readonly page: Page;

  // Sign In locators
  readonly signInHeading: Locator;
  readonly signInEmail: Locator;
  readonly signInPassword: Locator;
  readonly signInSubmit: Locator;
  readonly signInError: Locator;

  // Sign Up locators
  readonly signUpHeading: Locator;
  readonly signUpFirstName: Locator;
  readonly signUpLastName: Locator;
  readonly signUpEmail: Locator;
  readonly signUpPassword: Locator;
  readonly signUpConfirmPassword: Locator;
  readonly signUpSubmit: Locator;
  readonly signUpError: Locator;

  // Password strength indicator
  readonly passwordStrengthBar: Locator;

  // Navigation links
  readonly goToSignUp: Locator;
  readonly goToSignIn: Locator;

  constructor(page: Page) {
    this.page = page;

    // Sign In
    this.signInHeading = page.locator('h1');
    this.signInEmail = page.locator('input#email');
    this.signInPassword = page.locator('input#password');
    this.signInSubmit = page.locator('button[type="submit"]');
    this.signInError = page.locator('.bg-red-50');

    // Sign Up
    this.signUpHeading = page.locator('h1');
    this.signUpFirstName = page.locator('input#firstName');
    this.signUpLastName = page.locator('input#lastName');
    this.signUpEmail = page.locator('input#email');
    this.signUpPassword = page.locator('input#password');
    this.signUpConfirmPassword = page.locator('input#confirmPassword');
    this.signUpSubmit = page.locator('button[type="submit"]');
    this.signUpError = page.locator('.bg-red-50');

    // Password strength (visible when password has content)
    this.passwordStrengthBar = page.locator('[class*="rounded-full"][class*="h-full"]');

    // Links between sign in and sign up
    this.goToSignUp = page.locator('a[href="/signup"]');
    this.goToSignIn = page.locator('a[href="/signin"]');
  }

  async navigateToSignIn() {
    await this.page.goto('/signin');
    await this.page.waitForLoadState('networkidle');
    // Wait for the form to be visible
    await this.signInSubmit.waitFor({ state: 'visible', timeout: 10_000 });
  }

  async navigateToSignUp() {
    await this.page.goto('/signup');
    await this.page.waitForLoadState('networkidle');
    // Wait for the form to be visible
    await this.signUpSubmit.waitFor({ state: 'visible', timeout: 10_000 });
  }

  async signIn(email: string, password: string) {
    await this.signInEmail.fill(email);
    await this.signInPassword.fill(password);
    await this.signInSubmit.click();
  }

  async signUp(data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) {
    await this.signUpFirstName.fill(data.firstName);
    await this.signUpLastName.fill(data.lastName);
    await this.signUpEmail.fill(data.email);
    await this.signUpPassword.fill(data.password);
    await this.signUpConfirmPassword.fill(data.confirmPassword);
    await this.signUpSubmit.click();
  }
}
