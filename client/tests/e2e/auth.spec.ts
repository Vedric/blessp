import { test, expect } from '@playwright/test';
import { AuthPage } from './pages/auth.page';

test.describe('Authentication', () => {
  test.describe('Sign Up', () => {
    test('displays validation errors for empty fields on submit', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.navigateToSignUp();

      await authPage.signUpSubmit.click();

      // Validation errors should appear for required fields
      const errorMessages = page.locator('.text-red-500');
      await expect(errorMessages.first()).toBeVisible();
    });

    test('shows password strength indicator when typing', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.navigateToSignUp();

      // Type a weak password
      await authPage.signUpPassword.fill('abc');

      // The strength indicator should be visible
      const strengthSection = page.locator('text=/weak|fair|good|strong/i');
      await expect(strengthSection.first()).toBeVisible();
    });

    test('validates password strength requirements', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.navigateToSignUp();

      // Type a strong password to see all checks pass
      await authPage.signUpPassword.fill('MyStr0ng!Pass99');

      // The "strong" label should appear
      const strongLabel = page.locator('text=/strong/i');
      await expect(strongLabel.first()).toBeVisible();
    });

    test('shows password match confirmation', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.navigateToSignUp();

      const password = 'MyStr0ng!Pass99';
      await authPage.signUpPassword.fill(password);
      await authPage.signUpConfirmPassword.fill(password);
      await authPage.signUpConfirmPassword.blur();

      // Should show passwords match confirmation
      const matchText = page.locator('.text-green-600');
      await expect(matchText).toBeVisible();
    });

    test('shows mismatch error when passwords differ', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.navigateToSignUp();

      await authPage.signUpPassword.fill('MyStr0ng!Pass99');
      await authPage.signUpConfirmPassword.fill('DifferentPass123!');
      await authPage.signUpConfirmPassword.blur();

      // Should show mismatch error
      const mismatchError = page.locator('.text-red-500');
      await expect(mismatchError.first()).toBeVisible();
    });

    test('navigates to sign in page via link', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.navigateToSignUp();

      await authPage.goToSignIn.click();
      await expect(page).toHaveURL('/signin');
    });
  });

  test.describe('Sign In', () => {
    test('displays validation errors for empty fields', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.navigateToSignIn();

      await authPage.signInSubmit.click();

      const errorMessages = page.locator('.text-red-500');
      await expect(errorMessages.first()).toBeVisible();
    });

    test('shows email validation error for invalid format', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.navigateToSignIn();

      await authPage.signInEmail.fill('not-an-email');
      await authPage.signInPassword.fill('somepassword');
      await authPage.signInSubmit.click();

      const errorMessages = page.locator('.text-red-500');
      await expect(errorMessages.first()).toBeVisible();
    });

    test('shows error message for invalid credentials', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.navigateToSignIn();

      await authPage.signIn('nonexistent@example.com', 'WrongPassword123!');

      // Wait for the error to appear (after API call)
      await expect(authPage.signInError).toBeVisible({ timeout: 10_000 });
    });

    test('navigates to sign up page via link', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.navigateToSignIn();

      await authPage.goToSignUp.click();
      await expect(page).toHaveURL('/signup');
    });

    test('navigates to forgot password page', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.navigateToSignIn();

      await page.locator('a[href="/forgot-password"]').click();
      await expect(page).toHaveURL('/forgot-password');
    });
  });

  test.describe('Protected Routes', () => {
    test('redirects to sign in when accessing profile unauthenticated', async ({ page }) => {
      await page.goto('/profile');
      await expect(page).toHaveURL(/\/signin/);
    });

    test('redirects to sign in when accessing wishlist unauthenticated', async ({ page }) => {
      await page.goto('/wishlist');
      await expect(page).toHaveURL(/\/signin/);
    });

    test('redirects to sign in when accessing checkout unauthenticated', async ({ page }) => {
      await page.goto('/checkout');
      await expect(page).toHaveURL(/\/signin/);
    });
  });
});
