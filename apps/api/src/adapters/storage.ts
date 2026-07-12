import type { Readable } from "node:stream";
import { ServiceNotConfiguredError } from "../errors.js";

export interface StorageAdapter {
  readonly configured: boolean;
  put(input: {
    key: string;
    body: Readable | Uint8Array;
    contentType: string;
    contentLength: number;
  }): Promise<{ key: string; etag: string }>;
  delete(key: string): Promise<void>;
  createSignedDownloadUrl(key: string, ttlSeconds: number): Promise<string>;
}

export class NotConfiguredStorageAdapter implements StorageAdapter {
  public readonly configured = false;

  public async put(): Promise<never> {
    throw new ServiceNotConfiguredError("Object storage");
  }

  public async delete(): Promise<never> {
    throw new ServiceNotConfiguredError("Object storage");
  }

  public async createSignedDownloadUrl(): Promise<never> {
    throw new ServiceNotConfiguredError("Object storage");
  }
}
