import { Controller, Post, Body, HttpCode, HttpStatus, Version } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterDto, LoginDto, RegisterSchema, LoginSchema } from "@payflow/shared";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post("register")
    @Version("1")
    @ApiOperation({ summary: "Register a new user and organization" })
    async register(@Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post("login")
    @Version("1")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Login with email and password" })
    async login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto) {
        return this.authService.login(dto);
    }
}
