//! Filtro avanzado: el modelo que llega desde la interfaz y su evaluación en
//! el núcleo.
//!
//! ## Semántica (contrato)
//!
//! - Un [`FiltroAvanzado`] sin `grupos` **no restringe**. Un [`Grupo`] sin
//!   `condiciones` tampoco.
//! - Los grupos se unen entre sí con **Y**. Dentro de un grupo, las
//!   condiciones se unen con el `operador` del grupo (**Y** u **O**).
//! - `negada` invierte el resultado de esa condición.
//! - [`Campo::Texto`] compara contra **la entrada completa** (`raw`, todas sus
//!   líneas), sin distinguir mayúsculas: el mismo criterio que la búsqueda
//!   textual de siempre.
//! - [`Campo::Nivel`] compara contra el nombre del nivel (`info`, `error`…).
//! - [`Campo::Fuente`] compara contra el nombre del fichero de origen; en una
//!   vista combinada, el de cada fuente. Se compara sin distinguir mayúsculas.
//! - [`Comparacion::Regex`] se compila **una sola vez por pasada** y se trata
//!   sin distinguir mayúsculas. Si la expresión no compila, esa condición
//!   **no coincide nunca**: la vista se queda vacía pero no se rompe.
//! - `desde_ms`/`hasta_ms` son inclusivos y se comparan contra la **hora de
//!   pared** de la entrada (los dígitos que el usuario ve), no contra el
//!   instante real de la fuente. Si `desde_ms > hasta_ms` no entra nada. Las
//!   entradas **sin hora** quedan fuera en cuanto hay rango de fechas o franja
//!   horaria.
//! - La franja horaria son minutos del día (0..1439) tomados **de esa misma hora
//!   de pared**: un log escrito a las 10:00 entra en la franja de las 10:00
//!   aunque su instante real sea otro, y aunque el fichero venga de otra zona
//!   horaria. Con `hora_desde < hora_hasta` la ventana es normal (`>=` y
//!   `<=`); con `hora_desde > hora_hasta` **cruza medianoche** (`>=` o `<=`);
//!   si son iguales vale el **día completo**. Si solo viene un extremo, la
//!   ventana queda abierta por el otro lado.
//! - `fuentes` vacío = todas; con nombres, la entrada debe venir de una de
//!   esas fuentes.
//!
//! Lo caro (regex compiladas, agujas en minúsculas) se resuelve una vez por
//! pasada en [`FiltroListo`]. El modelo en sí ([`FiltroAvanzado`]) es
//! `Clone + PartialEq` para que la caché de la vista combinada siga funcionando
//! sin guardar nada compilado dentro.

use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};

use crate::index::EntryTable;
use crate::parser::NO_TS;

/// Cómo se combinan entre sí las condiciones de un grupo.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Conector {
    /// Todas las condiciones deben cumplirse.
    #[default]
    Y,
    /// Basta con que se cumpla una.
    O,
}

/// Dato de la entrada contra el que compara una condición.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Campo {
    /// Texto completo de la entrada, todas sus líneas.
    #[default]
    Texto,
    /// Nombre del nivel (`info`, `error`…).
    Nivel,
    /// Nombre del fichero de origen.
    Fuente,
}

/// Cómo se compara el valor de la condición con el dato de la entrada.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Comparacion {
    /// El dato contiene el valor.
    #[default]
    Contiene,
    /// El dato es exactamente el valor.
    Igual,
    /// El dato empieza por el valor.
    EmpiezaPor,
    /// El dato termina por el valor.
    TerminaPor,
    /// El valor es una expresión regular.
    Regex,
}

/// Una condición suelta. Todos los campos llevan valor por defecto para que
/// una condición incompleta no restrinja de más.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Condicion {
    pub campo: Campo,
    pub comparacion: Comparacion,
    pub valor: String,
    /// Invierte el resultado de esta condición.
    pub negada: bool,
}

/// Condiciones que se combinan entre sí con `operador`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Grupo {
    pub operador: Conector,
    pub condiciones: Vec<Condicion>,
}

/// Filtro avanzado tal y como lo manda la interfaz. Todos los campos son
/// opcionales: `{}` no restringe nada.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FiltroAvanzado {
    /// Grupos unidos entre sí con Y.
    pub grupos: Vec<Grupo>,
    /// Rango de fechas, ambos extremos inclusive (epoch en ms de la **hora de
    /// pared**, es decir, los dígitos que el usuario ve).
    pub desde_ms: Option<i64>,
    pub hasta_ms: Option<i64>,
    /// Franja horaria en minutos desde medianoche, sobre la hora de pared.
    pub hora_desde: Option<u32>,
    pub hora_hasta: Option<u32>,
    /// Nombres de fuente; vacío = todas.
    pub fuentes: Vec<String>,
}

