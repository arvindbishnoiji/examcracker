import type { ThemeConfig, ThemePresetId } from '@/types';

/**
 * Theme engine
 * ------------
 * Exam Cracker's Tailwind palette is driven by CSS custom properties so the
 * admin can publish a new brand colour, radius, density or dark theme without
 * a rebuild. Values are stored as space-separated RGB triplets so Tailwind's
 * `rgb(var(--x) / <alpha-value>)` utilities keep working.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_RE.test(value.trim());
}

export function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!HEX_RE.test(trimmed)) return fallback;
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

export function parseHex(value: string): Rgb {
  const hex = normalizeHex(value, '#000000').slice(1);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('')}`;
}

export function mixColors(a: string, b: string, weightOfB: number): string {
  const first = parseHex(a);
  const second = parseHex(b);
  const w = Math.max(0, Math.min(1, weightOfB));
  return toHex({
    r: first.r + (second.r - first.r) * w,
    g: first.g + (second.g - first.g) * w,
    b: first.b + (second.b - first.b) * w,
  });
}

export function rgbTriplet(value: string): string {
  const { r, g, b } = parseHex(value);
  return `${r} ${g} ${b}`;
}

export function relativeLuminance(value: string): number {
  const { r, g, b } = parseHex(value);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function readableOn(background: string): string {
  return relativeLuminance(background) > 0.52 ? '#0f172a' : '#ffffff';
}

export const FONT_STACKS: Record<
  ThemeConfig['fontPreset'],
  { body: string; heading: string; label: string }
> = {
  modern: {
    body: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    heading: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    label: 'Inter',
  },
  minimal: {
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    label: 'System',
  },
  academic: {
    body: 'Inter, ui-sans-serif, system-ui, sans-serif',
    heading: '"Source Serif 4", "Iowan Old Style", Georgia, "Times New Roman", serif',
    label: 'Source Serif 4',
  },
  display: {
    body: 'Manrope, Inter, ui-sans-serif, system-ui, sans-serif',
    heading: 'Manrope, Inter, ui-sans-serif, system-ui, sans-serif',
    label: 'Manrope',
  },
};

const RADIUS_FOR_SHAPE: Record<ThemeConfig['buttonShape'], (radius: number) => string> = {
  rounded: (radius) => `${Math.max(6, Math.round(radius * 0.85))}px`,
  pill: () => '999px',
  square: () => '4px',
};

const SHADOW_MAP: Record<ThemeConfig['shadow'], string> = {
  none: 'none',
  soft: '0 1px 2px rgba(15,23,42,0.05), 0 10px 30px rgba(15,23,42,0.07)',
  strong: '0 2px 6px rgba(15,23,42,0.10), 0 22px 55px rgba(15,23,42,0.16)',
};

const WIDTH_MAP: Record<ThemeConfig['pageWidth'], string> = {
  narrow: '980px',
  standard: '1200px',
  wide: '1420px',
};

const DENSITY_MAP: Record<ThemeConfig['density'], { pad: string; gap: string }> = {
  compact: { pad: '14px', gap: '14px' },
  comfortable: { pad: '20px', gap: '20px' },
  spacious: { pad: '28px', gap: '28px' },
};

const ANIMATION_MAP: Record<ThemeConfig['animation'], string> = {
  none: '0',
  subtle: '0.85',
  expressive: '1.2',
};

export interface ResolvedTheme {
  vars: Record<string, string>;
  resolvedMode: 'light' | 'dark';
}

/**
 * Builds every CSS custom property used by the storefront. The same function is
 * used for the live admin preview and the real document root, so previews are
 * truthful rather than decorative.
 */
