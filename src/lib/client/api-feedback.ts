export type ApiFeedbackPayload = {
  error?: string | null;
  requestId?: string | null;
};

export function extractApiRequestId(
  response: Response,
  payload?: ApiFeedbackPayload | null,
) {
  const payloadRequestId =
    typeof payload?.requestId === "string" ? payload.requestId.trim() : "";

  if (payloadRequestId) {
    return payloadRequestId;
  }

  const headerRequestId = response.headers.get("x-request-id")?.trim() ?? "";
  return headerRequestId || null;
}

export function appendRequestIdToMessage(
  message: string,
  requestId?: string | null,
) {
  const normalizedMessage = message.trim();
  const normalizedRequestId = requestId?.trim();

  if (!normalizedRequestId) {
    return normalizedMessage;
  }

  return `${normalizedMessage} Ref: ${normalizedRequestId}.`;
}

export function buildApiErrorMessage(input: {
  fallback: string;
  payload?: ApiFeedbackPayload | null;
  response: Response;
}) {
  const baseMessage =
    typeof input.payload?.error === "string" && input.payload.error.trim()
      ? input.payload.error.trim()
      : input.fallback;

  return appendRequestIdToMessage(
    baseMessage,
    extractApiRequestId(input.response, input.payload),
  );
}
