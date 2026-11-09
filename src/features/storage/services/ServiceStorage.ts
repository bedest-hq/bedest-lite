import { UtilHttp } from "@/common/utils/UtilHttp";
import { SStorage } from "../schemas/SStorage";

import { and, eq, lt, type SQL } from "drizzle-orm";
import { logger } from "@/infrastructure/logger/logger";
import StorageManager from "@/infrastructure/storage/StorageManager";
import { IApp, IUserApp, ServiceBase } from "bedest-core";
import { EUserRole } from "@f/user/enums/EUserRole";
import { SUser } from "@f/user/schemas/SUser";
import { SOrganization } from "@f/organization/schemas/SOrganization";
import { EStorageStatus } from "../enums/EStorageStatus";
import { STORAGE_NAME_MAX } from "../validations/VStorageInput";
import { storageExtensionFor } from "../utils/UtilStorage";

class ServiceStorage extends ServiceBase<typeof SStorage, string> {
  constructor() {
    super(SStorage);
  }

  /** Only READY files are ever listed or served. */
  protected override getFilters(c: IApp, id?: string): SQL[] {
    return [
      ...super.getFilters(c, id),
      eq(SStorage.status, EStorageStatus.READY),
    ];
  }

  /**
   * Row first (PENDING), then the object, then READY [BUG-03]: a failed
   * object write removes the row, a failed row insert never writes an
   * object. The key extension comes from the MIME type, not the file name.
   */
  async upload(c: IUserApp, file: File) {
    // storage_files.name is varchar(255): refuse before writing anything [QLT-11].
    if (file.name.length > STORAGE_NAME_MAX) {
      throw UtilHttp.fail(
        400,
        `File name is longer than ${STORAGE_NAME_MAX} characters`,
      );
    }
    const key = `${crypto.randomUUID()}.${storageExtensionFor(file.type)}`;

    const res = await super.create(c, {
      name: file.name,
      key: key,
      mimeType: file.type,
      size: file.size,
      status: EStorageStatus.PENDING,
      uploadedBy: c.session.userId,
    });

    try {
      await StorageManager.upload(key, await file.arrayBuffer(), file.type);
    } catch (err) {
      // The row never became READY and its object never existed.
      await c.db
        .delete(SStorage)
        .where(
          and(
            eq(SStorage.id, res.id),
            eq(SStorage.status, EStorageStatus.PENDING),
          ),
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

    // Streamed from the provider; a missing object is a 404 [BUG-18].
    const object = await StorageManager.download(fileRecord.key);
    if (!object) {
      throw UtilHttp.fail(404, "File content not found");
    }

    return { object, metadata: fileRecord };
  }

  /** Soft delete only; the object is removed by the purge job [BUG-03]. */
  /**
   * Only the uploader or an ADMIN/SYSTEM user may delete a file, and never
   * while it is used as an avatar or the organization logo [SEC-26]. Files
   * from before SEC-26 have no uploader: only ADMIN/SYSTEM can delete those.
   */
  async remove(c: IUserApp, id: string) {
    const file = await super.getById(c, id, {
      uploadedBy: SStorage.uploadedBy,
    });

    const privileged =
      c.session.isSuperUser || c.session.role === EUserRole.ADMIN;
    if (!privileged && file.uploadedBy !== c.session.userId) {
      throw UtilHttp.fail(
        403,
        "Only the uploader or an admin can delete this file",
      );
    }

    if (await this.isReferenced(c, id)) {
      throw UtilHttp.fail(409, "File is in use");
    }

    // Soft delete only; the object is removed by the purge job [BUG-03].
    return await super.remove(c, id);
  }

  /** Whether an active user (avatar) or organization (logo) points at it. */
  private async isReferenced(
    c: IApp,
    id: string,
    includeDeleted = false,
  ): Promise<boolean> {
    // Soft-deleted rows still hold their foreign keys (purge must skip them).
    const [avatar] = await c.db
      .select({ id: SUser.id })
      .from(SUser)
      .where(
        and(
          eq(SUser.avatarId, id),
          includeDeleted ? undefined : eq(SUser.isDeleted, false),
        ),
      )
      .limit(1);
    if (avatar) {
      return true;
    }
    const [logo] = await c.db
      .select({ id: SOrganization.id })
      .from(SOrganization)
      .where(
        and(
          eq(SOrganization.logoId, id),
          includeDeleted ? undefined : eq(SOrganization.isDeleted, false),
        ),
      )
      .limit(1);
    return logo !== undefined;
  }

  /**
   * Job storage.purgeDeleted [FEAT-08]: for files soft-deleted before
   * `olderThan`, delete the object, then hard-delete the row unless a user
   * (avatar) or the organization (logo) still references it. A failed
   * object delete keeps the row for the next run.
   */
  async purgeDeleted(c: IApp, olderThan: Date) {
    const rows = await c.db
      .select({ id: SStorage.id, key: SStorage.key })
      .from(SStorage)
      .where(
        and(eq(SStorage.isDeleted, true), lt(SStorage.deletedAt, olderThan)),
      );
    let purged = 0;
    for (const row of rows) {
      if (await this.isReferenced(c, row.id, true)) {
        continue;
      }
      try {
        await StorageManager.delete(row.key);
      } catch (err) {
        logger.warn(
          { err, id: row.id },
          "storage.purgeDeleted: object delete failed",
        );
        continue;
      }
      await c.db.delete(SStorage).where(eq(SStorage.id, row.id));
      purged++;
    }
    return { purged };
  }

  /**
   * Job storage.cleanupPending [FEAT-08]: uploads still PENDING after
   * `olderThan` never completed; remove their object (if any) and row.
   */
  async cleanupPending(c: IApp, olderThan: Date) {
    const rows = await c.db
      .select({ id: SStorage.id, key: SStorage.key })
      .from(SStorage)
      .where(
        and(
          eq(SStorage.status, EStorageStatus.PENDING),
          lt(SStorage.createdAt, olderThan),
        ),
      );
    let removed = 0;
    for (const row of rows) {
      try {
        await StorageManager.delete(row.key);
      } catch (err) {
        logger.warn(
          { err, id: row.id },
          "storage.cleanupPending: object delete failed",
        );
        continue;
      }
      await c.db.delete(SStorage).where(eq(SStorage.id, row.id));
      removed++;
    }
    return { removed };
  }
}

export default new ServiceStorage();
