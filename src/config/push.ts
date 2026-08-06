const vapidPublicKey =
  import.meta.env
    .VITE_VAPID_PUBLIC_KEY
    ?.trim() ||
  null;

export const pushConfig = {
  vapidPublicKey,
} as const;