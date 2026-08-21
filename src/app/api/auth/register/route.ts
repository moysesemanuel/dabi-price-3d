import { cookies } from "next/headers";
import {
    loginWithEmailPassword,
    setSessionCookie,
} from "@/lib/auth/session";
import {
    consumeRateLimit,
    getClientIpAddress,
} from "@/lib/server/rate-limit";
import { registerWorkspaceOwner } from "@/lib/server/platform";

type RegisterRequestPayload = {
    fullName?: string;
    email?: string;
    password?: string;
    workspaceName?: string;
};

export async function POST(request: Request) {
    let body: RegisterRequestPayload;

    try {
        body = (await request.json()) as RegisterRequestPayload;
    } catch {
        return Response.json(
            { error: "Payload de cadastro inválido." },
            { status: 400 },
        );
    }

    const fullName = body.fullName?.trim() ?? "";
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";
    const workspaceName = body.workspaceName?.trim() ?? "";

    if (!fullName || !email || !password || !workspaceName) {
        return Response.json(
            { error: "Preencha todos os campos obrigatórios." },
            { status: 400 },
        );
    }

    if (!isValidEmail(email)) {
        return Response.json(
            { error: "Informe um e-mail válido." },
            { status: 400 },
        );
    }

    if (password.length < 8) {
        return Response.json(
            { error: "A senha deve ter pelo menos 8 caracteres." },
            { status: 400 },
        );
    }

    const clientIp = getClientIpAddress(request);

    const ipRateLimit = await consumeRateLimit({
        key: `register:ip:${clientIp}`,
        maxAttempts: 5,
        windowMs: 1000 * 60 * 15,
    });

    const emailRateLimit = await consumeRateLimit({
        key: `register:email:${email.toLowerCase()}`,
        maxAttempts: 3,
        windowMs: 1000 * 60 * 15,
    });

    if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
        const retryAfterSeconds = Math.max(
            ipRateLimit.retryAfterSeconds,
            emailRateLimit.retryAfterSeconds,
        );

        return Response.json(
            {
                error:
                    "Muitas tentativas de cadastro em sequência. Aguarde alguns minutos e tente novamente.",
            },
            {
                status: 429,
                headers: {
                    "Retry-After": String(retryAfterSeconds),
                },
            },
        );
    }

    try {
        await registerWorkspaceOwner({
            fullName,
            email,
            password,
            workspaceName,
        });
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "EMAIL_ALREADY_REGISTERED"
        ) {
            return Response.json(
                { error: "Este e-mail já possui uma conta." },
                { status: 409 },
            );
        }

        throw error;
    }

    const authResult = await loginWithEmailPassword({
        email,
        password,
    });

    if (!authResult) {
        throw new Error("REGISTER_LOGIN_FAILED");
    }

    const cookieStore = await cookies();

    setSessionCookie(
        cookieStore,
        authResult.sessionToken,
        authResult.expiresAt,
    );

    return Response.json(
        {
            session: authResult.session,
            redirectTo: "/app/onboarding",
        },
        { status: 201 },
    );
}

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