export function buildThemeVars(
  theme: ThemeConfig,
  prefersDark = false
): ResolvedTheme {
  const resolvedMode: 'light' | 'dark' =
    theme.mode === 'dark' || (theme.mode === 'system' && prefersDark) ? 'dark' : 'light';
  const dark = resolvedMode === 'dark';

  const bg = normalizeHex(theme.backgroundColor, dark ? '#0b1120' : '#f7f8fc');
  const surface = normalizeHex(theme.surfaceColor, dark ? '#111a2e' : '#ffffff');
  const text = normalizeHex(theme.textColor, dark ? '#e8eefc' : '#0f172a');
  const primary = normalizeHex(theme.primaryColor, '#6d28d9');
  const secondary = normalizeHex(theme.secondaryColor, '#4c1d95');
  const accent = normalizeHex(theme.accentColor, '#f59e0b');

  const brand: Record<string, string> = dark
    ? {
        50: mixColors(primary, bg, 0.9),
        100: mixColors(primary, bg, 0.82),
        200: mixColors(primary, bg, 0.65),
        300: mixColors(primary, bg, 0.42),
        400: mixColors(primary, '#ffffff', 0.2),
        500: mixColors(primary, '#ffffff', 0.08),
        600: primary,
        700: mixColors(primary, '#ffffff', 0.14),
        800: mixColors(primary, '#ffffff', 0.24),
        900: mixColors(primary, '#ffffff', 0.34),
      }
    : {
        50: mixColors(primary, '#ffffff', 0.93),
        100: mixColors(primary, '#ffffff', 0.86),
        200: mixColors(primary, '#ffffff', 0.7),
        300: mixColors(primary, '#ffffff', 0.48),
        400: mixColors(primary, '#ffffff', 0.22),
        500: primary,
        600: primary,
        700: mixColors(primary, '#000000', 0.16),
        800: mixColors(primary, '#000000', 0.3),
        900: mixColors(primary, '#000000', 0.44),
      };

  const ink: Record<string, string> = {
    50: mixColors(bg, surface, 0.55),
    100: mixColors(surface, text, dark ? 0.12 : 0.08),
    200: mixColors(surface, text, dark ? 0.2 : 0.15),
    300: mixColors(surface, text, dark ? 0.32 : 0.26),
    400: mixColors(text, bg, 0.62),
    500: mixColors(text, bg, 0.46),
    600: mixColors(text, bg, 0.3),
    700: mixColors(text, surface, 0.2),
    800: mixColors(text, surface, 0.09),
    900: text,
  };

  const onBrand = readableOn(primary);
  const headerBg =
    theme.headerStyle === 'dark'
      ? text
      : theme.headerStyle === 'transparent'
      ? 'transparent'
      : theme.headerStyle === 'gradient'
      ? `linear-gradient(120deg, ${brand[700]}, ${brand[900]})`
      : 'color-mix(in srgb, var(--ec-surface) 88%, transparent)';
  const headerText =
    theme.headerStyle === 'dark'
      ? surface
      : theme.headerStyle === 'gradient'
      ? onBrand
      : text;

  const vars: Record<string, string> = {
    '--ec-bg': bg,
    '--ec-surface': surface,
    '--ec-surface-2': mixColors(surface, bg, 0.5),
    '--ec-text': text,
    '--ec-muted': ink[500],
    '--ec-border': ink[100],
    '--ec-brand': primary,
    '--ec-secondary': secondary,
    '--ec-accent': accent,
    '--ec-on-brand': onBrand,
    '--ec-radius': `${theme.radius}px`,
    '--ec-radius-sm': `${Math.max(4, theme.radius - 8)}px`,
    '--ec-radius-lg': `${theme.radius + 8}px`,
    '--ec-button-radius': RADIUS_FOR_SHAPE[theme.buttonShape](theme.radius),
    '--ec-card-shadow': SHADOW_MAP[theme.shadow],
    '--ec-font-body': FONT_STACKS[theme.fontPreset].body,
    '--ec-font-heading': FONT_STACKS[theme.fontPreset].heading,
    '--ec-heading-weight':
      theme.headingStyle === 'editorial' ? '600' : theme.headingStyle === 'tight' ? '800' : '700',
    '--ec-heading-tracking':
      theme.headingStyle === 'tight' ? '-0.03em' : theme.headingStyle === 'editorial' ? '-0.01em' : '0',
    '--ec-max-width': WIDTH_MAP[theme.pageWidth],
    '--ec-page-pad': DENSITY_MAP[theme.density].pad,
    '--ec-section-gap': DENSITY_MAP[theme.density].gap,
    '--ec-anim': ANIMATION_MAP[theme.animation],
    '--ec-header-bg': headerBg,
    '--ec-header-text': headerText,
    '--ec-header-border': theme.headerStyle === 'dark' || theme.headerStyle === 'gradient' ? 'transparent' : ink[100],
    '--ec-nav-bg': dark ? 'color-mix(in srgb, var(--ec-surface) 92%, transparent)' : 'color-mix(in srgb, var(--ec-surface) 96%, transparent)',
  };

  for (const [shade, color] of Object.entries(brand)) {
    vars[`--ec-brand-${shade}`] = rgbTriplet(color);
  }
  for (const [shade, color] of Object.entries(ink)) {
    vars[`--ec-ink-${shade}`] = rgbTriplet(color);
  }

  return { vars, resolvedMode };
}

export function applyThemeToElement(
  element: HTMLElement,
  theme: ThemeConfig,
  prefersDark = false
): 'light' | 'dark' {
  const { vars, resolvedMode } = buildThemeVars(theme, prefersDark);
  for (const [key, value] of Object.entries(vars)) {
    element.style.setProperty(key, value);
  }
  element.dataset.ecTheme = resolvedMode;
  element.dataset.ecCard = theme.cardStyle;
  element.dataset.ecAnim = theme.animation;
  element.style.colorScheme = resolvedMode;
  return resolvedMode;
}

