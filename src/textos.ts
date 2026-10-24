import { useSyncExternalStore } from "react";

import { DE } from "./i18n/de";
import { EN } from "./i18n/en";
import { ES, type ClaveTexto } from "./i18n/es";
import { FR } from "./i18n/fr";
import { IT } from "./i18n/it";
import { PT } from "./i18n/pt";

export type { ClaveTexto };

/**
 * Idiomas disponibles. El castellano es el catálogo original: de él salen las
 * claves, así que un diccionario nuevo está completo cuando TypeScript no se
 * queja de que le falte ninguno.
 */
export type Idioma = "es" | "en" | "fr" | "it" | "de" | "pt";

export const IDIOMAS: Idioma[] = ["es", "en", "fr", "it", "de", "pt"];

/** Nombre de cada idioma en su propia lengua, para el selector. */
export const NOMBRE_IDIOMA: Record<Idioma, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
  it: "Italiano",
  de: "Deutsch",
  pt: "Português",
};

const DICCIONARIOS: Record<Idioma, Record<ClaveTexto, string>> = {
  es: ES,
  en: EN,
  fr: FR,
  it: IT,
  de: DE,
  pt: PT,
};

/** Idioma del sistema, si es uno de los que tenemos; si no, castellano. */
export function idiomaDelSistema(): Idioma {
  const etiqueta =
    typeof navigator !== "undefined" ? navigator.language.slice(0, 2).toLowerCase() : "es";
  return (IDIOMAS as string[]).includes(etiqueta) ? (etiqueta as Idioma) : "es";
}

let actual: Idioma = "es";
const oyentes = new Set<() => void>();

/** Idioma en uso. Es estado de módulo: lo lee `t` sin pasar props por el árbol. */
export function idiomaActual(): Idioma {
  return actual;
}

/**
 * Cambia el idioma y avisa a la interfaz. No toca las preferencias: quien
 * guarda la elección es `App.tsx`, en los ajustes.
 */
export function setIdioma(nuevo: Idioma): void {
  if (!DICCIONARIOS[nuevo] || nuevo === actual) return;
  actual = nuevo;
  if (typeof document !== "undefined") {
    document.documentElement.lang = nuevo;
  }
  for (const avisar of oyentes) avisar();
}

/**
 * Suscribe el componente al idioma activo: cambiar de idioma vuelve a pintar el
 * árbol entero, que es lo que hace falta porque los textos se leen con `t()`.
 */
export function useIdioma(): Idioma {
  return useSyncExternalStore(
    (avisar) => {
      oyentes.add(avisar);
      return () => {
        oyentes.delete(avisar);
      };
    },
    () => actual,
    () => actual,
  );
}

/** Diccionario completo de un idioma. */
export function textosDe(idioma: Idioma): Record<ClaveTexto, string> {
  return DICCIONARIOS[idioma];
}

/** ¿Existe la clave? Sirve para resolver códigos que llegan en tiempo de ejecución. */
export function esClave(clave: string): clave is ClaveTexto {
  return Object.prototype.hasOwnProperty.call(ES, clave);
}

function sustituir(plantilla: string, params?: Record<string, string | number>): string {
  if (!params) return plantilla;
  return plantilla.replace(/\{([A-Za-z0-9_]+)\}/g, (marcador, nombre: string) =>
    Object.prototype.hasOwnProperty.call(params, nombre)
      ? String(params[nombre])
      : marcador,
  );
}

/** Texto del catálogo del idioma activo, con los marcadores `{param}` sustituidos. */
export function t(clave: ClaveTexto, params?: Record<string, string | number>): string {
  const diccionario = DICCIONARIOS[actual] ?? ES;
  return sustituir(diccionario[clave] ?? ES[clave], params);
}
