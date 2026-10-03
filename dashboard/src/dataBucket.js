// Shared by the static exporter and browser. Never use catalog identity as a filename.
export function dataBucket(jname) {
  let hash = 2166136261;
  for (let i = 0; i < jname.length; i++) hash = Math.imul(hash ^ jname.charCodeAt(i), 16777619);
  return (hash & 255).toString(16).padStart(2, '0');
}
