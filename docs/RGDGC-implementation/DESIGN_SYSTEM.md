# RGDGC App - Design System & Brand Guidelines

This document defines the visual identity, component library, and design patterns for the River Grove Disc Golf Club application. The design is inspired by familiar disc golf aesthetics (UDisc patterns) and the community-driven feel of the RGDGC Facebook group.

---

## Table of Contents

1. [Brand Identity](#1-brand-identity)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Iconography](#4-iconography)
5. [Component Library](#5-component-library)
6. [Layout Patterns](#6-layout-patterns)
7. [Animation & Motion](#7-animation--motion)
8. [Accessibility](#8-accessibility)

---

## 1. Brand Identity

### 1.1 Brand Essence

**River Grove Disc Golf Club** represents:
- **Community**: Local players united by passion
- **Competition**: Friendly but serious league play
- **Innovation**: AI coaching, blockchain rewards
- **Nature**: The wooded, riverside course aesthetic

### 1.2 Logo Concept

The RGDGC logo should incorporate:
- **Disc silhouette** - The universal symbol of the sport
- **Tree/Grove element** - Representing the "Grove" in River Grove
- **River curve** - Subtle water element for "River"
- **Clean modern lines** - Differentiating from traditional club logos

```
Logo Variations:
├── Primary Logo (Full color, horizontal)
├── Stacked Logo (Vertical, for square spaces)
├── Icon Only (Disc + tree mark)
├── Monochrome (White on dark, black on light)
└── Token Logo ($RGDG branding)
```

### 1.3 Mascot/Character (Optional)

**"Chainbanger"** - A friendly disc-throwing character
- Used in gamification elements
- Achievement badges
- Loading animations
- Bot avatar

### 1.4 Brand Voice

| Context | Tone | Example |
|---------|------|---------|
| App UI | Friendly, Clear | "Nice birdie! 🎯" |
| League Results | Professional | "Sunday Singles Results - March 22" |
| AI Coach | Encouraging | "Your C1 putting improved 3% this week" |
| Bot Chat | Casual, Helpful | "Hey! What can I help with?" |
| Error States | Supportive | "Oops! Let's try that again." |

---

## 2. Color System

### 2.1 Primary Palette

Inspired by disc golf courses: forest greens, earth tones, and high-visibility accent colors.

```css
:root {
  /* Primary Brand Colors */
  --color-primary: #1B5E20;         /* Forest Green - Main brand color */
  --color-primary-light: #4C8C4A;   /* Light Forest */
  --color-primary-dark: #003300;    /* Deep Forest */
  
  /* Secondary Colors */
  --color-secondary: #FF6B35;       /* Disc Orange - CTAs, highlights */
  --color-secondary-light: #FF8A5B;
  --color-secondary-dark: #E55100;
  
  /* Accent Colors */
  --color-accent-gold: #FFD700;     /* Achievements, premium */
  --color-accent-blue: #2196F3;     /* Links, info */
  --color-accent-purple: #7B1FA2;   /* Blockchain/Web3 elements */
  
  /* Semantic Colors */
  --color-success: #4CAF50;         /* Makes, completions */
  --color-warning: #FFC107;         /* Pending, attention */
  --color-error: #F44336;           /* Errors, OB */
  --color-info: #03A9F4;            /* Tips, help */
  
  /* Score Colors (UDisc-inspired) */
  --color-eagle: #7B1FA2;           /* -2 or better */
  --color-birdie: #1B5E20;          /* -1 */
  --color-par: #424242;             /* 0 */
  --color-bogey: #E65100;           /* +1 */
  --color-double: #B71C1C;          /* +2 or worse */
}
```

### 2.2 Neutral Palette

```css
:root {
  /* Neutrals */
  --color-gray-50: #FAFAFA;
  --color-gray-100: #F5F5F5;
  --color-gray-200: #EEEEEE;
  --color-gray-300: #E0E0E0;
  --color-gray-400: #BDBDBD;
  --color-gray-500: #9E9E9E;
  --color-gray-600: #757575;
  --color-gray-700: #616161;
  --color-gray-800: #424242;
  --color-gray-900: #212121;
  
  /* Background Colors */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F5F5F5;
  --bg-card: #FFFFFF;
  --bg-dark: #121212;
  
  /* Text Colors */
  --text-primary: #212121;
  --text-secondary: #757575;
  --text-disabled: #BDBDBD;
  --text-inverse: #FFFFFF;
}
```

### 2.3 Dark Mode

```css
[data-theme="dark"] {
  --bg-primary: #121212;
  --bg-secondary: #1E1E1E;
  --bg-card: #2D2D2D;
  
  --text-primary: #FFFFFF;
  --text-secondary: #B0B0B0;
  --text-disabled: #666666;
  
  --color-primary: #4CAF50;
  --color-primary-light: #81C784;
  --color-primary-dark: #2E7D32;
}
```

### 2.4 Gradients

```css
:root {
  /* Hero gradients */
  --gradient-forest: linear-gradient(135deg, #1B5E20 0%, #4C8C4A 100%);
  --gradient-sunset: linear-gradient(135deg, #FF6B35 0%, #FFD700 100%);
  --gradient-premium: linear-gradient(135deg, #7B1FA2 0%, #E040FB 100%);
  
  /* Card gradients */
  --gradient-card-hover: linear-gradient(180deg, transparent 0%, rgba(27,94,32,0.05) 100%);
  
  /* Score backgrounds */
  --gradient-birdie: linear-gradient(135deg, rgba(27,94,32,0.1) 0%, rgba(76,140,74,0.1) 100%);
  --gradient-bogey: linear-gradient(135deg, rgba(230,81,0,0.1) 0%, rgba(255,107,53,0.1) 100%);
}
```

---

## 3. Typography

### 3.1 Font Stack

```css
:root {
  /* Primary Font - Clean, modern, readable */
  --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  
  /* Display Font - For headings, hero text */
  --font-display: 'Poppins', var(--font-primary);
  
  /* Monospace - For scores, stats, code */
  --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
}
```

### 3.2 Type Scale

```css
:root {
  /* Base size */
  --text-base: 16px;
  
  /* Scale */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-md: 1rem;       /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  --text-4xl: 2.25rem;   /* 36px */
  --text-5xl: 3rem;      /* 48px */
  
  /* Line heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
  
  /* Font weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

### 3.3 Text Styles

```css
/* Headings */
.h1 { font-family: var(--font-display); font-size: var(--text-4xl); font-weight: var(--font-bold); line-height: var(--leading-tight); }
.h2 { font-family: var(--font-display); font-size: var(--text-3xl); font-weight: var(--font-bold); line-height: var(--leading-tight); }
.h3 { font-family: var(--font-display); font-size: var(--text-2xl); font-weight: var(--font-semibold); line-height: var(--leading-tight); }
.h4 { font-family: var(--font-display); font-size: var(--text-xl); font-weight: var(--font-semibold); line-height: var(--leading-normal); }

/* Body text */
.body-lg { font-size: var(--text-lg); line-height: var(--leading-relaxed); }
.body-md { font-size: var(--text-md); line-height: var(--leading-normal); }
.body-sm { font-size: var(--text-sm); line-height: var(--leading-normal); }

/* Special */
.score-display { font-family: var(--font-mono); font-size: var(--text-2xl); font-weight: var(--font-bold); }
.stat-label { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
.stat-value { font-family: var(--font-mono); font-size: var(--text-xl); font-weight: var(--font-semibold); }
```

---

## 4. Iconography

### 4.1 Icon Library

Use **Lucide Icons** as the primary icon set for consistency with React ecosystem.

```jsx
import { 
  Target,        // Basket/hole
  Disc3,         // Disc
  Trophy,        // Achievements
  Users,         // Players/social
  BarChart3,     // Stats
  Wallet,        // Crypto wallet
  Map,           // Course map
  Calendar,      // Events
  Settings,      // Settings
  ChevronRight,  // Navigation
} from 'lucide-react';
```

### 4.2 Custom Icons Needed

| Icon | Description | Usage |
|------|-------------|-------|
| Disc in basket | Disc entering chains | Make/success |
| Flying disc | Disc in flight | Throw action |
| C1 circle | Circle 1 indicator | Putting stats |
| C2 circle | Circle 2 indicator | Putting stats |
| OB marker | Out of bounds | Penalty indicator |
| $RGDG token | Token logo | Wallet, payments |
| Putt stance | Person putting | Training mode |

### 4.3 Icon Sizing

```css
:root {
  --icon-xs: 16px;
  --icon-sm: 20px;
  --icon-md: 24px;
  --icon-lg: 32px;
  --icon-xl: 48px;
}
```

---

## 5. Component Library

### 5.1 Buttons

```jsx
// Primary Button
<button className="btn-primary">
  Start Round
</button>

// Secondary Button
<button className="btn-secondary">
  View Stats
</button>

// Ghost Button
<button className="btn-ghost">
  Cancel
</button>

// Icon Button
<button className="btn-icon">
  <Plus />
</button>
```

```css
.btn-primary {
  background: var(--color-primary);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: var(--font-semibold);
  transition: all 0.2s;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-secondary {
  background: transparent;
  color: var(--color-primary);
  border: 2px solid var(--color-primary);
  padding: 10px 22px;
  border-radius: 8px;
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  padding: 12px 24px;
}
```

### 5.2 Cards

```jsx
// Basic Card
<div className="card">
  <div className="card-header">
    <h3>Round Summary</h3>
  </div>
  <div className="card-body">
    {/* Content */}
  </div>
</div>

// Elevated Card (for scores, stats)
<div className="card card-elevated">
  {/* Content */}
</div>

// Interactive Card
<div className="card card-interactive" onClick={handleClick}>
  {/* Content */}
  <ChevronRight className="card-arrow" />
</div>
```

```css
.card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.card-elevated {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.card-interactive {
  cursor: pointer;
  transition: all 0.2s;
}

.card-interactive:hover {
  box-shadow: 0 6px 16px rgba(0,0,0,0.2);
  transform: translateY(-2px);
}
```

### 5.3 Score Display

```jsx
// Single Score
<span className={`score score-${getScoreClass(score, par)}`}>
  {formatScore(score, par)}
</span>

// Scorecard Row
<div className="scorecard-row">
  <span className="hole-number">1</span>
  <span className="hole-par">3</span>
  <span className="score score-birdie">2</span>
</div>
```

```css
.score {
  font-family: var(--font-mono);
  font-weight: var(--font-bold);
  padding: 4px 12px;
  border-radius: 6px;
  display: inline-block;
  min-width: 40px;
  text-align: center;
}

.score-eagle { background: var(--color-eagle); color: white; }
.score-birdie { background: var(--color-birdie); color: white; }
.score-par { background: var(--color-gray-200); color: var(--text-primary); }
.score-bogey { background: var(--color-bogey); color: white; }
.score-double { background: var(--color-double); color: white; }
```

### 5.4 Leaderboard Row

```jsx
<div className="leaderboard-row">
  <span className="rank">1</span>
  <img src={avatar} className="avatar" />
  <span className="player-name">John Doe</span>
  <span className="points">142</span>
  <span className="trend trend-up">▲ 2</span>
</div>
```

```css
.leaderboard-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-gray-200);
}

.leaderboard-row:nth-child(1) .rank {
  background: gold;
  color: #000;
}

.leaderboard-row:nth-child(2) .rank {
  background: silver;
  color: #000;
}

.leaderboard-row:nth-child(3) .rank {
  background: #CD7F32;
  color: white;
}

.rank {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-bold);
  background: var(--color-gray-200);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.trend-up { color: var(--color-success); }
.trend-down { color: var(--color-error); }
```

### 5.5 Input Fields

```jsx
<div className="input-group">
  <label htmlFor="email">Email</label>
  <input 
    type="email" 
    id="email" 
    className="input" 
    placeholder="your@email.com" 
  />
  <span className="input-error">Invalid email format</span>
</div>

// Score Input (specialized)
<div className="score-input">
  <button className="score-btn minus">-</button>
  <span className="score-value">3</span>
  <button className="score-btn plus">+</button>
</div>
```

```css
.input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--color-gray-300);
  border-radius: 8px;
  font-size: var(--text-md);
  transition: border-color 0.2s;
}

.input:focus {
  border-color: var(--color-primary);
  outline: none;
}

.input-error {
  color: var(--color-error);
  font-size: var(--text-sm);
  margin-top: 4px;
}

.score-input {
  display: flex;
  align-items: center;
  gap: 16px;
}

.score-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
}

.score-btn.minus {
  background: var(--color-gray-200);
  color: var(--text-primary);
}

.score-btn.plus {
  background: var(--color-primary);
  color: white;
}

.score-value {
  font-family: var(--font-mono);
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  min-width: 60px;
  text-align: center;
}
```

### 5.6 Navigation

```jsx
// Bottom Tab Bar
<nav className="tab-bar">
  <button className="tab-item active">
    <Home />
    <span>Home</span>
  </button>
  <button className="tab-item">
    <Disc3 />
    <span>Rounds</span>
  </button>
  <button className="tab-item">
    <Trophy />
    <span>Leagues</span>
  </button>
  <button className="tab-item">
    <Target />
    <span>Training</span>
  </button>
  <button className="tab-item">
    <User />
    <span>Profile</span>
  </button>
</nav>
```

```css
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  background: var(--bg-primary);
  border-top: 1px solid var(--color-gray-200);
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  color: var(--text-secondary);
  background: none;
  border: none;
}

.tab-item.active {
  color: var(--color-primary);
}

.tab-item span {
  font-size: var(--text-xs);
}
```

---

## 6. Layout Patterns

### 6.1 Spacing Scale

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

### 6.2 Grid System

```css
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.grid {
  display: grid;
  gap: var(--space-4);
}

.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }

@media (max-width: 768px) {
  .grid-3, .grid-4 { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 480px) {
  .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
}
```

### 6.3 Page Templates

**Dashboard Layout:**
```
┌─────────────────────────────────┐
│ Header (Logo + Notifications)   │
├─────────────────────────────────┤
│ Welcome Banner / Quick Start    │
├─────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐        │
│ │ Card 1  │ │ Card 2  │        │
│ │ (Stats) │ │(League) │        │
│ └─────────┘ └─────────┘        │
├─────────────────────────────────┤
│ Recent Activity List            │
├─────────────────────────────────┤
│ Bottom Tab Navigation           │
└─────────────────────────────────┘
```

**Scoring Layout:**
```
┌─────────────────────────────────┐
│ < Back │ Hole 7 of 18 │ Save   │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │     Hole Map / GPS View     │ │
│ │    Distance: 287 ft        │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ Par: 3  │ Your Score: [3]      │
│         │ [ - ] 3 [ + ]        │
├─────────────────────────────────┤
│ OB: 0   │ Putts: 1             │
├─────────────────────────────────┤
│ [ Previous Hole ] [ Next Hole ]│
└─────────────────────────────────┘
```

### 6.4 Safe Areas (Mobile)

```css
.page {
  padding-top: env(safe-area-inset-top);
  padding-bottom: calc(60px + env(safe-area-inset-bottom));
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

---

## 7. Animation & Motion

### 7.1 Timing Functions

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
}
```

### 7.2 Common Animations

```css
/* Fade In */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide Up */
@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(20px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scale In (for success states) */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Score Pop (when entering score) */
@keyframes scorePop {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

/* Disc Flight (for game/AR) */
@keyframes discFlight {
  0% { transform: translateX(0) rotate(0deg); }
  100% { transform: translateX(100px) rotate(720deg); }
}
```

### 7.3 Transition Classes

```css
.transition-all {
  transition: all var(--duration-normal) var(--ease-out);
}

.transition-transform {
  transition: transform var(--duration-fast) var(--ease-out);
}

.transition-opacity {
  transition: opacity var(--duration-normal) var(--ease-out);
}
```

---

## 8. Accessibility

### 8.1 Color Contrast

All text must meet WCAG 2.1 AA standards:
- Normal text: 4.5:1 contrast ratio
- Large text (18pt+): 3:1 contrast ratio
- Interactive elements: 3:1 contrast ratio

### 8.2 Focus States

```css
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Remove outline for mouse users */
*:focus:not(:focus-visible) {
  outline: none;
}
```

### 8.3 Touch Targets

Minimum touch target size: 44x44 pixels

```css
.touch-target {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### 8.4 Screen Reader Utilities

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.sr-only-focusable:focus {
  position: static;
  width: auto;
  height: auto;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

### 8.5 ARIA Labels

```jsx
// Score input example
<div 
  role="group" 
  aria-label="Score for hole 1"
>
  <button 
    aria-label="Decrease score"
    onClick={decrease}
  >
    -
  </button>
  <span aria-live="polite">{score}</span>
  <button 
    aria-label="Increase score"
    onClick={increase}
  >
    +
  </button>
</div>

// Leaderboard row
<div 
  role="row" 
  aria-label={`Rank ${rank}: ${playerName} with ${points} points`}
>
  {/* content */}
</div>
```

### 8.6 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Design Tokens (Tailwind Config)

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1B5E20',
          light: '#4C8C4A',
          dark: '#003300',
        },
        secondary: {
          DEFAULT: '#FF6B35',
          light: '#FF8A5B',
          dark: '#E55100',
        },
        score: {
          eagle: '#7B1FA2',
          birdie: '#1B5E20',
          par: '#424242',
          bogey: '#E65100',
          double: '#B71C1C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
        'full': '9999px',
      },
    },
  },
};
```

---

## Summary

This design system provides:

1. **Consistent branding** rooted in disc golf aesthetics
2. **Accessible components** meeting WCAG 2.1 AA
3. **Mobile-first responsive** layouts
4. **Familiar UX patterns** inspired by UDisc
5. **Dark mode support** built-in
6. **Animation guidelines** for polished interactions
7. **Tailwind integration** for rapid development

All components should be implemented as React components with TypeScript for type safety.
