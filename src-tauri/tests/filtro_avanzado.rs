//! Filtro avanzado: modelo y evaluación en el núcleo.
//!
//! Los datos son sintéticos y se escriben en ficheros temporales reales, como
//! en `tests/fusion.rs`, para pasar por el mismo camino que la aplicación:
//! bytes → `EntryTable` → `Filters` → índices visibles.

use std::path::PathBuf;

use logscope_lib::filtro::{Campo, Comparacion, Condicion, Conector, FiltroAvanzado, Grupo};
use logscope_lib::index::{EntryTable, Filters, LogSet, Source};
use logscope_lib::model::Level;
use logscope_lib::parser::{parse_timestamp, BasicParser};

// ---------------------------------------------------------------- utilidades

fn escribir(nombre: &str, contenido: &str) -> PathBuf {
    let mut path = std::env::temp_dir();
    path.push(format!("logscope-filtro-{nombre}.log"));
    std::fs::write(&path, contenido).expect("escribir log temporal");
    path
}

/// Tabla de una línea por entrada, leyendo un fichero temporal de verdad.
fn tabla_de(nombre: &str, contenido: &str) -> EntryTable {
    let path = escribir(nombre, contenido);
    let bytes = std::fs::read(&path).expect("leer log temporal");
    let mut table = EntryTable::new(BasicParser::new());
    table.ingest_bytes(&bytes);
    table
}

fn fuente(nombre: &str, contenido: &str) -> Source {
    let path = escribir(nombre, contenido);
    let bytes = std::fs::read(&path).expect("leer log temporal");
    let mut table = EntryTable::new(BasicParser::new());
    table.ingest_bytes(&bytes);
    Source {
        name: nombre.to_string(),
        table,
    }
}

/// Tabla de un fichero escrito en una zona horaria concreta (minutos respecto
/// de UTC; `None` = la del equipo). La zona se fija antes de ingerir.
fn tabla_con_zona(nombre: &str, contenido: &str, zona: Option<i32>) -> EntryTable {
    let path = escribir(nombre, contenido);
    let bytes = std::fs::read(&path).expect("leer log temporal");
    let mut table = EntryTable::new(BasicParser::new());
    table.set_zona(zona);
    table.ingest_bytes(&bytes);
    table
}

fn filtro(grupos: Vec<Grupo>) -> FiltroAvanzado {
    FiltroAvanzado {
        grupos,
        ..Default::default()
    }
}

fn condicion(campo: Campo, comparacion: Comparacion, valor: &str) -> Condicion {
    Condicion {
        campo,
        comparacion,
        valor: valor.to_string(),
        negada: false,
    }
}

fn texto(comparacion: Comparacion, valor: &str) -> Condicion {
    condicion(Campo::Texto, comparacion, valor)
}

fn nivel(valor: &str) -> Condicion {
    condicion(Campo::Nivel, Comparacion::Igual, valor)
}

fn negada(condicion: Condicion) -> Condicion {
    Condicion {
        negada: true,
        ..condicion
    }
}

fn grupo(operador: Conector, condiciones: Vec<Condicion>) -> Grupo {
    Grupo {
        operador,
        condiciones,
    }
}

fn con_avanzado(avanzado: FiltroAvanzado) -> Filters {
    Filters {
        levels: None,
        text: None,
        avanzado: Some(avanzado),
    }
}

/// Líneas del fichero de origen que quedan visibles, en orden.
fn visibles(tabla: &EntryTable, contenido: &str, avanzado: FiltroAvanzado) -> Vec<String> {
    let indices = tabla.matching_indices(&con_avanzado(avanzado));
    let lineas: Vec<&str> = contenido.lines().collect();
    indices
        .iter()
        .map(|&index| lineas[index as usize].to_string())
        .collect()
}

fn instante(texto: &str) -> i64 {
    parse_timestamp(texto).unwrap_or_else(|| panic!("instante no reconocido: {texto}"))
}

/// Epoch de una hora de pared escrita, leída «como si fuera UTC». Es lo que ve
/// el usuario en la columna de fecha y hora, y por tanto lo que debe comparar
/// el rango de fechas.
fn pared(texto: &str) -> i64 {
    chrono::NaiveDateTime::parse_from_str(texto, "%Y-%m-%d %H:%M:%S")
        .unwrap_or_else(|e| panic!("hora de pared no reconocida ({texto}): {e}"))
        .and_utc()
        .timestamp_millis()
}

