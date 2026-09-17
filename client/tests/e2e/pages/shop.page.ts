import { type Page, type Locator } from '@playwright/test';

export class ShopPage {
  readonly page: Page;

  // Main elements
  readonly heading: Locator;
  readonly productGrid: Locator;
  readonly productCards: Locator;
  readonly loadingSkeletons: Locator;
  readonly emptyState: Locator;

  // Category filters (desktop)
  readonly categoryButtons: Locator;

  // Sort dropdown
  readonly sortButton: Locator;
  readonly sortDropdown: Locator;

  // Pagination
  readonly paginationButtons: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.locator('h1');
    this.productGrid = page.locator('.grid.grid-cols-2');
    this.productCards = page.locator('.grid.grid-cols-2 a[href^="/products/"]');
    this.loadingSkeletons = page.locator('.animate-pulse');
    this.emptyState = page.locator('text=No products found').or(
      page.locator('[class*="PackageOpen"]').locator('..').locator('..'),
    );

    this.categoryButtons = page.locator('.hidden.gap-2.sm\\:flex button');
    this.sortButton = page.locator('button:has(svg.h-3\\.5)');
    this.sortDropdown = page.locator('.absolute.right-0.top-full.z-30');
    this.paginationButtons = page.locator('.mt-16 button');
  }

  async navigate() {
    await this.page.goto('/shop');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForProductsLoaded() {
    // Wait for loading skeletons to disappear
    await this.loadingSkeletons.first().waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {
      // Products may have loaded before we started waiting
    });
  }

  async selectCategory(name: string) {
    await this.page.locator(`button:has-text("${name}")`).first().click();
    await this.waitForProductsLoaded();
  }

  async getProductCount(): Promise<number> {
    return this.productCards.count();
  }

  async clickFirstProduct() {
    await this.productCards.first().click();
  }

  async getProductNames(): Promise<string[]> {
    const names = await this.page.locator('.grid.grid-cols-2 h3').allTextContents();
    return names;
  }
}
