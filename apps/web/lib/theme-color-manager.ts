/**
 * Theme Color Manager
 * Manages dynamic theme colors using the color generator
 */

import { generateColorPalette, generateCssVariables, hexToRgb, type ColorPalette } from './color-generator';
import { ThemeConfig, ThemeKey } from '@/components/context/LayoutThemeContext';

// Extended theme configurations with full color palettes
export const EXTENDED_THEME_CONFIGS: Record<ThemeKey, ThemeConfig> = {
  everworks: {
    primary: "#3d70ef",
    secondary: "#00c853",
    accent: "#0056b3",
    background: "#ffffff",
    surface: "#f8f9fa",
    text: "#1a1a1a",
    textSecondary: "#6c757d",
  },
  corporate: {
    primary: "#00c853",
    secondary: "#e74c3c",
    accent: "#34495e",
    background: "#ffffff",
    surface: "#ecf0f1",
    text: "#2c3e50",
    textSecondary: "#7f8c8d",
  },
  material: {
    primary: "#673ab7",
    secondary: "#ff9800",
    accent: "#9c27b0",
    background: "#fafafa",
    surface: "#ffffff",
    text: "#212121",
    textSecondary: "#757575",
  },
  funny: {
    primary: "#ff4081",
    secondary: "#ffeb3b",
    accent: "#e91e63",
    background: "#fff8e1",
    surface: "#ffffff",
    text: "#3e2723",
    textSecondary: "#8d6e63",
  },
  // SoiGuru moodboard (spec 055): sea primary, sun secondary, sea-deep accent, sand ground
  soiguru: {
    primary: "#0a6b73",
    secondary: "#f2a33a",
    accent: "#064a50",
    background: "#f4f5f2",
    surface: "#ffffff",
    text: "#14201f",
    textSecondary: "#5a6665",
  }
};

/**
 * Hand-tuned palettes for presets whose base colours are too dark (or too
 * light) for `generateColorPalette`'s fixed lightness steps. The generator
 * turns sea #0a6b73 into a 50-shade of #87d5db and 700–950 shades of pure
 * black, which breaks the template's `bg-theme-primary-50` tints and
 * `hover:bg-theme-primary-700` states. A preset listed here uses these shades
 * instead; every other preset keeps the generated palette.
 */
export const THEME_PALETTE_OVERRIDES: Partial<
  Record<ThemeKey, Partial<Record<"primary" | "secondary" | "accent", ColorPalette>>>
> = {
  soiguru: {
    primary: {
      50: "#f0f8f8",
      100: "#e2f1f2",
      200: "#c2e2e4",
      300: "#8fcbd0",
      400: "#4fa9b0",
      500: "#0a6b73",
      600: "#085d64",
      700: "#064a50",
      800: "#053c41",
      900: "#042f33",
      950: "#021d20",
    },
    secondary: {
      50: "#fef8ee",
      100: "#fdf0dc",
      200: "#fbdeb3",
      300: "#f8c983",
      400: "#f5b55a",
      500: "#f2a33a",
      600: "#d9871c",
      700: "#b46a12",
      800: "#8f5312",
      900: "#744413",
      950: "#432306",
    },
    accent: {
      50: "#eef6f6",
      100: "#d5ebec",
      200: "#aed7da",
      300: "#7bbcc1",
      400: "#3f949b",
      500: "#064a50",
      600: "#053f44",
      700: "#043438",
      800: "#03292c",
      900: "#021f21",
      950: "#011214",
    },
  },
};

/**
 * Applies a fixed palette (from {@link THEME_PALETTE_OVERRIDES}) the same way
 * {@link applyColorPalette} applies a generated one.
 */