/// Minutos desde medianoche, para las franjas horarias.
fn minuto(hora: u32, minuto: u32) -> u32 {
    hora * 60 + minuto
}

const BASE: &str = "\
2026-10-22 10:00:00 ERROR pago rechazado
2026-10-22 10:00:01 WARN pago lento
2026-10-22 10:00:02 ERROR pago aceptado
2026-10-22 10:00:03 INFO arranque listo
";

// ------------------------------------------------------------- condiciones

#[test]
fn grupo_con_y_exige_todas_las_condiciones() {
    let tabla = tabla_de("y", BASE);
    let filtro = filtro(vec![grupo(
        Conector::Y,
        vec![
            texto(Comparacion::Contiene, "pago"),
            nivel("error"),
        ],
    )]);

    assert_eq!(
        visibles(&tabla, BASE, filtro),
        vec![
            "2026-10-22 10:00:00 ERROR pago rechazado",
            "2026-10-22 10:00:02 ERROR pago aceptado",
        ]
    );
}

#[test]
fn grupo_con_o_basta_una_condicion() {
    let tabla = tabla_de("o", BASE);
    let filtro = filtro(vec![grupo(
        Conector::O,
        vec![nivel("info"), nivel("warn")],
    )]);

    assert_eq!(
        visibles(&tabla, BASE, filtro),
        vec![
            "2026-10-22 10:00:01 WARN pago lento",
            "2026-10-22 10:00:03 INFO arranque listo",
        ]
    );
}

#[test]
fn dos_grupos_se_combinan_con_y() {
    let tabla = tabla_de("dos-grupos", BASE);
    let filtro = filtro(vec![
        grupo(Conector::Y, vec![nivel("error")]),
        grupo(Conector::Y, vec![texto(Comparacion::Contiene, "aceptado")]),
    ]);

    assert_eq!(
        visibles(&tabla, BASE, filtro),
        vec!["2026-10-22 10:00:02 ERROR pago aceptado"]
    );
}

#[test]
fn la_condicion_negada_invierte_el_resultado() {
    let tabla = tabla_de("negada", BASE);
    let filtro = filtro(vec![grupo(Conector::Y, vec![negada(nivel("error"))])]);

    assert_eq!(
        visibles(&tabla, BASE, filtro),
        vec![
            "2026-10-22 10:00:01 WARN pago lento",
            "2026-10-22 10:00:03 INFO arranque listo",
        ]
    );
}

#[test]
fn nivel_y_texto_a_la_vez_sin_distinguir_mayusculas() {
    let tabla = tabla_de("nivel-texto", BASE);
    let filtro = filtro(vec![grupo(
        Conector::Y,
        vec![nivel("ERROR"), texto(Comparacion::Contiene, "PAGO")],
    )]);

    assert_eq!(
        visibles(&tabla, BASE, filtro),
        vec![
            "2026-10-22 10:00:00 ERROR pago rechazado",
            "2026-10-22 10:00:02 ERROR pago aceptado",
        ]
    );
}

// ------------------------------------------------------------------ fechas

const FECHAS: &str = "\
2026-10-22 10:00:00 INFO cero
2026-10-22 10:00:10 INFO diez
2026-10-22 10:00:20 INFO veinte
2026-10-22 10:00:30 INFO treinta
";

#[test]
fn el_rango_de_fechas_incluye_los_extremos() {
    let tabla = tabla_de("fechas", FECHAS);
    let filtro = FiltroAvanzado {
        desde_ms: Some(instante("2026-10-22 10:00:00")),
        hasta_ms: Some(instante("2026-10-22 10:00:20")),
        ..Default::default()
    };

    assert_eq!(
        visibles(&tabla, FECHAS, filtro),
        vec![
            "2026-10-22 10:00:00 INFO cero",
            "2026-10-22 10:00:10 INFO diez",
            "2026-10-22 10:00:20 INFO veinte",
        ],
        "los extremos del rango entran"
    );
}

