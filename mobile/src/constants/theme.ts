export const colors = {
  primary: "#1B5E20",
  primaryLight: "#4C8C4A",
  primaryDark: "#003300",

  secondary: "#FF6B35",
  secondaryLight: "#FF8A5B",
  secondaryDark: "#E55100",

  accent: {
    gold: "#FFD700",
    blue: "#2196F3",
    purple: "#7B1FA2",
  },

  score: {
    eagle: "#7B1FA2",
    birdie: "#1B5E20",
    par: "#424242",
    bogey: "#E65100",
    double: "#B71C1C",
  },

  success: "#4CAF50",
  warning: "#FFC107",
  error: "#F44336",
  info: "#03A9F4",

  gray: {
    50: "#FAFAFA",
    100: "#F5F5F5",
    200: "#EEEEEE",
    300: "#E0E0E0",
    400: "#BDBDBD",
    500: "#9E9E9E",
    600: "#757575",
    700: "#616161",
    800: "#424242",
    900: "#212121",
  },

  bg: {
    primary: "#FFFFFF",
    secondary: "#F5F5F5",
    card: "#FFFFFF",
    dark: "#121212",
  },

  text: {
    primary: "#212121",
    secondary: "#757575",
    disabled: "#BDBDBD",
    inverse: "#FFFFFF",
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
} as const;
