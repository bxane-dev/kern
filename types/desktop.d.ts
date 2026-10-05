export {};

declare global {
  type KernDesktopSecret =
    | "GITHUB_TOKEN"
    | "VERCEL_TOKEN"
    | "RENDER_API_KEY"
    | "AI_GATEWAY_API_KEY"
    | "KERN_PASSWORD";

  type KernDesktopValue =
    | "GITHUB_OWNER"
    | "VERCEL_TEAM_ID"
    | "VERCEL_PROJECT_ID"
    | "RENDER_SERVICE_ID"
    | "KERN_AI_MODEL"
    | "KERN_MONITORS";

  type KernUpdateState = {
    supported: boolean;
    status: "idle" | "unsupported" | "checking" | "current" | "available" | "downloading" | "downloaded" | "error";
    currentVersion: string;
    availableVersion: string | null;
    progress: number | null;
    message: string;
  };

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
      getUpdateState: () => Promise<KernUpdateState>;
      checkForUpdates: () => Promise<KernUpdateState>;
      downloadUpdate: () => Promise<KernUpdateState>;
      installUpdate: () => Promise<{ ok: boolean }>;
      onUpdateStatus: (callback: (state: KernUpdateState) => void) => () => void;
    };
  }
}
