import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config";

/** Object storage abstraction: local disk in development, any S3-compatible bucket in production. */
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  /** URL the browser should use to display the object. */
  publicUrl(key: string): string;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const mimeFromKey = (key: string) => MIME_BY_EXT[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

/** Keys look like `originals/ab12cd34ef.png`; only this shape is accepted from URLs. */
export const isSafeKey = (key: string) => /^(originals|thumbs)\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(key);

/** Meme id embedded in a storage key (`thumbs/<id>.webp` → `<id>`). */
export const idFromKey = (key: string) => key.split("/").pop()!.replace(/\.[a-z]+$/, "");

class LocalStorage implements StorageDriver {
  private root = path.join(config.dataDir, "uploads");

  private resolve(key: string) {
    if (!isSafeKey(key)) throw new Error(`Invalid storage key: ${key}`);
    return path.join(this.root, key);
  }

  async put(key: string, body: Buffer) {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
  }

  async get(key: string) {
    try {
      return await fs.readFile(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async exists(key: string) {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }

  publicUrl(key: string) {
    return `/files/${key}`;
  }
}

class S3Storage implements StorageDriver {
  private clientPromise = import("@aws-sdk/client-s3").then(
    (sdk) =>
      [
        sdk,
        new sdk.S3Client({
          region: config.storage.region,
          endpoint: config.storage.endpoint,
          forcePathStyle: config.storage.forcePathStyle,
          credentials: { accessKeyId: config.storage.accessKeyId, secretAccessKey: config.storage.secretAccessKey },
        }),
      ] as const,
  );

  async put(key: string, body: Buffer, contentType: string) {
    const [sdk, client] = await this.clientPromise;
    await client.send(
      new sdk.PutObjectCommand({
        Bucket: config.storage.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  async get(key: string) {
    const [sdk, client] = await this.clientPromise;
    try {
      const res = await client.send(new sdk.GetObjectCommand({ Bucket: config.storage.bucket, Key: key }));
      return res.Body ? Buffer.from(await res.Body.transformToByteArray()) : null;
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  }

  async exists(key: string) {
    const [sdk, client] = await this.clientPromise;
    try {
      await client.send(new sdk.HeadObjectCommand({ Bucket: config.storage.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string) {
    const [sdk, client] = await this.clientPromise;
    await client.send(new sdk.DeleteObjectCommand({ Bucket: config.storage.bucket, Key: key }));
  }

  publicUrl(key: string) {
    // Without a public bucket URL, images are proxied through /files, which also lets
    // takedowns hide an image instantly (the route checks the meme's status).
    return config.storage.publicUrl ? `${config.storage.publicUrl}/${key}` : `/files/${key}`;
  }
}

const globalForStorage = globalThis as unknown as { __memedeskStorage?: StorageDriver };

export function storage(): StorageDriver {
  if (!globalForStorage.__memedeskStorage) {
    if (config.storage.driver === "s3") {
      if (!config.storage.bucket) throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET");
      globalForStorage.__memedeskStorage = new S3Storage();
    } else {
      globalForStorage.__memedeskStorage = new LocalStorage();
    }
  }
  return globalForStorage.__memedeskStorage;
}
