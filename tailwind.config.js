module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(0 0% 0%)",
        foreground: "hsl(0 0% 100%)",
        primary: {
          DEFAULT: "hsl(0 0% 0%)",
          foreground: "hsl(0 0% 100%)",
        },
        secondary: {
          DEFAULT: "hsl(0 0% 10%)",
          foreground: "hsl(0 0% 100%)",
        },
        tertiary: {
          DEFAULT: "hsl(0 0% 20%)",
          foreground: "hsl(0 0% 100%)",
        },
        neutral: {
          DEFAULT: "hsl(0 0% 96%)",
          foreground: "hsl(0 0% 4%)",
        },
        muted: {
          DEFAULT: "hsl(0 0% 10%)",
          foreground: "hsl(0 0% 70%)",
        },
        border: "hsl(0 0% 20%)",
        input: "hsl(0 0% 20%)",
        ring: "hsl(0 0% 100%)",
        success: "hsl(141 63% 47%)",
        warning: "hsl(38 92% 50%)",
        gray: {
          50: "hsl(0 0% 98%)",
          100: "hsl(0 0% 90%)",
          200: "hsl(0 0% 80%)",
          300: "hsl(0 0% 70%)",
          400: "hsl(0 0% 60%)",
          500: "hsl(0 0% 50%)",
          600: "hsl(0 0% 40%)",
          700: "hsl(0 0% 30%)",
          800: "hsl(0 0% 20%)",
          900: "hsl(0 0% 10%)",
        },
        "primary-cta": "hsl(0 0% 100%)",
        "primary-cta-foreground": "hsl(0 0% 0%)",
        "secondary-cta": "hsl(0 0% 10%)",
        "secondary-cta-foreground": "hsl(0 0% 100%)",
      },
      fontFamily: {
        sans: ['"Inter"', "sans-serif"],
        heading: ['"DM Serif Display"', "serif"],
        mono: ['"Space Mono"', "monospace"],
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      backgroundImage: {
        "gradient-1":
          "linear-gradient(135deg, hsl(0 0% 0%) 0%, hsl(0 0% 20%) 100%)",
        "gradient-2":
          "linear-gradient(180deg, hsl(0 0% 8%) 0%, hsl(0 0% 0%) 100%)",
        "button-border-gradient":
          "linear-gradient(90deg, hsl(0 0% 100%) 0%, hsl(0 0% 60%) 100%)",
      },
    },
  },
  plugins: [],
};