function applyFixedPalette(colorName: string, palette: ColorPalette) {
  const root = document.documentElement;
  root.style.setProperty(`--${colorName}`, palette[500]);
  const rgb = hexToRgb(palette[500]);
  root.style.setProperty(`--${colorName}-rgb`, `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  Object.entries(palette).forEach(([shade, color]) => {
    root.style.setProperty(`--${colorName}-${shade}`, color);
  });
}

/**
 * Applies a full color palette to the document
 * @param colorName - Name of the color variable (e.g., "theme-primary")
 * @param baseColor - Base color in hex format
 */
export function applyColorPalette(colorName: string, baseColor: string) {
  const palette = generateColorPalette(baseColor);
  const root = document.documentElement;

  // Apply the base color
  root.style.setProperty(`--${colorName}`, palette[500]);
  
  // Convert base color to RGB for opacity support
  const rgb = hexToRgb(palette[500]);
  root.style.setProperty(`--${colorName}-rgb`, `${rgb.r}, ${rgb.g}, ${rgb.b}`);

  // Apply all shades
  Object.entries(palette).forEach(([shade, color]) => {
    root.style.setProperty(`--${colorName}-${shade}`, color);
  });
}

// // Helper function to convert hex to RGB
// function hexToRgb(hex: string): { r: number; g: number; b: number } {
//   const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
//   return result
//     ? {
//         r: parseInt(result[1], 16),
//         g: parseInt(result[2], 16),
//         b: parseInt(result[3], 16),
//       }
//     : { r: 0, g: 0, b: 0 };
// }

/**
 * Applies all theme colors with their full palettes
 * @param themeKey - The theme key to apply
 */
export function applyThemeWithPalettes(themeKey: ThemeKey) {
  // Get theme configuration or fallback to default
  const themeToApply = EXTENDED_THEME_CONFIGS[themeKey] || EXTENDED_THEME_CONFIGS.everworks;
  
  if (!themeToApply) {
    console.error('Could not find theme configuration to apply');
    return;
  }

  try {
    const fixed = THEME_PALETTE_OVERRIDES[themeKey];

    // Apply primary color palette
    if (fixed?.primary) applyFixedPalette('theme-primary', fixed.primary);
    else applyColorPalette('theme-primary', themeToApply.primary);

    // Apply secondary color palette
    if (fixed?.secondary) applyFixedPalette('theme-secondary', fixed.secondary);
    else applyColorPalette('theme-secondary', themeToApply.secondary);

    // Apply accent color palette
    if (fixed?.accent) applyFixedPalette('theme-accent', fixed.accent);
    else applyColorPalette('theme-accent', themeToApply.accent);

    // Apply other theme colors (without palettes)
    const root = document.documentElement;
    // Lets stylesheets scope preset-specific rules (e.g. the SoiGuru look in
    // app/soiguru-theme.css) to the preset that is actually active.
    root.dataset.themePreset = EXTENDED_THEME_CONFIGS[themeKey] ? themeKey : 'everworks';
    root.style.setProperty('--theme-background', themeToApply.background);
    root.style.setProperty('--theme-surface', themeToApply.surface);
    root.style.setProperty('--theme-text', themeToApply.text);
    root.style.setProperty('--theme-text-secondary', themeToApply.textSecondary);
  } catch (error) {
    console.error('Error applying theme colors:', error);
    // Try to apply default theme if the requested theme failed
    if (themeKey !== 'everworks') {
      console.warn('Falling back to default theme');
      applyThemeWithPalettes('everworks');
    }
  }
}

/**
 * Generates CSS for all theme palettes
 * @param themeKey - The theme key
 * @returns CSS string with all color variables
 */
export function generateThemeCss(themeKey: ThemeKey): string {
  const theme = EXTENDED_THEME_CONFIGS[themeKey];
  const cssVariables: string[] = [];

  // Generate palettes for primary, secondary, and accent
  const fixed = THEME_PALETTE_OVERRIDES[themeKey];
  const primaryPalette = fixed?.primary ?? generateColorPalette(theme.primary);
  const secondaryPalette = fixed?.secondary ?? generateColorPalette(theme.secondary);
  const accentPalette = fixed?.accent ?? generateColorPalette(theme.accent);

  // Add CSS variables
  cssVariables.push(generateCssVariables('theme-primary', primaryPalette));
  cssVariables.push(generateCssVariables('theme-secondary', secondaryPalette));
  cssVariables.push(generateCssVariables('theme-accent', accentPalette));

  // Add other theme variables
  cssVariables.push(`--theme-background: ${theme.background};`);
  cssVariables.push(`--theme-surface: ${theme.surface};`);
  cssVariables.push(`--theme-text: ${theme.text};`);
  cssVariables.push(`--theme-text-secondary: ${theme.textSecondary};`);

  return cssVariables.join('\n');
}

/**
 * Custom hook to apply theme with palettes
 */
export function useThemeWithPalettes(themeKey: ThemeKey) {
  if (typeof window !== 'undefined') {
    applyThemeWithPalettes(themeKey);
  }
}

/**
 * Example: Apply custom colors dynamically
 */
export function applyCustomTheme(colors: {
  primary: string;
  secondary: string;
  accent: string;
}) {
  applyColorPalette('theme-primary', colors.primary);
  applyColorPalette('theme-secondary', colors.secondary);
  applyColorPalette('theme-accent', colors.accent);
}

/**
 * Example: Generate a preview of theme colors
 */
export function previewThemeColors(baseColor: string) {
  const palette = generateColorPalette(baseColor);
  
  Object.entries(palette).forEach(([shade, color]) => {
    console.log(`%c ${shade}: ${color}`, `background: ${color}; color: ${parseInt(shade) >= 500 ? 'white' : 'black'}; padding: 2px 8px;`);
  });
} 