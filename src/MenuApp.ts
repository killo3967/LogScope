import { useEffect, useRef } from "react";
import { Menu } from "@tauri-apps/api/menu";

import { t } from "./textos";

/** Acciones y estado que muestra el menú de aplicación. */
export interface OpcionesMenuApp {
  /** Hay una receta de último log que se pueda reabrir. */
  hayUltimo: boolean;
  /** Hay una pestaña activa: sin ella, Propiedades no tiene nada que enseñar. */
  hayPestana: boolean;
  tailing: boolean;
  tailEnabled: boolean;
  autoScroll: boolean;
  onAbrir: () => void;
  onReabrirUltimo: () => void;
  onToggleTail: () => void;
  onToggleAutoScroll: () => void;
  onRecargar: () => void;
  onPropiedades: () => void;
  onReglas: () => void;
  onAjustes: () => void;
  onAcercaDe: () => void;
}

/**
 * Instala el menú de aplicación desde la interfaz (no desde Rust) para que los
 * rótulos salgan del catálogo de textos. Se reconstruye cuando cambia el estado
 * que muestra —si hay último log, si el tail está activo, etc.— y se cierra el
 * anterior para no dejar menús vivos en el lado nativo.
 *
 * Sin aceleradores: los atajos se diseñan en su propia fase. Si la instalación
 * falla (por ejemplo, por permisos), se ignora: la barra de herramientas sigue
 * ofreciendo las mismas acciones.
 */
export function useMenuApp(opciones: OpcionesMenuApp): void {
  // Los callbacks cambian de identidad en cada render; el menú nativo no debe
  // reconstruirse por eso, así que las acciones leen siempre la última versión.
  const ultimas = useRef(opciones);
  const menuRef = useRef<Menu | null>(null);
  const cola = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    ultimas.current = opciones;
  });

  const { hayUltimo, hayPestana, tailing, tailEnabled, autoScroll } = opciones;

  useEffect(() => {
    let cancelado = false;

    // Las reconstrucciones se encadenan: la siguiente espera a que la anterior
    // termine. Así dos cambios seguidos de estado no instalan menús a la vez.
    const construir = async () => {
      try {
        const menu = await Menu.new({
          items: [
            {
              text: t("menu.archivo"),
              items: [
                {
                  text: t("menu.abrir"),
                  action: () => ultimas.current.onAbrir(),
                },
                {
                  text: t("menu.reabrirUltimo"),
                  enabled: hayUltimo,
                  action: () => ultimas.current.onReabrirUltimo(),
                },
                { item: "Separator" },
                // El ítem nativo de salir, con el rótulo del catálogo para que
                // la fase de traducción no se lo deje fuera.
                { item: "Quit", text: t("menu.salir") },
              ],
            },
            {
              text: t("menu.ver"),
              items: [
                {
                  text: t("menu.tailEnVivo"),
                  checked: tailing,
                  enabled: tailEnabled,
                  action: () => ultimas.current.onToggleTail(),
                },
                {
                  text: t("menu.autoscroll"),
                  checked: autoScroll,
                  action: () => ultimas.current.onToggleAutoScroll(),
                },
                { item: "Separator" },
                {
                  text: t("tab.recargar"),
                  action: () => ultimas.current.onRecargar(),
                },
              ],
            },
            {
              text: t("menu.herramientas"),
              items: [
                {
                  text: t("menu.propiedades"),
                  enabled: hayPestana,
                  action: () => ultimas.current.onPropiedades(),
                },
                {
                  text: t("menu.reglas"),
                  action: () => ultimas.current.onReglas(),
                },
                { item: "Separator" },
                {
                  text: t("menu.ajustes"),
                  action: () => ultimas.current.onAjustes(),
                },
              ],
            },
            {
              text: t("menu.ayuda"),
              items: [
                {
                  text: t("menu.acercaDe"),
                  action: () => ultimas.current.onAcercaDe(),
                },
              ],
            },
          ],
        });

        if (cancelado) {
          void menu.close().catch(() => undefined);
          return;
        }

        const previo = await menu.setAsAppMenu();
        menuRef.current = menu;
        if (previo && previo !== menu) {
          void previo.close().catch(() => undefined);
        }
      } catch {
        // Sin menú de aplicación la ventana sigue funcionando con la barra.
        menuRef.current = null;
      }
    };

    const tarea = cola.current.then(construir, construir);
    cola.current = tarea;

    return () => {
      cancelado = true;
      const actual = menuRef.current;
      menuRef.current = null;
      if (actual) void actual.close().catch(() => undefined);
    };
  }, [hayUltimo, hayPestana, tailing, tailEnabled, autoScroll]);
}
