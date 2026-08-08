export function resolveAppRouteProtection(input: {
  hasSession: boolean;
  requestUrl: string;
  pathname: string;
  search: string;
}) {
  if (input.hasSession) {
    return {
      type: "allow" as const,
      redirectUrl: null,
    };
  }

  const loginUrl = new URL("/login", input.requestUrl);
  loginUrl.searchParams.set("next", `${input.pathname}${input.search}`);

  return {
    type: "redirect" as const,
    redirectUrl: loginUrl.toString(),
  };
}
