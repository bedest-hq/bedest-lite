import { UtilHttp } from "@/common/utils/UtilHttp";
import EnvManager from "../env/EnvManager";
import { logger } from "../logger/logger";

import { IProvider, IStoredObject } from "./interfaces/IProvider";
import { ProviderLocal } from "./providers/ProviderLocal";
import { ProviderS3 } from "./providers/ProviderS3";

class StorageManager {
  private resolved: IProvider | null | undefined;

  /** Chosen from the environment on first use, never at import [QLT-01]. */
  private get activeProvider(): IProvider | null {
    if (this.resolved === undefined) {
      this.resolved = StorageManager.fromEnv();
    }
    return this.resolved;
  }

  private set activeProvider(provider: IProvider | null) {
    this.resolved = provider;
  }

  private static fromEnv(): IProvider | null {
    const env = EnvManager.get();

    if (
      env.S3_BUCKET &&
      env.S3_REGION &&
      env.S3_ACCESS_KEY &&
      env.S3_SECRET_KEY
    ) {
      logger.info("S3 Storage Provider enabled.");
      return new ProviderS3();
    }
    if (env.LOCAL_STORAGE_PATH) {
      logger.info("Local Storage Provider enabled.");
      return new ProviderLocal(env.LOCAL_STORAGE_PATH);
    }
    logger.warn("No storage providers configured! File uploads will fail.");
    return null;
  }

  /** Readiness probe: throws when the configured provider is unusable. */
  async healthCheck(): Promise<"ok" | "disabled"> {
    if (!this.activeProvider) {
      return "disabled";
    }
    await this.activeProvider.healthCheck();
    return "ok";
  }

  async upload(
    key: string,
    body: Buffer | ArrayBuffer,
    contentType: string,
  ): Promise<void> {
    if (!this.activeProvider) {
      throw UtilHttp.fail(503);
    }
    await this.activeProvider.upload(key, body, contentType);
  }

  async delete(key: string): Promise<void> {
    if (!this.activeProvider) {
      return;
    }
    await this.activeProvider.delete(key);
  }

  async download(key: string): Promise<IStoredObject | null> {
    if (!this.activeProvider) {
      throw UtilHttp.fail(503);
    }
    return await this.activeProvider.download(key);
  }
}

export default new StorageManager();
