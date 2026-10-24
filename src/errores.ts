import { esClave, t } from "./textos";

/**
 * Formato de error del núcleo (ver `error_json` en `src-tauri/src/lib.rs`):
 * `{"code":"<código>","params":{"nombre":"valor"}}`. La frase se compone con la
 * clave `error.<código>` del catálogo; si el texto no es ese JSON o el código no
 * tiene traducción, se devuelve tal cual para no perder información.
 */
interface ErrorNucleo {
  code: string;
  params: Record<string, string | number>;
}

function interpretar(crudo: string): ErrorNucleo | null {
  if (!crudo.trimStart().startsWith("{")) return null;
  try {
    const valor = JSON.parse(crudo) as unknown;
    if (typeof valor !== "object" || valor === null) return null;
    const { code, params } = valor as { code?: unknown; params?: unknown };
    if (typeof code !== "string" || code === "") return null;

    const limpios: Record<string, string | number> = {};
    if (typeof params === "object" && params !== null) {
      for (const [nombre, valorParam] of Object.entries(params)) {
        if (typeof valorParam === "string" || typeof valorParam === "number") {
          limpios[nombre] = valorParam;
        }
      }
    }
    return { code, params: limpios };
  } catch {
    return null;
  }
}

/** Frase de error lista para mostrar, a partir del error crudo del núcleo. */
export function mensajeDeError(crudo: string): string {
  const error = interpretar(crudo);
  if (!error) return crudo;
  const clave = `error.${error.code}`;
  if (!esClave(clave)) return crudo;
  return t(clave, error.params);
}
