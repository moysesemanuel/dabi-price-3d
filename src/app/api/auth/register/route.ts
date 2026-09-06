import { cookies } from "next/headers";
import {
    loginWithEmailPassword,
    setSessionCookie,
} from "@/lib/auth/session";
import {
    consumeRateLimit,
    getClientIpAddress,
} from "@/lib/server/rate-limit";
import {
    recordUserConsent,
    registerWorkspaceOwner,
} from "@/lib/server/platform";
import { currentConsentVersions } from "@/lib/legal/documents";
import {
    createRouteRequestContext,
    logRouteEvent,
    serializeError,
} from "@/lib/server/route-observability";

type RegisterRequestPayload = {
    fullName?: string;
    email?: string;
    password?: string;
    workspaceName?: string;
    acceptedTerms?: boolean;
};

export async function POST(request: Request) {
    const requestContext = createRouteRequestContext(
        request,
        "/api/auth/register",
    );
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
    const acceptedTerms = body.acceptedTerms === true;

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

    // O aceite e validado no servidor, nao so no formulario: sem isto, um POST
    // direto criaria conta sem consentimento registrado.
    if (!acceptedTerms) {
        return Response.json(
            {
                error:
                    "É necessário aceitar os Termos de Uso e a Política de Privacidade.",
            },
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

    let registration: Awaited<ReturnType<typeof registerWorkspaceOwner>>;

    try {
        registration = await registerWorkspaceOwner({
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

    try {
        await recordUserConsent({
            userId: registration.userId,
            versions: currentConsentVersions,
            ipAddress: clientIp,
            userAgent: request.headers.get("user-agent"),
        });
    } catch (error) {
        // A conta ja existe neste ponto. Falhar aqui derrubaria um cadastro
        // valido; o registro do aceite e reconciliavel, a conta perdida nao.
        logRouteEvent(requestContext, "error", "register.consent_record_failed", {
            userId: registration.userId,
            ...serializeError(error),
        });
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
