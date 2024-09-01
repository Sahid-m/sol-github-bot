import { PrismaClient } from "@prisma/client";
declare const prismaClientSingleton: () => PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
declare global {
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}
declare const prisma: ReturnType<typeof prismaClientSingleton>;
export default prisma;
