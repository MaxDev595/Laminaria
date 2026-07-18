import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { WorkerConfig } from "../config.js";
import { ServiceNotConfiguredError } from "../errors.js";

export interface StorageProvider {
  readonly configured: boolean;
  put(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<{ key: string; etag?: string }>;
}

class DisabledStorageProvider implements StorageProvider {
  readonly configured = false;

  put(): Promise<{ key: string }> {
    return Promise.reject(new ServiceNotConfiguredError("storage"));
  }
}

class S3StorageProvider implements StorageProvider {
  readonly configured = true;

  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async put(input: { key: string; body: Uint8Array; contentType: string }) {
    const result = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    return { key: input.key, ...(result.ETag ? { etag: result.ETag } : {}) };
  }
}

export function createStorageProvider(config: WorkerConfig): StorageProvider {
  if (!config.S3_ENDPOINT || !config.S3_BUCKET || !config.S3_ACCESS_KEY || !config.S3_SECRET_KEY) {
    return new DisabledStorageProvider();
  }
  const client = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
  });
  return new S3StorageProvider(client, config.S3_BUCKET);
}