impl FiltroAvanzado {
    /// ¿Este filtro puede descartar alguna entrada? Un filtro con grupos
    /// vacíos, sin fechas, sin franja efectiva y sin fuentes no restringe.
    pub fn restringe(&self) -> bool {
        self.hay_grupos()
            || self.desde_ms.is_some()
            || self.hasta_ms.is_some()
            || self.hora_restringe()
            || !self.fuentes.is_empty()
    }

    fn hay_grupos(&self) -> bool {
        self.grupos.iter().any(|grupo| !grupo.condiciones.is_empty())
    }

    /// La franja restringe salvo que esté vacía o cubra el día completo
    /// (`hora_desde == hora_hasta`).
    fn hora_restringe(&self) -> bool {
        match (self.hora_desde, self.hora_hasta) {
            (None, None) => false,
            (Some(desde), Some(hasta)) => desde != hasta,
            _ => true,
        }
    }

    /// ¿Hay que consultar la hora de la entrada? Solo entonces las entradas
    /// sin hora se descartan.
    fn usa_hora(&self) -> bool {
        self.desde_ms.is_some() || self.hasta_ms.is_some() || self.hora_restringe()
    }
}

// ------------------------------------------------------------ filtro listo

/// Una condición con lo caro ya resuelto: valor en minúsculas y, si toca,
/// la expresión regular compilada.
#[derive(Debug)]
struct CondicionLista {
    campo: Campo,
    comparacion: Comparacion,
    valor_lower: String,
    negada: bool,
    /// `None` con `Comparacion::Regex` significa que la expresión no compila:
    /// esa condición no coincide nunca.
    regex: Option<Regex>,
}

impl CondicionLista {
    fn nueva(condicion: &Condicion) -> CondicionLista {
        let regex = (condicion.comparacion == Comparacion::Regex)
            .then(|| {
                RegexBuilder::new(&condicion.valor)
                    .case_insensitive(true)
                    .build()
                    .ok()
            })
            .flatten();
        CondicionLista {
            campo: condicion.campo,
            comparacion: condicion.comparacion,
            valor_lower: condicion.valor.to_lowercase(),
            negada: condicion.negada,
            regex,
        }
    }

    fn coincide(&self, sujeto: &str) -> bool {
        let cumple = match self.comparacion {
            // La regex se compiló con `case_insensitive`, así que se aplica al
            // texto tal cual: el usuario puede seguir usando clases como
            // `[A-Z]`.
            Comparacion::Regex => self.regex.as_ref().is_some_and(|re| re.is_match(sujeto)),
            otra => {
                let bajo = sujeto.to_lowercase();
                match otra {
                    Comparacion::Contiene => bajo.contains(&self.valor_lower),
                    Comparacion::Igual => bajo == self.valor_lower,
                    Comparacion::EmpiezaPor => bajo.starts_with(&self.valor_lower),
                    Comparacion::TerminaPor => bajo.ends_with(&self.valor_lower),
                    Comparacion::Regex => unreachable!("la regex se resolvió arriba"),
                }
            }
        };
        cumple != self.negada
    }
}

/// Un grupo con sus condiciones ya preparadas.
#[derive(Debug)]
struct GrupoListo {
    operador: Conector,
    condiciones: Vec<CondicionLista>,
}

impl GrupoListo {
    fn coincide(
        &self,
        tabla: &EntryTable,
        index: usize,
        fuente: &str,
        raw: &mut Option<String>,
    ) -> bool {
        let mut acumulado: Option<bool> = None;
        for condicion in &self.condiciones {
            let sujeto = match condicion.campo {
                Campo::Nivel => tabla.level_at(index).name(),
                Campo::Fuente => fuente,
                Campo::Texto => {
                    let texto = raw.get_or_insert_with(|| tabla.raw_at(index));
                    texto.as_str()
                }
            };
            let valor = condicion.coincide(sujeto);
            acumulado = Some(match acumulado {
                None => valor,
                Some(previo) => match self.operador {
                    Conector::Y => previo && valor,
                    Conector::O => previo || valor,
                },
            });
            // Cortocircuito: con Y basta un fallo, con O basta un acierto.
            match self.operador {
                Conector::Y if !acumulado.unwrap_or(true) => return false,
                Conector::O if acumulado == Some(true) => return true,
                _ => {}
            }
        }
        acumulado.unwrap_or(true)
    }
}

/// Filtro avanzado con lo caro ya compilado. Se construye **una vez por
/// pasada** con [`FiltroListo::desde`] y después se consulta entrada a entrada.
#[derive(Debug)]
pub struct FiltroListo {
    grupos: Vec<GrupoListo>,
    desde_ms: Option<i64>,
    hasta_ms: Option<i64>,
    hora_desde: Option<u32>,
    hora_hasta: Option<u32>,
    /// Nombres de fuente en minúsculas.
    fuentes: Vec<String>,
    usa_hora: bool,
    restrictivo: bool,
}

