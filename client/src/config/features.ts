export const features = {
  onlineMenu: import.meta.env.VITE_ENABLE_ONLINE_MENU === "true",
} as const;

export const featureMetadata = {
  customCursor: {
    classification: "meme",
    required: false,
    description: "Optional cosmetic feature made for fun; not required by the application.",
  },
} as const;
