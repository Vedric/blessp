# 004. 🎨 React with Vite and Tailwind CSS for the Frontend

**Status**: ✅ Accepted
**Date**: 2026-03-13
**Deciders**: Engineering team

## 🤔 Context

The BLE$$ P storefront requires a rich, interactive user interface with smooth animations, responsive design, and fast page transitions. The brand aesthetic is luxury streetwear, which demands polished visual details: fluid page transitions, hover effects, scroll-triggered reveals, and a cohesive design system with custom typography and colors.

The frontend must also handle:

- 🔐 Authenticated user flows (registration, login, profile management)
- 🛒 Shopping cart with real-time updates
- 💳 PCI-compliant payment form (Stripe Elements)
- 👑 Admin dashboard for product and order management
- 📱 Fully responsive design (mobile-first)

### 🔍 Alternatives Evaluated

#### UI Framework

| Framework | Verdict | Reasoning |
|-----------|---------|-----------|
| **React 19** | ✅ Selected | Component-based architecture, hooks, mature ecosystem, deep team expertise. React 19's improved type inference benefits the TypeScript codebase |
| **Next.js 15** | ❌ Rejected | Full-featured framework with SSR/SSG. Powerful, but introduces server-side rendering complexity that is unnecessary here. The API is already handled by a dedicated Express backend. Adding Next.js would create two server runtimes to manage |
| **Vue 3** | ❌ Rejected | Capable alternative with excellent documentation, but the team has deeper expertise in React. Switching would slow down delivery without a compelling technical advantage |
| **Svelte 5** | ❌ Rejected | Excellent performance characteristics and developer experience, but smaller ecosystem and fewer battle-tested libraries for e-commerce (payment integration, form handling) |
| **Create React App** | ❌ Rejected | Deprecated and no longer maintained. Not a viable option for new projects |

#### Build Tool

| Tool | Verdict | Reasoning |
|------|---------|-----------|
| **Vite 6** | ✅ Selected | Sub-second hot module replacement, fast production builds with Rollup, minimal configuration, excellent TypeScript support out of the box |
| **Webpack 5** | ❌ Rejected | Slower HMR, more complex configuration, larger config surface. Vite provides a better developer experience with less setup |
| **esbuild** | ❌ Rejected | Extremely fast, but lacks the plugin ecosystem and production build features (code splitting, asset handling) that Vite provides via Rollup |

#### Styling

| Approach | Verdict | Reasoning |
|----------|---------|-----------|
| **Tailwind CSS 3** | ✅ Selected | Utility-first approach enables rapid iteration. Design tokens (colors, fonts, spacing) are configured once in `tailwind.config.js` and enforced everywhere. No context-switching between HTML and CSS files |
| **CSS Modules** | ❌ Rejected | Scoped styles are good, but require creating a separate `.module.css` file for every component. Slower iteration compared to inline utilities |
| **styled-components** | ❌ Rejected | Runtime CSS-in-JS adds bundle size and runtime overhead. The CSS-in-JS trend has shifted toward zero-runtime solutions |
| **Vanilla CSS** | ❌ Rejected | No design token enforcement, global namespace collisions, harder to maintain consistency across a growing component library |

#### Animation

| Library | Verdict | Reasoning |
|---------|---------|-----------|
| **Framer Motion 12** | ✅ Selected | Declarative API that aligns with React's component model. Supports layout animations, page transitions, gesture-based interactions, and scroll-triggered reveals |
| **CSS transitions** | ❌ Rejected | Sufficient for simple hover effects, but cannot handle layout animations, exit animations (animating elements as they unmount), or spring physics |
| **GSAP** | ❌ Rejected | Powerful imperative animation library, but its imperative style conflicts with React's declarative paradigm. Requires manual cleanup and ref management |

## ✅ Decision

We adopt the following frontend stack:

### 🧩 Core Stack

| Technology | Version | Role |
|-----------|---------|------|
| React | 19.1 | UI library (components, hooks, context) |
| Vite | 6.3 | Build tool (dev server, production bundler) |
| TypeScript | 5.x | Type safety across the entire frontend |
| React Router | 7.4 | Client-side routing with nested layouts |
| Tailwind CSS | 3.4 | Utility-first styling with design tokens |
| Framer Motion | 12.5 | Declarative animations and page transitions |

### 🔌 Integration Libraries

| Library | Role |
|---------|------|
| `@stripe/react-stripe-js` + `@stripe/stripe-js` | 💳 PCI-compliant payment form rendering via Stripe Elements |
| `react-hot-toast` | 🔔 Toast notifications for user feedback |
| `lucide-react` | 🎯 Consistent, lightweight SVG icon set |

