import { SStorage } from "../schemas/SStorage";
import { status } from "elysia";
import { and, eq, type SQL } from "drizzle-orm";
import StorageManager from "@/infrastructure/storage/StorageManager";
import { IApp, IUserApp, ServiceBase } from "bedest-core";
import { EStorageStatus } from "../enums/EStorageStatus";
import { storageExtensionFor } from "../utils/UtilStorage";

class ServiceStorage extends ServiceBase<typeof SStorage, string> {
  constructor() {
    super(SStorage);
  }

  /** Only READY files are ever listed or served. */
  protected override getFilters(id?: string): SQL[] {
    return [...super.getFilters(id), eq(SStorage.status, EStorageStatus.READY)];
  }

  /**
   * Row first (PENDING), then the object, then READY [BUG-03]: a failed
   * object write removes the row, a failed row insert never writes an
   * object. The key extension comes from the MIME type, not the file name.
   */
  async upload(c: IUserApp, file: File) {
    const key = `${crypto.randomUUID()}.${storageExtensionFor(file.type)}`;

    const res = await super.create(c, {
      name: file.name,
      key: key,
      mimeType: file.type,
      size: file.size,
      status: EStorageStatus.PENDING,
    });

    try {
      await StorageManager.upload(key, await file.arrayBuffer(), file.type);
    } catch (err) {
      // The row never became READY and its object never existed.
      await c.db
        .delete(SStorage)
        .where(
          and(eq(SStorage.id, res.id), eq(SStorage.status, EStorageStatus.PENDING)),
        );
      throw err;
    }

    await c.db
      .update(SStorage)
      .set({ status: EStorageStatus.READY })
      .where(eq(SStorage.id, res.id));

    return { id: res.id, key: key };
  }

  async get(c: IApp, id: string) {
    const fileRecord = await super.getById(c, id, {
      key: SStorage.key,
      mimeType: SStorage.mimeType,
      name: SStorage.name,
    });

    if (!fileRecord) {
      throw status("Not Found");
    }

    const fileBlob = await StorageManager.download(fileRecord.key);

    if (!fileBlob) {
      throw status("Not Found");
    }

    return { fileBlob, metadata: fileRecord };
  }

  /** Soft delete only; the object is removed by the purge job [BUG-03]. */
  async remove(c: IUserApp, id: string) {
    return await super.remove(c, id);
  }
}

export default new ServiceStorage();
