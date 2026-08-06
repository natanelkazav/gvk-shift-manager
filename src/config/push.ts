const vapidPublicKey =
  import.meta.env
    .VITE_VAPID_PUBLIC_KEY;

if (!vapidPublicKey) {
  throw new Error(
    'Missing VITE_VAPID_PUBLIC_KEY. Add it to the .env.local file.',
  );
}

export const pushConfig = {
  vapidPublicKey,
} as const;