### 🎨 Design System

The design system is configured in `client/tailwind.config.js`:

**Typography:**

| Font | Usage | Loaded via |
|------|-------|-----------|
| **Inter** | Body text, UI elements | Google Fonts (`font-sans`) |
| **Playfair Display** | Headlines, display text | Google Fonts (`font-display`) |

**Brand Colors:**

| Token | Hex | Usage |
|-------|-----|-------|
| `brand.gold` | `#C6A55C` | Primary accent, CTAs, highlights |
| `brand.dark` | `#0A0A0A` | Background, dark surfaces |

**Custom Animations (defined in Tailwind config):**

| Animation | Effect |
|-----------|--------|
| `fade-in` | Opacity 0 → 1, translateY 10px → 0 (0.5s ease-out) |
| `slide-up` | translateY 20px → 0 (0.6s ease-out) |

### 🗺️ Routing Architecture

React Router 7 handles all client-side routing with a nested layout structure:

```
<Layout>                          # Shared header + footer
├── /                             # 🏠 Home (public)
├── /shop                         # 🛍️ Product listing (public)
├── /products/:id                 # 📦 Product detail (public)
├── /signin                       # 🔐 Sign in (public)
├── /signup                       # 📝 Sign up (public)
├── /forgot-password              # 🔑 Forgot password (public)
├── /reset-password               # 🔑 Reset password (public)
├── /checkout                     # 💳 Checkout (protected)
├── /profile                      # 👤 User profile (protected)
├── /profile/orders               # 📋 Order history (protected)
├── /profile/orders/:id           # 📦 Order detail (protected)
├── /profile/addresses            # 📫 Address management (protected)
├── /admin                        # 👑 Admin dashboard (admin only)
├── /admin/products               # 📦 Product management (admin only)
├── /admin/products/:id/edit      # ✏️ Edit product (admin only)
└── /admin/orders                 # 📋 Order management (admin only)
```

**Route protection:**

- `<ProtectedRoute>` wraps routes that require authentication. Unauthenticated users are redirected to `/signin`
- `<AdminRoute>` wraps routes that require admin privileges. Non-admin users are denied access

### 🔄 API Communication

The client communicates with the server through a custom fetch wrapper (`client/src/lib/api.ts`) that:

1. Automatically attaches the `Authorization: Bearer <token>` header
2. Intercepts 401 responses and attempts a token refresh
3. Retries the original request with the new access token
4. Redirects to `/signin` if the refresh also fails

## 📊 Consequences

### What becomes easier ✅

- **Fast iteration on UI changes** with Vite's near-instant HMR (hot module replacement). Saving a file reflects changes in the browser in under 100ms
- **Consistent visual design** through Tailwind's utility classes and design tokens. Colors, fonts, spacing, and breakpoints are defined once and enforced everywhere
- **Complex animations** (page transitions, hover effects, scroll-triggered reveals) through Framer Motion's declarative API, which integrates naturally with React's component lifecycle
- **Secure payment collection** through Stripe's pre-built, PCI-compliant Elements components. We never handle raw card numbers
- **Type safety** across the frontend with TypeScript and React 19's improved type inference. Props, state, context values, and API responses are all typed
- **Responsive design** via Tailwind's mobile-first breakpoint system (`sm:`, `md:`, `lg:`, `xl:`)

### What becomes harder ⚠️

- **Verbose class lists in JSX.** Tailwind's utility-first approach produces long `className` strings. We mitigate this by extracting reusable components (e.g., `<Button>`, `<Card>`, `<Container>`) that encapsulate common class combinations
- **No server-side rendering.** The initial page load relies entirely on client-side JavaScript. SEO for public product pages may require additional work in the future (prerendering, or a migration to a framework like Next.js). For the current use case (a luxury streetwear brand with a known audience), client-side rendering is acceptable
- **Bundle size impact from Framer Motion.** Framer Motion adds approximately 30 KB (gzipped) to the bundle. We accept this trade-off for the animation quality and developer experience it provides
- **No built-in data fetching layer.** The frontend uses React context and custom hooks for state management, which is sufficient for the current feature set. If the application grows significantly (more complex caching, optimistic updates, pagination), we would evaluate React Query or Zustand
- **Client-side auth state is ephemeral.** Access tokens are stored in memory (not localStorage), which means a page refresh requires a token refresh via the `/auth/refresh` endpoint. This is a deliberate security trade-off (reduced XSS exposure at the cost of a brief loading state on refresh)
