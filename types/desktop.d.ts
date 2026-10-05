export {};

declare global {
  type KernDesktopSecret =
    | "GITHUB_TOKEN"
    | "VERCEL_TOKEN"
    | "RENDER_API_KEY"
    | "KERN_PASSWORD";

  type KernDesktopValue =
    | "GITHUB_OWNER"
    | "VERCEL_TEAM_ID"
    | "VERCEL_PROJECT_ID"
    | "RENDER_SERVICE_ID"
    | "KERN_MONITORS";

  type KernDesktopConfig = {
    values: Record<KernDesktopValue, string>;
    hasSecrets: Record<KernDesktopSecret, boolean>;
    secureStorage: boolean;
    storageBackend: string;
    configPath: string;
  };

  interface Window {
    kernDesktop?: {
      isDesktop: true;
      getConfig: () => Promise<KernDesktopConfig>;
      saveConfig: (config: {
        values: Partial<Record<KernDesktopValue, string>>;
        secrets: Partial<Record<KernDesktopSecret, string>>;
        clearSecrets?: KernDesktopSecret[];
      }) => Promise<KernDesktopConfig>;
      restartServer: () => Promise<{ ok: boolean }>;
      openConfigLocation: () => Promise<{ ok: boolean }>;
      notify: (notification: { title: string; body: string }) => Promise<{ ok: boolean }>;
    };
  }
}