#[test]
fn el_rango_de_fechas_compara_la_hora_de_pared() {
    // El rango lo pone el usuario con las horas que ve en pantalla, así que se
    // compara contra los dígitos del fichero y no contra el instante real (que
    // en este equipo va una hora por detrás de lo escrito).
    let tabla = tabla_de("fechas-pared", FECHAS);
    let filtro = FiltroAvanzado {
        desde_ms: Some(pared("2026-10-22 10:00:10")),
        hasta_ms: Some(pared("2026-10-22 10:00:20")),
        ..Default::default()
    };

    assert_eq!(
        visibles(&tabla, FECHAS, filtro),
        vec![
            "2026-10-22 10:00:10 INFO diez",
            "2026-10-22 10:00:20 INFO veinte",
        ],
        "el rango debe medirse con la hora escrita, no con el instante"
    );
}

#[test]
fn las_entradas_sin_instante_quedan_fuera_con_rango_de_fechas() {
    const SIN_HORA: &str = "\
2026-10-22 10:00:00 INFO con hora
linea sin instante
";
    let tabla = tabla_de("sin-hora", SIN_HORA);
    assert_eq!(tabla.len(), 2, "BasicParser deja una entrada por línea");
    assert!(tabla.row(1).ts_ms.is_none());

    let con_rango = FiltroAvanzado {
        desde_ms: Some(instante("2026-10-22 00:00:00")),
        hasta_ms: Some(instante("2026-10-22 23:59:59")),
        ..Default::default()
    };
    assert_eq!(
        visibles(&tabla, SIN_HORA, con_rango),
        vec!["2026-10-22 10:00:00 INFO con hora"]
    );

    // La franja horaria también usa el instante: misma exclusión.
    let con_franja = FiltroAvanzado {
        hora_desde: Some(minuto(9, 0)),
        hora_hasta: Some(minuto(11, 0)),
        ..Default::default()
    };
    assert_eq!(
        visibles(&tabla, SIN_HORA, con_franja),
        vec!["2026-10-22 10:00:00 INFO con hora"]
    );
}

// ---------------------------------------------------------- franja horaria

const HORAS: &str = "\
2026-10-22 12:00:00 INFO antes
2026-10-22 12:07:00 INFO desde
2026-10-22 13:00:00 INFO en medio
2026-10-22 15:29:00 INFO hasta
2026-10-22 15:30:00 INFO despues
";

#[test]
fn la_franja_horaria_compara_la_hora_de_pared() {
    // Fichero escrito en UTC-5: la franja se mide con los dígitos del fichero
    // (12:07…15:29), no con el instante real de cada entrada.
    let tabla = tabla_con_zona("franja-pared", HORAS, Some(-300));
    let filtro = FiltroAvanzado {
        hora_desde: Some(minuto(12, 7)),
        hora_hasta: Some(minuto(15, 29)),
        ..Default::default()
    };

    assert_eq!(
        visibles(&tabla, HORAS, filtro),
        vec![
            "2026-10-22 12:07:00 INFO desde",
            "2026-10-22 13:00:00 INFO en medio",
            "2026-10-22 15:29:00 INFO hasta",
        ],
        "la franja compara la hora escrita, no el instante"
    );
}

#[test]
fn franja_horaria_normal() {
    let tabla = tabla_de("franja", HORAS);
    let filtro = FiltroAvanzado {
        hora_desde: Some(minuto(12, 7)),
        hora_hasta: Some(minuto(15, 29)),
        ..Default::default()
    };

    assert_eq!(
        visibles(&tabla, HORAS, filtro),
        vec![
            "2026-10-22 12:07:00 INFO desde",
            "2026-10-22 13:00:00 INFO en medio",
            "2026-10-22 15:29:00 INFO hasta",
        ]
    );
}

#[test]
fn franja_horaria_que_cruza_medianoche() {
    const CRUZA: &str = "\
2026-10-22 21:59:00 INFO antes
2026-10-22 22:00:00 INFO desde
2026-10-22 23:30:00 INFO noche
2026-10-23 01:00:00 INFO madrugada
2026-10-23 02:00:00 INFO hasta
2026-10-23 02:01:00 INFO despues
";
    let tabla = tabla_de("cruza", CRUZA);
    let filtro = FiltroAvanzado {
        hora_desde: Some(minuto(22, 0)),
        hora_hasta: Some(minuto(2, 0)),
        ..Default::default()
    };

    assert_eq!(
        visibles(&tabla, CRUZA, filtro),
        vec![
            "2026-10-22 22:00:00 INFO desde",
            "2026-10-22 23:30:00 INFO noche",
            "2026-10-23 01:00:00 INFO madrugada",
            "2026-10-23 02:00:00 INFO hasta",
        ]
    );
}

