export function buildWorkspaceUploadPath(
  prefix: string,
  pathname: string,
) {
  const workspaceId = document
    .querySelector<HTMLElement>("main[data-workspace-id]")
    ?.dataset.workspaceId;

  if (!workspaceId) {
    throw new Error("Não foi possível identificar o workspace para o upload.");
  }

  return `${prefix}/${workspaceId}/${pathname}`;
}