impl FiltroListo {
    /// Compila lo caro del filtro. Devuelve `None` cuando el filtro no
    /// restringe nada: así la pasada no gasta ni memoria ni tiempo en él.
    pub fn desde(filtro: Option<&FiltroAvanzado>) -> Option<FiltroListo> {
        let filtro = filtro?;
        if !filtro.restringe() {
            return None;
        }
        Some(FiltroListo {
            grupos: filtro
                .grupos
                .iter()
                .filter(|grupo| !grupo.condiciones.is_empty())
                .map(|grupo| GrupoListo {
                    operador: grupo.operador,
                    condiciones: grupo.condiciones.iter().map(CondicionLista::nueva).collect(),
                })
                .collect(),
            desde_ms: filtro.desde_ms,
            hasta_ms: filtro.hasta_ms,
            hora_desde: filtro.hora_desde,
            hora_hasta: filtro.hora_hasta,
            fuentes: filtro.fuentes.iter().map(|f| f.to_lowercase()).collect(),
            usa_hora: filtro.usa_hora(),
            restrictivo: filtro.restringe(),
        })
    }

    /// ¿Descarta alguna entrada? Es equivalente a
    /// [`FiltroAvanzado::restringe`] sobre el filtro de origen.
    pub fn es_restrictivo(&self) -> bool {
        self.restrictivo
    }

    /// ¿La entrada `index` de `tabla`, que viene de la fuente `fuente`, pasa el
    /// filtro avanzado? `fuente` es el nombre del fichero de origen; en una
    /// tabla suelta se pasa `""`.
    ///
    /// El orden es de barato a caro: fuentes, hora (fechas y franja) y, por
    /// último, las condiciones, que son las que pueden llegar a mirar el texto
    /// completo de la entrada.
    pub fn coincide(&mut self, tabla: &EntryTable, index: usize, fuente: &str) -> bool {
        if !self.restrictivo {
            return true;
        }
        if !self.fuentes.is_empty()
            && !self
                .fuentes
                .iter()
                .any(|nombre| nombre.eq_ignore_ascii_case(fuente))
        {
            return false;
        }
        if self.usa_hora && !self.hora_entra(tabla.ts_at(index)) {
            return false;
        }
        if self.grupos.is_empty() {
            return true;
        }

        let mut raw: Option<String> = None;
        for grupo in &self.grupos {
            if !grupo.coincide(tabla, index, fuente, &mut raw) {
                return false;
            }
        }
        true
    }

    /// Fechas y franja horaria, ambas contra la hora de pared de la entrada:
    /// es lo que el usuario ve en pantalla, así que es con lo que compara. Una
    /// entrada sin hora no entra nunca en un filtro que use la hora.
    fn hora_entra(&self, pared_ms: i64) -> bool {
        if pared_ms == NO_TS {
            return false;
        }
        if let Some(desde) = self.desde_ms {
            if pared_ms < desde {
                return false;
            }
        }
        if let Some(hasta) = self.hasta_ms {
            if pared_ms > hasta {
                return false;
            }
        }
        if self.hora_desde.is_none() && self.hora_hasta.is_none() {
            return true;
        }
        let minuto = minuto_de_pared(pared_ms);
        entra_en_franja(minuto, self.hora_desde, self.hora_hasta)
    }
}

/// Ventana de minutos del día. Ver la semántica al principio del módulo.
fn entra_en_franja(minuto: u32, desde: Option<u32>, hasta: Option<u32>) -> bool {
    match (desde, hasta) {
        (None, None) => true,
        (Some(desde), None) => minuto >= desde,
        (None, Some(hasta)) => minuto <= hasta,
        // Misma hora: vale el día completo.
        (Some(desde), Some(hasta)) if desde == hasta => true,
        (Some(desde), Some(hasta)) if desde < hasta => minuto >= desde && minuto <= hasta,
        // Cruza medianoche: de 22:00 a 02:00 vale 23:30 y 01:00.
        (Some(desde), Some(hasta)) => minuto >= desde || minuto <= hasta,
    }
}

/// Minuto del día (0..1439) de la hora de pared `pared_ms`.
///
/// La hora de pared se guarda «como si fuera UTC», así que sus dígitos ya son
/// los del fichero: basta quedarse con la parte del día, sin desfacer ningún
/// desfase.
fn minuto_de_pared(pared_ms: i64) -> u32 {
    pared_ms.div_euclid(60_000).rem_euclid(1440) as u32
}
