/**
 * Theme definitions for Nightshift
 * All colors are in HSL format (without the hsl() wrapper)
 */

export interface ThemeColors {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  destructiveForeground: string
  border: string
  input: string
  ring: string
}

export interface ThemeDefinition {
  id: string
  name: string
  description: string
  isDark: boolean
  colors: ThemeColors
}

export const themes: ThemeDefinition[] = [
  // Default Light
  {
    id: 'light',
    name: 'Light',
    description: 'Clean and bright default theme',
    isDark: false,
    colors: {
      background: '0 0% 100%',
      foreground: '0 0% 3.9%',
      card: '0 0% 100%',
      cardForeground: '0 0% 3.9%',
      popover: '0 0% 100%',
      popoverForeground: '0 0% 3.9%',
      primary: '0 0% 9%',
      primaryForeground: '0 0% 98%',
      secondary: '0 0% 96.1%',
      secondaryForeground: '0 0% 9%',
      muted: '0 0% 96.1%',
      mutedForeground: '0 0% 45.1%',
      accent: '0 0% 96.1%',
      accentForeground: '0 0% 9%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '0 0% 98%',
      border: '0 0% 89.8%',
      input: '0 0% 89.8%',
      ring: '0 0% 3.9%'
    }
  },

  // Default Dark
  {
    id: 'dark',
    name: 'Dark',
    description: 'Easy on the eyes default dark theme',
    isDark: true,
    colors: {
      background: '0 0% 3.9%',
      foreground: '0 0% 98%',
      card: '0 0% 3.9%',
      cardForeground: '0 0% 98%',
      popover: '0 0% 3.9%',
      popoverForeground: '0 0% 98%',
      primary: '0 0% 98%',
      primaryForeground: '0 0% 9%',
      secondary: '0 0% 14.9%',
      secondaryForeground: '0 0% 98%',
      muted: '0 0% 14.9%',
      mutedForeground: '0 0% 63.9%',
      accent: '0 0% 14.9%',
      accentForeground: '0 0% 98%',
      destructive: '0 62.8% 30.6%',
      destructiveForeground: '0 0% 98%',
      border: '0 0% 14.9%',
      input: '0 0% 14.9%',
      ring: '0 0% 83.1%'
    }
  },

  // VS Code Dark+
  {
    id: 'vscode-dark',
    name: 'VS Code Dark+',
    description: 'The most popular dark theme from Visual Studio Code',
    isDark: true,
    colors: {
      background: '0 0% 12%', // #1e1e1e
      foreground: '0 0% 83%', // #d4d4d4
      card: '0 0% 15%', // #252526
      cardForeground: '0 0% 83%',
      popover: '0 0% 15%',
      popoverForeground: '0 0% 83%',
      primary: '207 61% 59%', // #4ec9b0 (teal)
      primaryForeground: '0 0% 12%',
      secondary: '0 0% 19%', // #2d2d30
      secondaryForeground: '0 0% 83%',
      muted: '0 0% 19%',
      mutedForeground: '0 0% 50%', // comments
      accent: '109 58% 40%', // #608b4e (green)
      accentForeground: '0 0% 98%',
      destructive: '0 75% 60%', // #f44747
      destructiveForeground: '0 0% 98%',
      border: '0 0% 19%',
      input: '0 0% 19%',
      ring: '207 61% 59%'
    }
  },

  // Material Theme
  {
    id: 'material',
    name: 'Material',
    description: 'Google Material Design inspired theme',
    isDark: true,
    colors: {
      background: '220 13% 13%', // #263238
      foreground: '0 0% 93%', // #eeffff
      card: '218 13% 11%', // #1e272c
      cardForeground: '0 0% 93%',
      popover: '218 13% 11%',
      popoverForeground: '0 0% 93%',
      primary: '187 100% 42%', // #00bcd4 (cyan)
      primaryForeground: '220 13% 13%',
      secondary: '220 13% 18%', // #37474f
      secondaryForeground: '0 0% 93%',
      muted: '220 13% 18%',
      mutedForeground: '199 18% 46%', // #546e7a
      accent: '84 81% 44%', // #80cbc4
      accentForeground: '220 13% 13%',
      destructive: '0 100% 64%', // #ff5370
      destructiveForeground: '0 0% 98%',
      border: '220 13% 22%',
      input: '220 13% 22%',
      ring: '187 100% 42%'
    }
  },

  // Palenight
  {
    id: 'palenight',
    name: 'Palenight',
    description: 'Elegant dark theme with purple tones',
    isDark: true,
    colors: {
      background: '230 21% 11%', // #292d3e
      foreground: '231 47% 88%', // #a6accd
      card: '232 24% 9%', // #1b1e2b
      cardForeground: '231 47% 88%',
      popover: '232 24% 9%',
      popoverForeground: '231 47% 88%',
      primary: '267 67% 68%', // #c792ea (purple)
      primaryForeground: '230 21% 11%',
      secondary: '230 21% 15%', // #32374d
      secondaryForeground: '231 47% 88%',
      muted: '230 21% 15%',
      mutedForeground: '223 14% 48%', // #676e95
      accent: '199 100% 59%', // #82aaff (blue)
      accentForeground: '230 21% 11%',
      destructive: '343 81% 75%', // #ff5370
      destructiveForeground: '230 21% 11%',
      border: '230 21% 18%',
      input: '230 21% 18%',
      ring: '267 67% 68%'
    }
  },

  // Catppuccin Mocha
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    description: 'Soothing pastel dark theme',
    isDark: true,
    colors: {
      background: '240 21% 15%', // Base
      foreground: '226 64% 88%', // Text
      card: '240 21% 12%', // Mantle
      cardForeground: '226 64% 88%',
      popover: '240 21% 12%',
      popoverForeground: '226 64% 88%',
      primary: '267 84% 81%', // Mauve
      primaryForeground: '240 21% 15%',
      secondary: '240 21% 20%', // Surface0
      secondaryForeground: '226 64% 88%',
      muted: '240 21% 20%',
      mutedForeground: '228 24% 72%', // Subtext0
      accent: '189 71% 73%', // Teal
      accentForeground: '240 21% 15%',
      destructive: '351 74% 73%', // Red
      destructiveForeground: '240 21% 15%',
      border: '240 21% 25%', // Surface1
      input: '240 21% 25%',
      ring: '267 84% 81%'
    }
  },

  // Dracula
  {
    id: 'dracula',
    name: 'Dracula',
    description: 'Dark theme with vibrant colors',
    isDark: true,
    colors: {
      background: '231 15% 18%', // Background
      foreground: '60 30% 96%', // Foreground
      card: '232 14% 15%', // Current Line
      cardForeground: '60 30% 96%',
      popover: '232 14% 15%',
      popoverForeground: '60 30% 96%',
      primary: '265 89% 78%', // Purple
      primaryForeground: '231 15% 18%',
      secondary: '231 15% 25%',
      secondaryForeground: '60 30% 96%',
      muted: '231 15% 25%',
      mutedForeground: '225 27% 51%', // Comment
      accent: '135 94% 65%', // Green
      accentForeground: '231 15% 18%',
      destructive: '0 100% 67%', // Red
      destructiveForeground: '231 15% 18%',
      border: '231 15% 30%',
      input: '231 15% 30%',
      ring: '265 89% 78%'
    }
  },

  // Nord
  {
    id: 'nord',
    name: 'Nord',
    description: 'Arctic, north-bluish clean theme',
    isDark: true,
    colors: {
      background: '220 16% 22%', // Polar Night 0
      foreground: '218 27% 92%', // Snow Storm 2
      card: '222 16% 28%', // Polar Night 1
      cardForeground: '218 27% 92%',
      popover: '222 16% 28%',
      popoverForeground: '218 27% 92%',
      primary: '213 32% 52%', // Frost 0
      primaryForeground: '220 16% 22%',
      secondary: '220 17% 32%', // Polar Night 2
      secondaryForeground: '218 27% 92%',
      muted: '220 17% 32%',
      mutedForeground: '219 28% 75%', // Snow Storm 0
      accent: '179 25% 65%', // Frost 2
      accentForeground: '220 16% 22%',
      destructive: '354 42% 56%', // Aurora Red
      destructiveForeground: '220 16% 22%',
      border: '220 17% 32%',
      input: '220 17% 32%',
      ring: '213 32% 52%'
    }
  },

  // Tokyo Night
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    description: 'Dark theme inspired by Tokyo city lights',
    isDark: true,
    colors: {
      background: '235 18% 14%', // bg_dark
      foreground: '224 26% 83%', // fg
      card: '235 18% 17%', // bg
      cardForeground: '224 26% 83%',
      popover: '235 18% 17%',
      popoverForeground: '224 26% 83%',
      primary: '220 91% 73%', // blue
      primaryForeground: '235 18% 14%',
      secondary: '235 18% 22%', // bg_highlight
      secondaryForeground: '224 26% 83%',
      muted: '235 18% 22%',
      mutedForeground: '228 18% 58%', // comment
      accent: '267 84% 74%', // purple
      accentForeground: '235 18% 14%',
      destructive: '339 90% 66%', // red
      destructiveForeground: '235 18% 14%',
      border: '235 18% 25%',
      input: '235 18% 25%',
      ring: '220 91% 73%'
    }
  },

  // Gruvbox
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    description: 'Retro groove dark theme',
    isDark: true,
    colors: {
      background: '0 0% 16%', // bg0
      foreground: '48 87% 86%', // fg
      card: '20 4% 20%', // bg1
      cardForeground: '48 87% 86%',
      popover: '20 4% 20%',
      popoverForeground: '48 87% 86%',
      primary: '27 99% 55%', // orange
      primaryForeground: '0 0% 16%',
      secondary: '20 4% 25%', // bg2
      secondaryForeground: '48 87% 86%',
      muted: '20 4% 25%',
      mutedForeground: '40 12% 62%', // gray
      accent: '61 66% 44%', // yellow
      accentForeground: '0 0% 16%',
      destructive: '6 96% 59%', // red
      destructiveForeground: '0 0% 16%',
      border: '20 4% 30%', // bg3
      input: '20 4% 30%',
      ring: '27 99% 55%'
    }
  },

  // One Dark
  {
    id: 'one-dark',
    name: 'One Dark',
    description: 'Atom-inspired dark theme',
    isDark: true,
    colors: {
      background: '220 13% 18%', // bg
      foreground: '220 14% 71%', // fg
      card: '220 13% 16%',
      cardForeground: '220 14% 71%',
      popover: '220 13% 16%',
      popoverForeground: '220 14% 71%',
      primary: '207 82% 66%', // blue
      primaryForeground: '220 13% 18%',
      secondary: '220 13% 24%',
      secondaryForeground: '220 14% 71%',
      muted: '220 13% 24%',
      mutedForeground: '220 9% 46%', // comment
      accent: '286 60% 67%', // purple
      accentForeground: '220 13% 18%',
      destructive: '355 65% 65%', // red
      destructiveForeground: '220 13% 18%',
      border: '220 13% 28%',
      input: '220 13% 28%',
      ring: '207 82% 66%'
    }
  },

  // GitHub Dark
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    description: 'GitHub\'s modern dark theme',
    isDark: true,
    colors: {
      background: '220 13% 9%', // canvas.default
      foreground: '213 27% 84%', // fg.default
      card: '215 14% 13%', // canvas.subtle
      cardForeground: '213 27% 84%',
      popover: '215 14% 13%',
      popoverForeground: '213 27% 84%',
      primary: '212 92% 63%', // accent.fg
      primaryForeground: '220 13% 9%',
      secondary: '215 14% 18%',
      secondaryForeground: '213 27% 84%',
      muted: '215 14% 18%',
      mutedForeground: '217 10% 51%', // fg.muted
      accent: '137 55% 55%', // success.fg
      accentForeground: '220 13% 9%',
      destructive: '0 73% 60%', // danger.fg
      destructiveForeground: '220 13% 9%',
      border: '215 14% 22%', // border.default
      input: '215 14% 22%',
      ring: '212 92% 63%'
    }
  },

  // Monokai
  {
    id: 'monokai',
    name: 'Monokai',
    description: 'Classic theme from Sublime Text',
    isDark: true,
    colors: {
      background: '70 8% 15%', // bg
      foreground: '60 30% 96%', // fg
      card: '70 5% 12%',
      cardForeground: '60 30% 96%',
      popover: '70 5% 12%',
      popoverForeground: '60 30% 96%',
      primary: '326 100% 74%', // pink
      primaryForeground: '70 8% 15%',
      secondary: '70 8% 20%',
      secondaryForeground: '60 30% 96%',
      muted: '70 8% 20%',
      mutedForeground: '55 8% 45%', // comment
      accent: '81 70% 55%', // green
      accentForeground: '70 8% 15%',
      destructive: '0 100% 67%', // red
      destructiveForeground: '70 8% 15%',
      border: '70 8% 25%',
      input: '70 8% 25%',
      ring: '326 100% 74%'
    }
  },

  // Synthwave '84
  {
    id: 'synthwave',
    name: "Synthwave '84",
    description: 'Retro-futuristic neon theme',
    isDark: true,
    colors: {
      background: '262 32% 15%', // Deep purple
      foreground: '300 100% 95%', // Light pink
      card: '262 32% 12%',
      cardForeground: '300 100% 95%',
      popover: '262 32% 12%',
      popoverForeground: '300 100% 95%',
      primary: '320 100% 60%', // Hot pink
      primaryForeground: '262 32% 15%',
      secondary: '262 32% 22%',
      secondaryForeground: '300 100% 95%',
      muted: '262 32% 22%',
      mutedForeground: '280 50% 65%',
      accent: '180 100% 50%', // Cyan
      accentForeground: '262 32% 15%',
      destructive: '0 100% 60%',
      destructiveForeground: '262 32% 15%',
      border: '262 32% 28%',
      input: '262 32% 28%',
      ring: '320 100% 60%'
    }
  }
]

export const themeIds = themes.map((t) => t.id)
export type ThemeId = (typeof themeIds)[number]

export function getTheme(id: string): ThemeDefinition | undefined {
  return themes.find((t) => t.id === id)
}

export function getDefaultTheme(): ThemeDefinition {
  return themes.find((t) => t.id === 'dark')!
}