export type PreviewStyle = React.CSSProperties & Record<`--${string}`, string>;

export function buildPreviewStyle(theme: ThemeConfig, prefersDark = false): PreviewStyle {
  const { vars } = buildThemeVars(theme, prefersDark);
  return { ...vars } as PreviewStyle;
}

const FONT_LINK_ID = 'ec-theme-fonts';

export function ensureThemeFonts(): void {
  if (typeof document === 'undefined' || document.getElementById(FONT_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&display=swap';
  document.head.appendChild(link);
}

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  description: string;
  patch: Partial<ThemeConfig>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'modern',
    label: 'Modern',
    description: 'Bright blue, soft elevation and confident typography.',
    patch: {
      preset: 'modern',
      primaryColor: '#2563eb',
      secondaryColor: '#0f172a',
      accentColor: '#f59e0b',
      backgroundColor: '#f7f8fc',
      surfaceColor: '#ffffff',
      textColor: '#0f172a',
      mode: 'light',
      fontPreset: 'modern',
      headingStyle: 'tight',
      radius: 18,
      buttonShape: 'rounded',
      cardStyle: 'elevated',
      shadow: 'soft',
      pageWidth: 'standard',
      density: 'comfortable',
      animation: 'subtle',
      headerStyle: 'light',
    },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Editorial spacing, crisp outlines and a quiet palette.',
    patch: {
      preset: 'minimal',
      primaryColor: '#111827',
      secondaryColor: '#4b5563',
      accentColor: '#0ea5e9',
      backgroundColor: '#fbfbfc',
      surfaceColor: '#ffffff',
      textColor: '#111827',
      mode: 'light',
      fontPreset: 'minimal',
      headingStyle: 'balanced',
      radius: 10,
      buttonShape: 'square',
      cardStyle: 'outlined',
      shadow: 'none',
      pageWidth: 'narrow',
      density: 'comfortable',
      animation: 'none',
      headerStyle: 'light',
    },
  },
  {
    id: 'academic',
    label: 'Academic',
    description: 'Warm paper tones and serif headings for a study-first feel.',
    patch: {
      preset: 'academic',
      primaryColor: '#0f766e',
      secondaryColor: '#115e59',
      accentColor: '#b45309',
      backgroundColor: '#faf7f0',
      surfaceColor: '#fffdf8',
      textColor: '#1c1917',
      mode: 'light',
      fontPreset: 'academic',
      headingStyle: 'editorial',
      radius: 12,
      buttonShape: 'rounded',
      cardStyle: 'outlined',
      shadow: 'soft',
      pageWidth: 'standard',
      density: 'spacious',
      animation: 'subtle',
      headerStyle: 'light',
    },
  },
  {
    id: 'dark-premium',
    label: 'Dark Premium',
    description: 'Midnight surfaces, amber highlights and glass cards.',
    patch: {
      preset: 'dark-premium',
      primaryColor: '#f59e0b',
      secondaryColor: '#38bdf8',
      accentColor: '#fb7185',
      backgroundColor: '#080d18',
      surfaceColor: '#111a2e',
      textColor: '#e8eefc',
      mode: 'dark',
      fontPreset: 'display',
      headingStyle: 'tight',
      radius: 20,
      buttonShape: 'pill',
      cardStyle: 'glass',
      shadow: 'strong',
      pageWidth: 'wide',
      density: 'comfortable',
      animation: 'subtle',
      headerStyle: 'dark',
    },
  },
  {
    id: 'colorful-learning',
    label: 'Colorful Learning',
    description: 'Playful violet, generous radii and friendly energy.',
    patch: {
      preset: 'colorful-learning',
      primaryColor: '#7c3aed',
      secondaryColor: '#db2777',
      accentColor: '#06b6d4',
      backgroundColor: '#fdf8ff',
      surfaceColor: '#ffffff',
      textColor: '#1f1235',
      mode: 'light',
      fontPreset: 'display',
      headingStyle: 'balanced',
      radius: 24,
      buttonShape: 'pill',
      cardStyle: 'elevated',
      shadow: 'soft',
      pageWidth: 'wide',
      density: 'spacious',
      animation: 'expressive',
      headerStyle: 'light',
    },
  },
];

export function applyThemePreset(theme: ThemeConfig, presetId: ThemePresetId): ThemeConfig {
  const preset = THEME_PRESETS.find((item) => item.id === presetId) || THEME_PRESETS[0];
  return { ...theme, ...preset.patch, preset: preset.id };
}

export function themeAccentGradient(theme: ThemeConfig): string {
  return `linear-gradient(120deg, ${theme.primaryColor}, ${theme.secondaryColor})`;
}
