import { Module, Global } from "@nestjs/common";
import { prisma } from "@payflow/database";

export const PRISMA_TOKEN = "PRISMA";

@Global()
@Module({
    providers: [
        {
            provide: PRISMA_TOKEN,
            useValue: prisma,
        },
    ],
    exports: [PRISMA_TOKEN],
})
export class DatabaseModule {}