#[test]
fn franja_con_extremos_iguales_es_el_dia_completo() {
    let tabla = tabla_de("dia-completo", HORAS);
    let set = LogSet::new(vec![fuente("dia-completo.log", HORAS)]);

    // Por sí sola no restringe: el día completo no descarta nada.
    let solo_franja = FiltroAvanzado {
        hora_desde: Some(minuto(10, 0)),
        hora_hasta: Some(minuto(10, 0)),
        ..Default::default()
    };
    assert!(!solo_franja.restringe());
    assert_eq!(
        set.visible(&con_avanzado(solo_franja.clone())).len(),
        HORAS.lines().count(),
        "todo el día: no se descarta ninguna entrada"
    );

    // Y si el filtro restringe por otra vía, la franja igual sigue sin
    // descartar por hora: solo queda lo que corta el rango de fechas.
    let con_fechas = FiltroAvanzado {
        desde_ms: Some(instante("2026-10-22 13:00:00")),
        hasta_ms: Some(instante("2026-10-22 13:00:00")),
        ..solo_franja
    };
    assert_eq!(
        visibles(&tabla, HORAS, con_fechas),
        vec!["2026-10-22 13:00:00 INFO en medio"]
    );
}

// ------------------------------------------------------------------ fuentes

#[test]
fn filtra_por_fuente_en_una_vista_combinada() {
    let contenido_a = "\
2026-10-22 10:00:00 INFO a0
2026-10-22 10:00:02 INFO a1
";
    let contenido_b = "\
2026-10-22 10:00:01 ERROR b0
2026-10-22 10:00:03 ERROR b1
";
    let set = LogSet::new(vec![
        fuente("a.log", contenido_a),
        fuente("b.log", contenido_b),
    ]);
    assert_eq!(set.len(), 4);

    let filtro = FiltroAvanzado {
        fuentes: vec!["b.log".to_string()],
        ..Default::default()
    };
    let indices = set.visible(&con_avanzado(filtro.clone()));
    assert_eq!(indices.len(), 2, "solo el fichero b.log");

    let origenes: Vec<String> = indices
        .iter()
        .map(|&index| set.row(index as usize).source)
        .collect();
    assert_eq!(origenes, vec!["b.log", "b.log"]);

    let niveles: Vec<Level> = indices
        .iter()
        .map(|&index| set.row(index as usize).level)
        .collect();
    assert_eq!(niveles, vec![Level::Error, Level::Error]);

    // Sin fuentes, la vista combinada muestra todo.
    let todas = set.visible(&con_avanzado(FiltroAvanzado::default()));
    assert_eq!(todas.len(), 4, "un filtro vacío no restringe");

    // La caché de `visible` distingue un filtro avanzado de otro.
    let otra = set.visible(&con_avanzado(FiltroAvanzado {
        fuentes: vec!["a.log".to_string()],
        ..Default::default()
    }));
    assert_eq!(otra.len(), 2);
    assert!(otra
        .iter()
        .all(|&index| set.row(index as usize).source == "a.log"));
}

// ------------------------------------------------------------------- regex

const REGEX: &str = "\
2026-10-22 10:00:00 ERROR fallo 42 al guardar
2026-10-22 10:00:01 ERROR fallo 7 al abrir
2026-10-22 10:00:02 ERROR fallo grave al cerrar
2026-10-22 10:00:03 INFO todo correcto
";

#[test]
fn regex_valida_coincide_sin_distinguir_mayusculas() {
    let tabla = tabla_de("regex", REGEX);
    let filtro = filtro(vec![grupo(
        Conector::Y,
        vec![texto(Comparacion::Regex, "FALLO \\d+ al")],
    )]);

    assert_eq!(
        visibles(&tabla, REGEX, filtro),
        vec![
            "2026-10-22 10:00:00 ERROR fallo 42 al guardar",
            "2026-10-22 10:00:01 ERROR fallo 7 al abrir",
        ]
    );
}

