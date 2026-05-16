import type { StorybookConfig } from "@storybook/react-vite";
import path from "path";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  async viteFinal(config) {
    const { mergeConfig } = await import("vite");
    return mergeConfig(config, {
      resolve: {
        alias: {
          "@": path.resolve(__dirname, ".."),
          "next-intl": path.resolve(__dirname, "mocks/next-intl.ts"),
          "next/navigation": path.resolve(__dirname, "mocks/next-navigation.ts"),
        },
      },
    });
  },
};

export default config;
