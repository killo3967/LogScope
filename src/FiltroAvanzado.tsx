import { useEffect, useState } from "react";

import type {
  CampoFiltro,
  ComparacionFiltro,
  CondicionFiltro,
  ConectorFiltro,
  FiltroAvanzado,
  GrupoFiltro,
} from "./types";
import type { ClaveTexto } from "./textos";
import { t } from "./textos";

interface Props {
  open: boolean;
  /** Filtro guardado en la pestaña activa; `null` = ninguno. */
  filtro: FiltroAvanzado | null;
  /** Nombres de fuente de la sesión. Solo se ofrecen si la vista es combinada. */
  fuentes: string[];
  combinada: boolean;
  onClose: () => void;
  /** `null` cuando el filtro no restringe nada. */
  onApply: (filtro: FiltroAvanzado | null) => void;
}

/** Opciones de los desplegables, en el orden en que se ofrecen. */
const CAMPOS: CampoFiltro[] = ["texto", "nivel", "fuente"];
const COMPARACIONES: ComparacionFiltro[] = [
  "contiene",
  "igual",
  "empiezaPor",
  "terminaPor",
  "regex",
];

// Los nombres visibles no se escriben aquí: salen del catálogo, y este mapa es
// el que mantiene el tipo de la clave sin conversiones en el render.
const ETIQUETA_CAMPO: Record<CampoFiltro, ClaveTexto> = {
  texto: "filtro.campo.texto",
  nivel: "filtro.campo.nivel",
  fuente: "filtro.campo.fuente",
};

const ETIQUETA_COMPARACION: Record<ComparacionFiltro, ClaveTexto> = {
  contiene: "filtro.comparacion.contiene",
  igual: "filtro.comparacion.igual",
  empiezaPor: "filtro.comparacion.empiezaPor",
  terminaPor: "filtro.comparacion.terminaPor",
  regex: "filtro.comparacion.regex",
};

/**
 * Estado del formulario. Es el mismo modelo que se manda al núcleo salvo las
 * fechas y las horas, que aquí viven como las escribe el usuario
 * (`YYYY-MM-DD` y `HH:MM`) y se convierten al aplicar: así un valor a medio
 * escribir no rompe nada.
 */
interface Formulario {
  grupos: GrupoFiltro[];
  desde: string;
  hasta: string;
  horaDesde: string;
  horaHasta: string;
  fuentes: string[];
}

function condicionVacia(): CondicionFiltro {
  return { campo: "texto", comparacion: "contiene", valor: "", negada: false };
}

function grupoVacio(): GrupoFiltro {
  return { operador: "y", condiciones: [] };
}

function formularioVacio(): Formulario {
  return {
    grupos: [grupoVacio()],
    desde: "",
    hasta: "",
    horaDesde: "",
    horaHasta: "",
    fuentes: [],
  };
}

const DOS_DIGITOS = (n: number) => String(n).padStart(2, "0");

/**
 * Fecha de un valor de pared (los ms son hora de pared «como si fuera UTC»).
 * Se lee en UTC a propósito: con la zona del equipo una fecha podría verse un
 * día antes o después de la que se guardó.
 */
