export function isAllowedWorkspaceUploadPath(
  pathname: string,
  prefix: string,
  workspaceId: string,
) {
  const workspacePrefix = `${prefix}/${workspaceId}/`;

  return (
    pathname.startsWith(workspacePrefix) &&
    pathname.length > workspacePrefix.length &&
    !pathname.includes("\\") &&
    !pathname.split("/").includes("..")
  );
}
