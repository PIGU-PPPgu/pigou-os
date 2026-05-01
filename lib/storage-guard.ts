export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageConfigurationError';
  }
}

export function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.NETLIFY);
}

export function assertDurableLocalWrites() {
  if (!isServerlessRuntime()) return;
  if (process.env.PIGOU_ALLOW_EPHEMERAL_WRITES === 'true') return;

  throw new StorageConfigurationError(
    'Pigou OS is running on a serverless platform. Local JSON writes are not durable there. Configure a persistent storage backend before enabling capture/delete, or set PIGOU_ALLOW_EPHEMERAL_WRITES=true only for temporary testing.'
  );
}