function fechaDeMs(ms: number | null): string {
  if (ms === null) return "";
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${DOS_DIGITOS(d.getUTCMonth() + 1)}-${DOS_DIGITOS(
    d.getUTCDate(),
  )}`;
}

/**
 * Medianoche UTC de una fecha `YYYY-MM-DD`, que es lo que el núcleo compara
 * contra la hora de pared del fichero. `null` si el campo está vacío o a medio
 * escribir.
 */
function msDeFecha(fecha: string): number | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!partes) return null;
  return Date.UTC(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
}

/** Minutos del día de un valor `HH:MM`; `null` si está vacío. */
function minutosDeHora(hora: string): number | null {
  const partes = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!partes) return null;
  return Number(partes[1]) * 60 + Number(partes[2]);
}

function horaDeMinutos(minutos: number | null): string {
  if (minutos === null) return "";
  return `${DOS_DIGITOS(Math.floor(minutos / 60))}:${DOS_DIGITOS(minutos % 60)}`;
}

function formularioDe(filtro: FiltroAvanzado | null, combinada: boolean): Formulario {
  if (!filtro) return formularioVacio();
  return {
    // Se copia para que editar el formulario no toque el filtro de la pestaña
    // hasta que se pulse Aplicar.
    grupos:
      filtro.grupos.length > 0
        ? filtro.grupos.map((grupo) => ({
            operador: grupo.operador,
            condiciones: grupo.condiciones.map((condicion) => ({ ...condicion })),
          }))
        : [grupoVacio()],
    desde: fechaDeMs(filtro.desdeMs),
    hasta: fechaDeMs(filtro.hastaMs),
    horaDesde: horaDeMinutos(filtro.horaDesde),
    horaHasta: horaDeMinutos(filtro.horaHasta),
    fuentes: combinada ? [...filtro.fuentes] : [],
  };
}

/**
 * Modelo que se manda al núcleo, o `null` si no restringe nada. Los grupos sin
 * condiciones se descartan: no aportan y ensucian el formulario al reabrirlo.
 */
function construirFiltro(formulario: Formulario, combinada: boolean): FiltroAvanzado | null {
  const grupos = formulario.grupos
    .filter((grupo) => grupo.condiciones.length > 0)
    .map((grupo) => ({
      operador: grupo.operador,
      condiciones: grupo.condiciones.map((condicion) => ({ ...condicion })),
    }));

  const desdeMs = msDeFecha(formulario.desde);
  const hastaFecha = msDeFecha(formulario.hasta);
  // El extremo superior es la última hora del día: el rango es inclusivo.
  const hastaMs = hastaFecha === null ? null : hastaFecha + 86_399_999;
  const horaDesde = minutosDeHora(formulario.horaDesde);
  const horaHasta = minutosDeHora(formulario.horaHasta);
  // Sin vista combinada no hay fuentes que elegir: se ignoran.
  const fuentes = combinada ? formulario.fuentes : [];

  const vacio =
    grupos.length === 0 &&
    desdeMs === null &&
    hastaMs === null &&
    horaDesde === null &&
    horaHasta === null &&
    fuentes.length === 0;
  if (vacio) return null;

  return { grupos, desdeMs, hastaMs, horaDesde, horaHasta, fuentes };
}

/**
 * Ventana del filtro avanzado: grupos de condiciones y un rango de fechas,
 * una franja horaria y las fuentes de la sesión combinada.
 *
 * No evalúa nada: solo construye el modelo que `App.tsx` guarda en la pestaña
 * y manda a `read_page`, donde lo resuelve el núcleo.
 */
export function FiltroAvanzado({
  open,
  filtro,
  fuentes,
  combinada,
  onClose,
  onApply,
}: Props) {
  const [formulario, setFormulario] = useState<Formulario>(formularioVacio);

  // El formulario arranca con lo que ya tenga la pestaña cada vez que se abre:
  // se resetea al abrir, no en cada render, para no perder lo que se escribe.
  useEffect(() => {
    if (!open) return;
    setFormulario(formularioDe(filtro, combinada));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const cambiarGrupo = (indice: number, patch: Partial<GrupoFiltro>) => {
    setFormulario((previous) => ({
      ...previous,
      grupos: previous.grupos.map((grupo, i) =>
        i === indice ? { ...grupo, ...patch } : grupo,
      ),
    }));
  };

  const cambiarCondicion = (
    indiceGrupo: number,
    indiceCondicion: number,
    patch: Partial<CondicionFiltro>,
  ) => {
    setFormulario((previous) => ({
      ...previous,
      grupos: previous.grupos.map((grupo, i) =>
        i === indiceGrupo
          ? {
              ...grupo,
              condiciones: grupo.condiciones.map((condicion, j) =>
                j === indiceCondicion ? { ...condicion, ...patch } : condicion,
              ),
            }
          : grupo,
      ),
    }));
  };

  const anadirCondicion = (indiceGrupo: number) => {
    setFormulario((previous) => ({
      ...previous,
      grupos: previous.grupos.map((grupo, i) =>
        i === indiceGrupo
          ? { ...grupo, condiciones: [...grupo.condiciones, condicionVacia()] }
          : grupo,
      ),
    }));
  };

  const quitarCondicion = (indiceGrupo: number, indiceCondicion: number) => {
    setFormulario((previous) => ({
      ...previous,
      grupos: previous.grupos.map((grupo, i) =>
        i === indiceGrupo
          ? {
              ...grupo,
              condiciones: grupo.condiciones.filter((_, j) => j !== indiceCondicion),
            }
          : grupo,
      ),
    }));
  };

  const anadirGrupo = () => {
    setFormulario((previous) => ({
      ...previous,
      grupos: [...previous.grupos, grupoVacio()],
    }));
  };

  const quitarGrupo = (indice: number) => {
    setFormulario((previous) => ({
      ...previous,
      grupos: previous.grupos.filter((_, i) => i !== indice),
    }));
  };

  const alternarFuente = (nombre: string) => {
    setFormulario((previous) => ({
      ...previous,
      fuentes: previous.fuentes.includes(nombre)
        ? previous.fuentes.filter((fuente) => fuente !== nombre)
        : [...previous.fuentes, nombre],
    }));
  };

  return (
    <div className="browser-backdrop" onClick={onClose}>
      <div className="browser filtro" onClick={(event) => event.stopPropagation()}>
        <header className="browser-head">
          <strong>{t("filtro.titulo")}</strong>
          <span className="hint">{t("filtro.pista")}</span>
        </header>

        <div className="mapper-body filtro-body">
          {formulario.grupos.map((grupo, indiceGrupo) => (
            <div className="filtro-grupo" key={indiceGrupo}>
              <div className="filtro-grupo-head">
                <span className="filtro-grupo-title">
                  {t("filtro.grupo", { n: indiceGrupo + 1 })}
                </span>
                <select
                  className="filtro-conector"
                  value={grupo.operador}
                  onChange={(event) =>
                    cambiarGrupo(indiceGrupo, {
                      operador: event.target.value as ConectorFiltro,
                    })
                  }
                >
                  <option value="y">{t("filtro.conectorY")}</option>
                  <option value="o">{t("filtro.conectorO")}</option>
                </select>
                <button onClick={() => quitarGrupo(indiceGrupo)}>
                  {t("filtro.quitarGrupo")}
                </button>
              </div>

              {grupo.condiciones.map((condicion, indiceCondicion) => (
                <div className="filtro-condicion" key={indiceCondicion}>
                  <select
                    value={condicion.campo}
                    title={t("filtro.campo")}
                    onChange={(event) =>
                      cambiarCondicion(indiceGrupo, indiceCondicion, {
                        campo: event.target.value as CampoFiltro,
                      })
                    }
                  >
                    {CAMPOS.map((campo) => (
                      <option key={campo} value={campo}>
                        {t(ETIQUETA_CAMPO[campo])}
                      </option>
                    ))}
                  </select>
                  <select
                    value={condicion.comparacion}
                    title={t("filtro.comparacion")}
                    onChange={(event) =>
                      cambiarCondicion(indiceGrupo, indiceCondicion, {
                        comparacion: event.target.value as ComparacionFiltro,
                      })
                    }
                  >
                    {COMPARACIONES.map((comparacion) => (
                      <option key={comparacion} value={comparacion}>
                        {t(ETIQUETA_COMPARACION[comparacion])}
                      </option>
                    ))}
                  </select>
                  <input
                    className="filtro-valor"
                    placeholder={t("filtro.valor")}
                    value={condicion.valor}
                    onChange={(event) =>
                      cambiarCondicion(indiceGrupo, indiceCondicion, {
                        valor: event.target.value,
                      })
                    }
                  />
                  <label className="check filtro-negada">
                    <input
                      type="checkbox"
                      checked={condicion.negada}
                      onChange={(event) =>
                        cambiarCondicion(indiceGrupo, indiceCondicion, {
                          negada: event.target.checked,
                        })
                      }
                    />
                    {t("filtro.negada")}
                  </label>
                  <button onClick={() => quitarCondicion(indiceGrupo, indiceCondicion)}>
                    {t("filtro.quitarCondicion")}
                  </button>
                </div>
              ))}

              <div>
                <button onClick={() => anadirCondicion(indiceGrupo)}>
                  {t("filtro.anadirCondicion")}
                </button>
              </div>
            </div>
          ))}

          <div>
            <button onClick={anadirGrupo}>{t("filtro.anadirGrupo")}</button>
          </div>

          <div className="filtro-bloque">
            <div className="filtro-fila">
              <label className="props-field">
                <span>{t("filtro.desde")}</span>
                <input
                  type="date"
                  value={formulario.desde}
                  onChange={(event) =>
                    setFormulario((previous) => ({ ...previous, desde: event.target.value }))
                  }
                />
              </label>
              <label className="props-field">
                <span>{t("filtro.hasta")}</span>
                <input
                  type="date"
                  value={formulario.hasta}
                  onChange={(event) =>
                    setFormulario((previous) => ({ ...previous, hasta: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="props-field">
              <span>{t("filtro.franja")}</span>
              <span className="filtro-horas">
                <input
                  type="time"
                  title={t("filtro.desde")}
                  value={formulario.horaDesde}
                  onChange={(event) =>
                    setFormulario((previous) => ({
                      ...previous,
                      horaDesde: event.target.value,
                    }))
                  }
                />
                <input
                  type="time"
                  title={t("filtro.hasta")}
                  value={formulario.horaHasta}
                  onChange={(event) =>
                    setFormulario((previous) => ({
                      ...previous,
                      horaHasta: event.target.value,
                    }))
                  }
                />
              </span>
            </div>
          </div>

          {combinada && fuentes.length > 0 && (
            <div className="filtro-bloque">
              <div className="filtro-bloque-title">{t("filtro.fuentes")}</div>
              <div className="filtro-fuentes">
                {fuentes.map((nombre) => (
                  <label className="check" key={nombre}>
                    <input
                      type="checkbox"
                      checked={formulario.fuentes.includes(nombre)}
                      onChange={() => alternarFuente(nombre)}
                    />
                    {nombre}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="browser-foot">
          <button onClick={() => setFormulario(formularioVacio())}>
            {t("filtro.limpiar")}
          </button>
          <span className="selected-path" />
          <button onClick={onClose}>{t("filtro.cerrar")}</button>
          <button
            className="primary"
            onClick={() => onApply(construirFiltro(formulario, combinada))}
          >
            {t("filtro.aplicar")}
          </button>
        </footer>
      </div>
    </div>
  );
}