#[test]
fn regex_invalida_no_coincide_pero_no_rompe() {
    let tabla = tabla_de("regex-invalida", REGEX);
    let filtro_invalido = filtro(vec![grupo(
        Conector::Y,
        vec![texto(Comparacion::Regex, "fallo [sin cerrar")],
    )]);
    assert!(
        visibles(&tabla, REGEX, filtro_invalido).is_empty(),
        "una regex que no compila no coincide nunca"
    );

    // Dentro de un grupo con O, el resto de condiciones sigue funcionando.
    let mixto = filtro(vec![grupo(
        Conector::O,
        vec![
            texto(Comparacion::Regex, "fallo [sin cerrar"),
            texto(Comparacion::Contiene, "correcto"),
        ],
    )]);
    assert_eq!(
        visibles(&tabla, REGEX, mixto),
        vec!["2026-10-22 10:00:03 INFO todo correcto"]
    );
}

// ------------------------------------------------------- compatibilidad

#[test]
fn un_filtro_vacio_no_restringe_y_el_filtro_de_siempre_sigue_igual() {
    let tabla = tabla_de("vacio", BASE);
    let set = LogSet::new(vec![fuente("unica.log", BASE)]);

    // `{}` desde la interfaz: `Filters` con todo a `None`.
    let vacio = Filters::default();
    assert!(!vacio.is_active());
    assert!(
        tabla.matching_indices(&vacio).is_empty(),
        "sin filtro, la tabla no calcula índices"
    );
    assert_eq!(
        set.visible(&vacio).len(),
        tabla.len(),
        "sin filtro se ve todo"
    );

    // Y también un `avanzado: {}` explícito, que llega del formulario vacío.
    let avanzado_vacio: Filters =
        serde_json::from_str(r#"{"levels":null,"text":null,"avanzado":{}}"#)
            .expect("deserializar filtro");
    assert!(avanzado_vacio.avanzado.is_some());
    assert!(!avanzado_vacio.is_active(), "un avanzado vacío no restringe");
    assert_eq!(set.visible(&avanzado_vacio).len(), 4);

    // Los filtros de siempre, intactos.
    let errores = tabla.matching_indices(&Filters {
        levels: Some(Level::Error.bit()),
        text: None,
        avanzado: None,
    });
    assert_eq!(errores, vec![0, 2]);

    let con_texto = tabla.matching_indices(&Filters {
        levels: None,
        text: Some("pago".to_string()),
        avanzado: None,
    });
    assert_eq!(con_texto, vec![0, 1, 2]);

    // Y combinados con el avanzado: primero lo barato, después el resto.
    let combinado = Filters {
        levels: Some(Level::Error.bit()),
        text: Some("pago".to_string()),
        avanzado: Some(filtro(vec![grupo(
            Conector::Y,
            vec![texto(Comparacion::Contiene, "aceptado")],
        )])),
    };
    assert_eq!(tabla.matching_indices(&combinado), vec![2]);
}

#[test]
fn el_filtro_avanzado_llega_con_nombres_camel_case() {
    let filtro: FiltroAvanzado = serde_json::from_str(
        r#"{
            "grupos": [
                {
                    "operador": "o",
                    "condiciones": [
                        {"campo": "nivel", "comparacion": "igual", "valor": "error", "negada": false},
                        {"campo": "texto", "comparacion": "empiezaPor", "valor": "pago", "negada": true}
                    ]
                }
            ],
            "desdeMs": 1000,
            "hastaMs": 2000,
            "horaDesde": 727,
            "horaHasta": 929,
            "fuentes": ["a.log"]
        }"#,
    )
    .expect("deserializar filtro avanzado");

    assert_eq!(filtro.grupos.len(), 1);
    assert_eq!(filtro.grupos[0].operador, Conector::O);
    assert_eq!(filtro.grupos[0].condiciones[0].campo, Campo::Nivel);
    assert_eq!(filtro.grupos[0].condiciones[1].campo, Campo::Texto);
    assert_eq!(
        filtro.grupos[0].condiciones[1].comparacion,
        Comparacion::EmpiezaPor
    );
    assert!(filtro.grupos[0].condiciones[1].negada);
    assert_eq!(filtro.desde_ms, Some(1000));
    assert_eq!(filtro.hasta_ms, Some(2000));
    assert_eq!(filtro.hora_desde, Some(727));
    assert_eq!(filtro.hora_hasta, Some(929));
    assert_eq!(filtro.fuentes, vec!["a.log".to_string()]);
}
