import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";
import { ZodSchema, ZodError } from "zod";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
    constructor(private schema: ZodSchema) {}

    transform(value: unknown) {
        try {
            return this.schema.parse(value);
        } catch (error) {
            if (error instanceof ZodError) {
                throw new BadRequestException({
                    statusCode: 400,
                    error: "Validation Error",
                    message: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
                });
            }
            throw new BadRequestException("Validation failed");
        }
    }
}
