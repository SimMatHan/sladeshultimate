# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Mobile-First Layout Pattern

This app uses a **3-row grid layout** optimized for mobile devices (390–430px viewport width) with safe-area support for notches and home indicators.

### Architecture

The layout is implemented using CSS Grid with three regions:
1. **Sticky TopNav** (`header.topbar`) - Always visible at the top
2. **Scrollable Content** (`main.scroll-region`) - Only scrollable area in the middle
3. **Sticky BottomTabBar** (`nav.bottombar`) - Always visible at the bottom

### Key Components

- **`AppShell`** (`src/components/AppShell.jsx`) - Wraps all routes with the 3-row grid layout
- **`Page`** (`src/components/Page.jsx`) - Simple content wrapper (optional, for backward compatibility)
- **`TopBar`** (`src/components/TopBar.jsx`) - Header with title, profile, and actions
- **`TabBar`** (`src/components/TabBar.jsx`) - Bottom navigation with 5 tabs

### CSS Classes

- `.app-shell` - Main container with `display: grid` and `grid-template-rows: auto 1fr auto`
- `.scroll-region` - Middle content area with `overflow: auto` and `min-height: 0`
- `.topbar` - Sticky header with `position: sticky; top: 0; z-index: 50`
- `.bottombar` - Sticky footer with `position: sticky; bottom: 0; z-index: 50`

### Design Tokens

All colors, spacing, and radii are defined in `src/tokens.css` using CSS variables:
- `--brand`, `--accent`, `--text`, `--muted`, `--bg`, `--radius`
- `--safe-top`, `--safe-bottom` for safe-area insets

### Dos and Don'ts

✅ **DO:**
- Use `min-h-[100dvh]` or `min-h-dvh` instead of `h-screen` for full-height containers
- Let only the middle `.scroll-region` scroll; keep top/bottom bars sticky
- Use design tokens via CSS variables: `bg-[color:var(--brand)]`
- Respect safe-area insets with `padding-top: var(--safe-top)` and `padding-bottom: var(--safe-bottom)`
- Keep content within `max-w-[480px]` for optimal mobile experience

❌ **DON'T:**
- Use `h-screen` on full-page containers (causes issues on mobile browsers)
- Add `overflow-hidden` to `body` or `#root` (blocks scrolling of center content)
- Create nested scrollable containers that conflict with the main scroll region
- Use fixed positioning for top/bottom bars (use sticky instead)
- Hardcode colors; always use design tokens

### Example Usage

```jsx
// Pages automatically get the layout via AppShell
export default function Home() {
  return (
    <div className="w-full">
      {/* Your page content here */}
    </div>
  );
}
```

The `AppShell` component handles all layout concerns, so pages just need to render their content directly.
