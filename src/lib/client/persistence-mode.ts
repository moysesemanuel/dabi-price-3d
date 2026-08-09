export function getClientPersistenceMode() {
  if (typeof document === "undefined") {
    return null;
  }

  const element = document.querySelector("[data-persistence-mode]");
  const value = element?.getAttribute("data-persistence-mode");

  return value === "database" || value === "local" ? value : null;
}

export function isClientLocalPersistenceMode() {
  return getClientPersistenceMode() === "local";
}
