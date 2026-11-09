import { UtilHttp } from "@/common/utils/UtilHttp";
import { SStorage } from "../schemas/SStorage";

import { and, eq, type SQL } from "drizzle-orm";
import StorageManager from "@/infrastructure/storage/StorageManager";
import { IApp, IUserApp, ServiceBase } from "bedest-core";
import { EUserRole } from "@f/user/enums/EUserRole";
import { SUser } from "@f/user/schemas/SUser";
import { SOrganization } from "@f/organization/schemas/SOrganization";
import { EStorageStatus } from "../enums/EStorageStatus";
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
      throw UtilHttp.fail(404);
    }

    const fileBlob = await StorageManager.download(fileRecord.key);

    if (!fileBlob) {
      throw UtilHttp.fail(404);
    }

    return { fileBlob, metadata: fileRecord };
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
      throw UtilHttp.fail(403, "Only the uploader or an admin can delete this file");
    }

    if (await this.isReferenced(c, id)) {
      throw UtilHttp.fail(409, "File is in use");
    }

    // Soft delete only; the object is removed by the purge job [BUG-03].
    return await super.remove(c, id);
  }

  /** Whether an active user (avatar) or organization (logo) points at it. */
  private async isReferenced(c: IApp, id: string): Promise<boolean> {
    const [avatar] = await c.db
      .select({ id: SUser.id })
      .from(SUser)
      .where(and(eq(SUser.avatarId, id), eq(SUser.isDeleted, false)))
      .limit(1);
    if (avatar) {
      return true;
    }
    const [logo] = await c.db
      .select({ id: SOrganization.id })
      .from(SOrganization)
      .where(
        and(eq(SOrganization.logoId, id), eq(SOrganization.isDeleted, false)),
      )
      .limit(1);
    return logo !== undefined;
  }
}

export default new ServiceStorage();
