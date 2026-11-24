import type { NotificationType, Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export async function createNotificationForAdmins(
  db: Db,
  input: {
    type: NotificationType;
    title: string;
    body: string;
    entityType?: string;
    entityId?: string;
  },
) {
  const admins = await db.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });

  if (!admins.length) return;

  await db.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
    })),
  });
}

export async function createNotification(
  db: Db,
  input: {
    userId?: string | null;
    type?: NotificationType;
    title: string;
    body: string;
    entityType?: string;
    entityId?: string;
  },
) {
  return db.notification.create({
    data: {
      userId: input.userId ?? null,
      type: input.type ?? "INFO",
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });
}

/** Mark entity-linked alerts read so inbox does not keep stale action items (DEF-FS-10). */
export async function markNotificationsReadForEntity(
  db: Db,
  input: { entityType: string; entityId: string },
) {
  await db.notification.updateMany({
    where: {
      entityType: input.entityType,
      entityId: input.entityId,
      isRead: false,
    },
    data: { isRead: true },
  });
}
