use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

use chrono::{DateTime, NaiveDate};
use serde::Deserialize;

use crate::encoding::{tiene_multibyte_valido, Decoder as TextDecoder, Encoding as TextEncoding};
use crate::filtro::{FiltroAvanzado, FiltroListo};
use crate::model::{Field, Level, Row};
use crate::parser::{local_offset_seconds, LogParser, NO_TS};

/// Tope de líneas por entrada: un log sin instantes no debe acabar siendo una
/// única entrada de un millón de líneas.
const MAX_ENTRY_LINES: u32 = 64;

pub struct EntryTable {
    arena: Vec<u8>,
    starts: Vec<u32>,
    lens: Vec<u32>,
    /// Hora de pared de cada entrada, expresada «como si fuera UTC»: los
    /// dígitos que trae el fichero, sin desfase de zona. **No es un instante
    /// real**: para eso está [`EntryTable::instant_at`], que aplica [`Self::zona`].
    ts: Vec<i64>,
    level: Vec<u8>,
    line_nos: Vec<u32>,
    pending: Vec<u8>,
    consumed: u64,
    parser: Arc<dyn LogParser>,
    /// Zona horaria del fichero, en minutos de desplazamiento respecto de UTC.
    /// `None` = la del equipo. Se fija antes de ingerir.
    zona: Option<i32>,
    /// Líneas físicas leídas, para numerar el inicio de cada entrada.
    lines_seen: u32,
    /// Líneas que lleva la entrada en construcción.
    last_entry_lines: u32,
    /// Conversión a UTF-8 cuando el fichero no lo es (UTF-16 de eMule, .NET…).
    decoder: TextDecoder,
    /// Codificación pedida al abrir; `Auto` deja decidir a la detección.
    encoding: TextEncoding,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize)]
#[serde(default)]
pub struct Filters {
    /// Máscara de niveles; `None` equivale a todos.
    pub levels: Option<u8>,
    /// Búsqueda textual sin distinguir mayúsculas.
    pub text: Option<String>,
    /// Filtro avanzado, ya evaluado por el núcleo. Se guarda como modelo (sin
    /// nada compilado) para que `PartialEq` siga sirviendo de clave de caché.
    pub avanzado: Option<FiltroAvanzado>,
}

impl Filters {
    pub fn is_active(&self) -> bool {
        self.levels.is_some_and(|m| m != crate::model::ALL_LEVELS)
            || self.text.as_ref().is_some_and(|t| !t.is_empty())
            || self.avanzado.as_ref().is_some_and(FiltroAvanzado::restringe)
    }
}

/// Búsqueda sin distinguir mayúsculas sobre bytes, sin asignar memoria.
/// Solo pliega ASCII: si la aguja lleva caracteres no ASCII se usa la ruta
/// Unicode, que sí asigna pero es correcta con acentos.
fn contains_ignore_ascii_case(haystack: &[u8], needle: &[u8]) -> bool {
    if needle.is_empty() {
        return true;
    }
    if needle.len() > haystack.len() {
        return false;
    }
    let last = haystack.len() - needle.len();
    for start in 0..=last {
        if !haystack[start].eq_ignore_ascii_case(&needle[0]) {
            continue;
        }
        if haystack[start..start + needle.len()]
            .iter()
            .zip(needle)
            .all(|(a, b)| a.eq_ignore_ascii_case(b))
        {
            return true;
        }
    }
    false
}

fn decode(bytes: &[u8]) -> String {
    // Los logs de Windows suelen empezar con BOM; si se deja, la primera línea
    // no empieza por dígito y no se le reconoce el instante.
    let bytes = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(bytes);
    match std::str::from_utf8(bytes) {
        Ok(text) => text.to_string(),
        Err(_) => {
            // Una línea UTF-8 con un byte corrupto no debe reescribirse entera
            // en Windows-1252 («sesiÃ³n»): si hay UTF-8 multibyte válido, se
            // sustituye solo lo que está mal. Un texto de 8 bits no tiene ni
            // una sola secuencia multibyte válida.
            if tiene_multibyte_valido(bytes) {
                return String::from_utf8_lossy(bytes).into_owned();
            }
            let (cow, _, _) = encoding_rs::WINDOWS_1252.decode(bytes);
            cow.into_owned()
        }
    }
}


impl EntryTable {
    pub fn new(parser: Arc<dyn LogParser>) -> Self {
        Self::with_encoding(parser, TextEncoding::Auto)
    }

    /// Igual que `new`, pero forzando la codificación del fichero.
    pub fn with_encoding(parser: Arc<dyn LogParser>, encoding: TextEncoding) -> Self {
        EntryTable {
            arena: Vec::new(),
            starts: Vec::new(),
            lens: Vec::new(),
            ts: Vec::new(),
            level: Vec::new(),
            line_nos: Vec::new(),
            pending: Vec::new(),
            consumed: 0,
            parser,
            zona: None,
            lines_seen: 0,
            last_entry_lines: 0,
            decoder: TextDecoder::passthrough(),
            encoding,
        }
    }

    /// Codificación con la que se está leyendo de verdad, ya resuelta.
    pub fn encoding_name(&self) -> &'static str {
        self.decoder.encoding().name()
    }

    pub fn len(&self) -> usize {
        self.lens.len()
    }

    pub fn is_empty(&self) -> bool {
        self.lens.is_empty()
    }

    pub fn consumed(&self) -> u64 {
        self.consumed
    }

    pub fn field_names(&self) -> Vec<String> {
        self.parser.field_names().to_vec()
    }

    pub fn parser_name(&self) -> &'static str {
        self.parser.name()
    }

    /// ¿Alguna entrada de la tabla tiene instante? Sirve para impedir combinar
    /// un log con fecha y hora con otro que no la tenga: ese no se puede
    /// intercalar, solo amontonar al final.
    pub fn has_timestamps(&self) -> bool {
        self.ts.iter().any(|&value| value != NO_TS)
    }

    pub fn reset(&mut self) {
        self.arena.clear();
        self.starts.clear();
        self.lens.clear();
        self.ts.clear();
        self.level.clear();
        self.line_nos.clear();
        self.pending.clear();
        self.consumed = 0;
        self.lines_seen = 0;
        self.last_entry_lines = 0;
        // Tras una rotación el fichero nuevo puede tener otra codificación.
        self.decoder = TextDecoder::passthrough();
    }

    pub fn ts_at(&self, index: usize) -> i64 {
        self.ts[index]
    }

    /// Fija la zona horaria del fichero: minutos de desplazamiento respecto de
    /// UTC (`Some(120)` = UTC+2). `None` deja la zona del equipo. Se llama
    /// antes de ingerir; el valor no depende de las entradas ya leídas.
    pub fn set_zona(&mut self, zona: Option<i32>) {
        self.zona = zona;
    }

    /// Zona horaria con la que se interpretan las horas de pared del fichero.
    pub fn zona(&self) -> Option<i32> {
        self.zona
    }

    /// Instante real de la entrada `index`: la hora de pared menos el desfase de
    /// la zona del fichero. Es lo que sirve para ordenar y para mezclar fuentes
    /// escritas en zonas distintas. `NO_TS` si la entrada no trae hora.
    pub fn instant_at(&self, index: usize) -> i64 {
        let pared = self.ts[index];
        if pared == NO_TS {
            return NO_TS;
        }
        match self.zona {
            Some(minutos) => pared - minutos as i64 * 60_000,
            // Sin zona propia, la del equipo: se resuelve por día, que es lo
            // correcto aunque el log cruce un cambio de hora.
            None => pared - local_offset_seconds(fecha_de_pared(pared)) as i64 * 1000,
        }
    }

    /// Diferencia entre el instante real de esta entrada y el de la anterior
    /// del fichero. `None` si la entrada no trae hora, si es la primera con
    /// hora o si la anterior no la tenía: la serie se corta en el hueco en vez
    /// de saltar por encima de él.
    ///
    /// Es una resta de instantes reales (con la zona del fichero), así que un
    /// cambio de hora no la falsea.
    pub fn delta_at(&self, index: usize) -> Option<i64> {
        let actual = self.instant_at(index);
        if actual == NO_TS || index == 0 {
            return None;
        }
        let anterior = self.instant_at(index - 1);
        if anterior == NO_TS {
            return None;
        }
        Some(actual - anterior)
    }

    fn push_line(&mut self, text: &str) {
        let line_no = self.lines_seen;
        let parsed = self.parser.parse(text);
        let start = self.arena.len() as u32;
        self.arena.extend_from_slice(text.as_bytes());
        self.starts.push(start);
        self.lens.push(text.len() as u32);
        self.ts.push(parsed.ts_ms.unwrap_or(NO_TS));
        self.level.push(parsed.level.as_u8());
        self.line_nos.push(line_no);
    }

    /// Añade una línea de continuación a la entrada en construcción.
    /// `position` es su índice dentro de la entrada (0 = primera línea).
    fn append_to_last(&mut self, text: &str, position: usize) {
        if self.lens.is_empty() {
            self.push_line(text);
            self.last_entry_lines = 1;
            return;
        }
        let index = self.lens.len() - 1;
        self.arena.extend_from_slice(b"\n");
        self.arena.extend_from_slice(text.as_bytes());
        self.lens[index] += 1 + text.len() as u32;

        // El instante y el nivel pueden aparecer en una línea de continuación,
        // así que se completan si aún faltan. Se interpreta con su posición
        // real dentro de la entrada.
        let parsed = self.parser.parse_line_at(text, position);
        if self.ts[index] == NO_TS {
            if let Some(ts) = parsed.ts_ms {
                self.ts[index] = ts;
            }
        }
        if self.level[index] == Level::Unknown.as_u8() && parsed.level != Level::Unknown {
            self.level[index] = parsed.level.as_u8();
        }
    }

    /// Decide si la línea abre entrada o continúa la anterior.
    fn push_entry_line(&mut self, text: &str) {
        let position = self.last_entry_lines as usize;
        self.lines_seen += 1;
        let starts = self.lens.is_empty()
            || self.parser.starts_entry(text)
            || self.last_entry_lines >= MAX_ENTRY_LINES;
        if starts {
            self.push_line(text);
            self.last_entry_lines = 1;
        } else {
            self.append_to_last(text, position);
            self.last_entry_lines += 1;
        }
    }

    /// Ingiere un bloque de bytes, conservando la línea incompleta final.
    pub fn ingest_bytes(&mut self, bytes: &[u8]) {
        // La codificación se decide con el primer bloque: los ficheros UTF-16
        // (eMule, .NET) llegarían con un cero entre cada letra y no se
        // reconocería ni el instante.
        if self.consumed == 0 {
            self.decoder = TextDecoder::new(self.encoding, bytes);
        }

        // `consumed` cuenta SIEMPRE bytes del fichero, no del texto convertido:
        // el tail calcula desde ahí la posición de lectura.
        self.consumed += bytes.len() as u64;

        let convertido = self.decoder.decode(bytes);
        let bytes = match &convertido {
            Some(texto) => texto.as_bytes(),
            None => bytes,
        };

        self.pending.extend_from_slice(bytes);

        let mut start = 0usize;
        for i in 0..self.pending.len() {
            if self.pending[i] != b'\n' {
                continue;
            }
            let mut end = i;
            if end > start && self.pending[end - 1] == b'\r' {
                end -= 1;
            }
            let text = decode(&self.pending[start..end]);
            self.push_entry_line(&text);
            start = i + 1;
        }
        if start > 0 {
            self.pending.drain(..start);
        }
    }

    /// Columnas que de verdad traen datos en las primeras entradas.
    ///
    /// Sin esto se muestran cabeceras para campos que el fichero nunca usa:
    /// un log de cuatro líneas acababa con seis cabeceras.
    pub fn present_fields(&self, limit: usize) -> Vec<String> {
        let declared = self.parser.field_names();
        let mut seen: Vec<String> = Vec::new();
        let count = self.len().min(limit);

        for index in 0..count {
            if seen.len() == declared.len() {
                break;
            }
            for (name, value) in self.parser.parse(&self.raw_of(index)).fields {
                if !value.trim().is_empty() && !seen.iter().any(|n| *n == name) {
                    seen.push(name);
                }
            }
        }

        declared
            .iter()
            .filter(|name| seen.iter().any(|s| s == *name))
            .cloned()
            .collect()
    }

    /// Índices visibles bajo el filtro indicado.
    pub fn matching_indices(&self, filters: &Filters) -> Vec<u32> {
        if !filters.is_active() {
            return Vec::new();
        }
        let needle_lower = filters
            .text
            .as_ref()
            .filter(|t| !t.is_empty())
            .map(|t| t.to_lowercase());
        let ascii_only = needle_lower.as_deref().is_some_and(str::is_ascii);
        // Lo caro del filtro avanzado se compila una sola vez por pasada.
        let mut avanzado = FiltroListo::desde(filters.avanzado.as_ref());

        (0..self.len())
            .filter(|index| {
                self.matches_entry(
                    *index,
                    filters,
                    needle_lower.as_deref(),
                    ascii_only,
                    avanzado.as_mut(),
                    "",
                )
            })
            .map(|index| index as u32)
            .collect()
    }

    /// ¿La entrada `index` pasa el filtro? Lo usan tanto la tabla suelta como
    /// la vista combinada.
    ///
    /// `avanzado` es el filtro avanzado ya compilado (una sola vez por pasada)
    /// y `fuente` el nombre del fichero de origen, necesario para las
    /// condiciones de fuente; en una tabla suelta se pasa `""`. El orden es de
    /// barato a caro: niveles, texto y, al final, el filtro avanzado.
    pub fn matches_entry(
        &self,
        index: usize,
        filters: &Filters,
        needle_lower: Option<&str>,
        ascii_only: bool,
        avanzado: Option<&mut FiltroListo>,
        fuente: &str,
    ) -> bool {
        if let Some(mask) = filters.levels {
            if mask & (1u8 << self.level[index].min(6)) == 0 {
                return false;
            }
        }
        if let Some(needle) = needle_lower {
            let start = self.starts[index] as usize;
            let len = self.lens[index] as usize;
            let bytes = &self.arena[start..start + len];
            let hit = if ascii_only {
                contains_ignore_ascii_case(bytes, needle.as_bytes())
            } else {
                decode(bytes).to_lowercase().contains(needle)
            };
            if !hit {
                return false;
            }
        }
        if let Some(listo) = avanzado {
            if !listo.coincide(self, index, fuente) {
                return false;
            }
        }
        true
    }

    /// Nombre del nivel de la entrada, sin volver a parsearla.
    pub fn level_at(&self, index: usize) -> Level {
        Level::from_u8(self.level[index])
    }

    /// Texto completo de la entrada (todas sus líneas), ya decodificado.
    pub fn raw_at(&self, index: usize) -> String {
        self.raw_of(index)
    }

    fn raw_of(&self, index: usize) -> String {
        let start = self.starts[index] as usize;
        let len = self.lens[index] as usize;
        decode(&self.arena[start..start + len])
    }

    pub fn row(&self, index: usize) -> Row {
        let raw = self.raw_of(index);
        let parsed = self.parser.parse(&raw);
        let pared = self.ts[index];
        let (fecha, hora) = columnas_de_pared(pared);
        Row {
            index: index as u32,
            line_no: self.line_nos[index],
            ts_ms: if pared == NO_TS { None } else { Some(pared) },
            fecha,
            hora,
            delta_ms: self.delta_at(index),
            level: Level::from_u8(self.level[index]),
            fields: parsed
                .fields
                .into_iter()
                .map(|(name, value)| Field { name, value })
                .collect(),
            raw,
            source: String::new(),
        }
    }

    /// Página de la vista: `visible` contiene los índices reales ya filtrados.
    pub fn page(&self, visible: &[u32], start: usize, count: usize) -> Vec<Row> {
        let end = (start + count).min(visible.len());
        if start >= end {
            return Vec::new();
        }
        visible[start..end]
            .iter()
            .map(|&index| self.row(index as usize))
            .collect()
    }
}

// ------------------------------------------------------------- hora de pared

/// Fecha de una hora de pared (guardada «como si fuera UTC»).
fn fecha_de_pared(pared_ms: i64) -> NaiveDate {
    DateTime::from_timestamp_millis(pared_ms)
        .map(|dt| dt.naive_utc().date())
        .unwrap_or_default()
}

/// Fecha y hora tal y como están escritas en el fichero, formateadas desde la
/// hora de pared como si fuera UTC: ni se reformatean a la zona del equipo ni
/// a la del fichero, para que se vean los mismos dígitos que hay en el log.
fn columnas_de_pared(pared_ms: i64) -> (Option<String>, Option<String>) {
    if pared_ms == NO_TS {
        return (None, None);
    }
    match DateTime::from_timestamp_millis(pared_ms) {
        Some(dt) => (
            Some(dt.format("%Y-%m-%d").to_string()),
            Some(dt.format("%H:%M:%S%.3f").to_string()),
        ),
        None => (None, None),
    }
}

// ---------------------------------------------------------------- LogSet

/// Una fuente del conjunto: un fichero con su propio parser ya detectado.
pub struct Source {
    pub name: String,
    pub table: EntryTable,
}

/// Conjunto de uno o varios ficheros. Con una sola fuente se comporta como la
/// tabla suelta (orden de lectura). Con varias, las entradas se ordenan por
/// **instante real** (hora de pared con la zona de cada fuente), y las que no
/// tienen hora quedan al final.
pub struct LogSet {
    pub sources: Vec<Source>,
    /// (instante, índice de fuente, índice de entrada)
    order: Vec<(i64, u32, u32)>,
    /// Cuántas entradas de cada fuente están ya dentro de `order`. Las nuevas
    /// son `synced[fuente]..tabla.len()`, que es lo que mira [`LogSet::sync_merged`]
    /// para no recorrer lo ya ordenado.
    synced: Vec<usize>,
    merged: bool,
    cache: Mutex<Option<(Filters, Arc<Vec<u32>>)>>,
    /// Cambia cada vez que se ingieren entradas nuevas por el tail.
    generation: AtomicU32,
}

impl LogSet {
    pub fn new(sources: Vec<Source>) -> LogSet {
        let merged = sources.len() > 1;
        let order = Self::build_order(&sources, merged);
        let synced = sources
            .iter()
            .map(|source| source.table.len())
            .collect();

        LogSet {
            sources,
            order,
            synced,
            merged,
            cache: Mutex::new(None),
            generation: AtomicU32::new(1),
        }
    }

    /// Orden completo de la vista, de cero. Con varias fuentes se ordena por
    /// instante real; con una sola se respeta el orden de lectura.
    fn build_order(sources: &[Source], merged: bool) -> Vec<(i64, u32, u32)> {
        if !merged {
            let entries = sources.first().map(|source| source.table.len()).unwrap_or(0);
            return (0..entries).map(|entry| (0, 0, entry as u32)).collect();
        }

        let mut order: Vec<(i64, u32, u32)> = Vec::new();
        for (source_index, source) in sources.iter().enumerate() {
            for entry in 0..source.table.len() {
                order.push((
                    source.table.instant_at(entry),
                    source_index as u32,
                    entry as u32,
                ));
            }
        }
        // Los sin instante, al final y en el orden en que se leyeron.
        // A igualdad de instante manda el número de entrada y después la
        // fuente: así las líneas de ficheros distintos se entremezclan en
        // ronda (a0, b0, a1, b1…) en vez de agruparse por fichero.
        order.sort_by(|a, b| {
            let a_sin = a.0 == NO_TS;
            let b_sin = b.0 == NO_TS;
            a_sin
                .cmp(&b_sin)
                .then(a.0.cmp(&b.0))
                .then(a.2.cmp(&b.2))
                .then(a.1.cmp(&b.1))
        });
        order
    }

    /// Posición donde insertar una entrada de instante `instante`: **después**
    /// de todas las que tienen ese mismo instante (cota superior) y antes de
    /// las que no tienen hora, que van al final.
    fn position_for_instant(&self, instant: i64) -> usize {
        let sin_instante = instant == NO_TS;
        self.order
            .partition_point(|&(otro, _, _)| (otro == NO_TS, otro) <= (sin_instante, instant))
    }

    pub fn len(&self) -> usize {
        self.order.len()
    }

    pub fn is_empty(&self) -> bool {
        self.order.is_empty()
    }

    pub fn is_merged(&self) -> bool {
        self.merged
    }

    pub fn source_names(&self) -> Vec<String> {
        self.sources.iter().map(|source| source.name.clone()).collect()
    }

    /// Instante real de la fila visible `index`, con la zona de su fuente.
    ///
    /// `Row::ts_ms` es la hora de pared (los dígitos del fichero); esto es lo que
    /// sirve para ordenar, para el Delta Time y para comparar fuentes.
    pub fn instant_at(&self, index: usize) -> i64 {
        match self.order.get(index) {
            Some(&(_, origen, entrada)) => match self.sources.get(origen as usize) {
                Some(source) => source.table.instant_at(entrada as usize),
                None => NO_TS,
            },
            None => NO_TS,
        }
    }

    pub fn consumed(&self) -> u64 {
        self.sources.iter().map(|source| source.table.consumed()).sum()
    }

    pub fn parser_name(&self) -> String {
        let mut names: Vec<&str> = self
            .sources
            .iter()
            .map(|source| source.table.parser_name())
            .collect();
        names.dedup();
        names.join("+")
    }

    /// Codificación ya resuelta de la primera fuente (es la que se muestra en
    /// la barra). Un fichero vacío no tiene ninguna: se anuncia UTF-8.
    pub fn encoding_name(&self) -> String {
        self.sources
            .first()
            .map(|source| source.table.encoding_name().to_string())
            .unwrap_or_else(|| "utf8".to_string())
    }

    pub fn generation(&self) -> u32 {
        self.generation.load(Ordering::SeqCst)
    }

    pub fn invalidate(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        if let Ok(mut cache) = self.cache.lock() {
            *cache = None;
        }
    }

    /// Tras ingerir por el tail en una única fuente, añade los índices nuevos.
    pub fn sync_single_source(&mut self) {
        if self.merged {
            return;
        }
        let Some(source) = self.sources.first() else {
            return;
        };
        let entries = source.table.len();
        for entry in self.order.len()..entries {
            self.order.push((0, 0, entry as u32));
        }
        if let Some(synced) = self.synced.first_mut() {
            *synced = entries;
        }
        self.invalidate();
    }

    /// Incorpora al `order` las entradas nuevas de **todas** las fuentes de una
    /// vista combinada, cada una en su sitio por instante real, con búsqueda
    /// binaria. Devuelve la **posición mínima** en la que se insertó algo (la
    /// interfaz la necesita para saber si la selección sigue siendo válida), o
    /// `None` si no había nada nuevo.
    ///
    /// **Empates**: una línea nueva con el mismo instante que otras se coloca
    /// *después* de las que ya estaban (cota superior) y, entre las nuevas de
    /// ese instante, por `(fuente, entrada)`. La ronda perfecta entre fuentes
    /// —`a0, b0, a1, b1`— solo se garantiza al construir la vista
    /// ([`LogSet::new`]) o al reconstruirla ([`LogSet::rebuild_order`]); lo que
    /// entra en vivo se añade al final de su grupo de instante.
    ///
    /// El coste depende solo de lo nuevo: nada de reordenar el `order` entero
    /// en cada línea. Si alguna tabla se reinició sin reconstruir el orden, se
    /// reconstruye aquí (es el único caso caro, y solo pasa al rotar).
    pub fn sync_merged(&mut self) -> Option<usize> {
        if !self.merged {
            return None;
        }

        // Una tabla que encogió (reset sin `rebuild_order`) deja índices
        // colgando: no hay forma barata de saber cuáles sobran.
        let encogio = self
            .sources
            .iter()
            .enumerate()
            .any(|(index, source)| source.table.len() < self.synced[index]);
        if encogio {
            self.rebuild_order();
            return Some(0);
        }

        // Se recogen primero las nuevas, ya en orden `(fuente, entrada)`, para
        // no tener el conjunto prestado a la vez en lectura y escritura.
        let mut nuevas: Vec<(i64, u32, u32)> = Vec::new();
        for (source_index, source) in self.sources.iter().enumerate() {
            for entry in self.synced[source_index]..source.table.len() {
                nuevas.push((
                    source.table.instant_at(entry),
                    source_index as u32,
                    entry as u32,
                ));
            }
        }
        if nuevas.is_empty() {
            return None;
        }

        let mut minimo: Option<usize> = None;
        for (instant, source_index, entry) in nuevas {
            let position = self.position_for_instant(instant);
            self.order.insert(position, (instant, source_index, entry));
            minimo = Some(minimo.map_or(position, |actual| actual.min(position)));
        }
        for (index, source) in self.sources.iter().enumerate() {
            self.synced[index] = source.table.len();
        }
        self.invalidate();
        minimo
    }

    /// Reconstruye el `order` desde cero con el mismo criterio que
    /// [`LogSet::new`]. **Es caro** (ordena todas las entradas de todas las
    /// fuentes), así que solo se usa cuando el orden deja de ser válido: al
    /// rotar o truncar una fuente de la vista combinada.
    pub fn rebuild_order(&mut self) {
        self.order = Self::build_order(&self.sources, self.merged);
        self.synced = self
            .sources
            .iter()
            .map(|source| source.table.len())
            .collect();
        self.invalidate();
    }

    /// Reinicia la fuente `index` (rotación o truncado del fichero) y
    /// reconstruye el orden, que deja de ser válido en cuanto se vacía una
    /// tabla.
    pub fn reset_source(&mut self, index: usize) {
        if let Some(source) = self.sources.get_mut(index) {
            source.table.reset();
        }
        self.rebuild_order();
    }

    /// Tras un truncado o una rotación del fichero seguido.
    pub fn reset_single_source(&mut self) {
        if let Some(source) = self.sources.first_mut() {
            source.table.reset();
        }
        self.order.clear();
        self.invalidate();
    }

    /// Diferencia entre el instante real de la fila visible `index` y el de la
    /// fila anterior de la vista (la del fichero si hay una sola fuente, la del
    /// orden combinado si hay varias). `None` si la fila no tiene hora, si es la
    /// primera con hora o si la anterior no la tenía.
    ///
    /// **No depende de los filtros**: se calcula sobre posiciones del orden
    /// completo, no sobre las filas visibles.
    pub fn delta_at(&self, index: usize) -> Option<i64> {
        let actual = self.instant_at(index);
        if actual == NO_TS || index == 0 {
            return None;
        }
        let anterior = self.instant_at(index - 1);
        if anterior == NO_TS {
            return None;
        }
        Some(actual - anterior)
    }

    pub fn row(&self, index: usize) -> Row {
        let (_, source_index, entry) = self.order[index];
        let source = &self.sources[source_index as usize];
        let mut row = source.table.row(entry as usize);
        row.index = index as u32;
        // En la vista combinada la fila anterior puede ser de otra fuente: el
        // delta se recalcula sobre el orden combinado, no sobre el fichero.
        row.delta_ms = self.delta_at(index);
        row.source = if self.merged {
            source.name.clone()
        } else {
            String::new()
        };
        row
    }

    pub fn page(&self, visible: &[u32], start: usize, count: usize) -> Vec<Row> {
        let end = (start + count).min(visible.len());
        if start >= end {
            return Vec::new();
        }
        visible[start..end]
            .iter()
            .map(|&index| self.row(index as usize))
            .collect()
    }

    /// Campos presentes de todas las fuentes, en el orden en que los declara
    /// cada parser y sin repetir.
    pub fn present_fields(&self, limit: usize) -> Vec<String> {
        let mut fields: Vec<String> = Vec::new();
        for source in &self.sources {
            for name in source.table.present_fields(limit) {
                if !fields.contains(&name) {
                    fields.push(name);
                }
            }
        }
        fields
    }

    /// Índices visibles bajo el filtro, con caché invalidada al crecer.
    pub fn visible(&self, filters: &Filters) -> Arc<Vec<u32>> {
        if let Ok(cache) = self.cache.lock() {
            if let Some((cached, list)) = cache.as_ref() {
                if cached == filters {
                    return Arc::clone(list);
                }
            }
        }

        let needle_lower = filters
            .text
            .as_ref()
            .filter(|t| !t.is_empty())
            .map(|t| t.to_lowercase());
        let ascii_only = needle_lower.as_deref().is_some_and(str::is_ascii);
        let mut avanzado = FiltroListo::desde(filters.avanzado.as_ref());

        let list: Vec<u32> = if filters.is_active() {
            (0..self.order.len())
                .filter(|index| {
                    let (_, source_index, entry) = self.order[*index];
                    let source = &self.sources[source_index as usize];
                    source.table.matches_entry(
                        entry as usize,
                        filters,
                        needle_lower.as_deref(),
                        ascii_only,
                        avanzado.as_mut(),
                        &source.name,
                    )
                })
                .map(|index| index as u32)
                .collect()
        } else {
            (0..self.order.len() as u32).collect()
        };

        let arc = Arc::new(list);
        if let Ok(mut cache) = self.cache.lock() {
            *cache = Some((filters.clone(), Arc::clone(&arc)));
        }
        arc
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::{AutoParser, BasicParser};

    fn table() -> EntryTable {
        let mut t = EntryTable::new(BasicParser::new());
        t.ingest_bytes(b"2026-10-22 10:00:00 INFO arranque\n2026-10-22 10:00:01 ERROR fallo\n");
        t
    }

    #[test]
    fn ingiere_dos_lineas() {
        let t = table();
        assert_eq!(t.len(), 2);
        assert_eq!(t.row(1).level, Level::Error);
    }

    #[test]
    fn conserva_linea_incompleta() {
        let mut t = EntryTable::new(BasicParser::new());
        t.ingest_bytes(b"linea a medias");
        assert_eq!(t.len(), 0);
        t.ingest_bytes(b" que termina\n");
        assert_eq!(t.len(), 1);
    }

    #[test]
    fn filtra_por_nivel() {
        let t = table();
        let f = Filters {
            levels: Some(Level::Error.bit()),
            text: None,
            avanzado: None,
        };
        assert_eq!(t.matching_indices(&f), vec![1]);
    }

    #[test]
    fn auto_agrupa_entradas_de_varias_lineas() {
        let mut t = EntryTable::new(AutoParser::new());
        t.ingest_bytes(
            b"2026-10-23 01:23:49.683\nunknown\ninfo\nlogger.x: mensaje uno\n\
              2026-10-23 01:23:50.000\nunknown\nerror\nlogger.y: mensaje dos\n",
        );

        assert_eq!(t.len(), 2, "cuatro líneas físicas por entrada, dos entradas");

        let first = t.row(0);
        assert_eq!(first.line_no, 1);
        assert_eq!(first.level, Level::Info);
        assert!(first.ts_ms.is_some());
        let mensaje = |row: &crate::model::Row| {
            row.fields
                .iter()
                .find(|f| f.name == "Message")
                .map(|f| f.value.clone())
                .unwrap_or_default()
        };
        assert_eq!(mensaje(&first), "mensaje uno");

        let second = t.row(1);
        assert_eq!(second.line_no, 5, "la segunda entrada empieza en la línea 5");
        assert_eq!(second.level, Level::Error);
        assert_eq!(mensaje(&second), "mensaje dos", "no arrastra la anterior");
    }

    #[test]
    fn auto_mantiene_una_entrada_por_linea_si_cada_linea_trae_instante() {
        let mut t = EntryTable::new(AutoParser::new());
        t.ingest_bytes(b"2026-10-22 10:00:00 INFO arranque\n2026-10-22 10:00:01 ERROR fallo\n");
        assert_eq!(t.len(), 2);
        assert_eq!(t.row(1).level, Level::Error);
    }

    #[test]
    fn basic_sigue_agrupando_una_linea_por_entrada() {
        let t = table();
        assert_eq!(t.len(), 2);
    }

    #[test]
    fn las_columnas_llevan_los_digitos_del_fichero() {
        let mut t = EntryTable::new(BasicParser::new());
        t.ingest_bytes(b"2026-10-22 08:19:59,826 INFO arranque\n");

        let row = t.row(0);
        assert_eq!(row.fecha.as_deref(), Some("2026-10-22"));
        assert_eq!(
            row.hora.as_deref(),
            Some("08:19:59.826"),
            "la hora de la columna es la escrita, con milisegundos"
        );
        // `ts_ms` se queda como estaba para no romper la interfaz actual, pero
        // ahora guarda la hora de pared, no un instante real.
        assert_eq!(row.ts_ms, Some(t.ts_at(0)));
    }

    #[test]
    fn sin_hora_no_hay_columnas_de_fecha_ni_hora() {
        let mut t = EntryTable::new(BasicParser::new());
        t.ingest_bytes(b"linea suelta sin instante\n");

        let row = t.row(0);
        assert_eq!(row.ts_ms, None);
        assert_eq!(row.fecha, None);
        assert_eq!(row.hora, None);
    }

    #[test]
    fn instant_at_aplica_la_zona_del_fichero() {
        let mut t = EntryTable::new(BasicParser::new());
        t.ingest_bytes(b"2026-10-22 10:00:00 INFO uno\n");
        let pared = t.ts_at(0);

        // UTC: el instante real coincide con los dígitos escritos.
        t.set_zona(Some(0));
        assert_eq!(t.instant_at(0), pared);

        // UTC+2 (120 minutos): lo escrito son dos horas de reloj más.
        t.set_zona(Some(120));
        assert_eq!(t.instant_at(0), pared - 2 * 3_600_000);

        // Sin zona propia manda la del equipo, resuelta por día.
        t.set_zona(None);
        let desfase = crate::parser::local_offset_seconds(
            chrono::NaiveDate::from_ymd_opt(2026, 10, 22).unwrap(),
        ) as i64;
        assert_eq!(t.instant_at(0), pared - desfase * 1000);
        if desfase != 0 {
            assert_ne!(
                t.instant_at(0),
                pared,
                "la zona del equipo no es UTC: los dos valores difieren en su desfase"
            );
        }
    }

    #[test]
    fn instant_at_sin_hora_no_tiene_instante() {
        let mut t = EntryTable::new(BasicParser::new());
        t.ingest_bytes(b"linea suelta sin instante\n");
        t.set_zona(Some(120));
        assert_eq!(t.instant_at(0), NO_TS);
    }

    #[test]
    fn el_delta_es_la_resta_con_la_entrada_anterior() {
        let mut t = EntryTable::new(BasicParser::new());
        t.ingest_bytes(
            b"2026-10-22 10:00:00 INFO uno\n2026-10-22 10:00:02 INFO dos\n2026-10-22 10:01:02 INFO tres\n",
        );

        assert_eq!(t.delta_at(0), None, "la primera con hora no tiene anterior");
        assert_eq!(t.delta_at(1), Some(2_000));
        assert_eq!(t.delta_at(2), Some(60_000));
        assert_eq!(t.row(1).delta_ms, Some(2_000), "la fila lleva el delta");
    }

    #[test]
    fn el_delta_se_corta_en_las_entradas_sin_hora() {
        let mut t = EntryTable::new(BasicParser::new());
        t.ingest_bytes(
            b"2026-10-22 10:00:00 INFO uno\nlinea sin hora\n2026-10-22 10:00:05 INFO dos\n2026-10-22 10:00:07 INFO tres\n",
        );
        assert_eq!(t.len(), 4);

        assert_eq!(t.delta_at(0), None);
        assert_eq!(t.delta_at(1), None, "sin hora no hay delta");
        assert_eq!(
            t.delta_at(2),
            None,
            "la serie se corta tras una entrada sin hora: no se inventa el salto"
        );
        assert_eq!(t.delta_at(3), Some(2_000), "después del corte, se reanuda");
    }

    #[test]
    fn el_delta_no_cambia_al_filtrar_la_vista() {
        let mut t = EntryTable::new(BasicParser::new());
        t.ingest_bytes(
            b"2026-10-22 10:00:00 INFO arranque\n\
              2026-10-22 10:00:01 DEBUG ruido uno\n\
              2026-10-22 10:00:03 ERROR fallo\n\
              2026-10-22 10:00:09 ERROR otro fallo\n",
        );

        let filtro = Filters {
            levels: Some(Level::Error.bit()),
            text: None,
            avanzado: None,
        };
        let visibles = t.matching_indices(&filtro);
        assert_eq!(visibles, vec![2, 3]);

        // El delta sale del fichero, no de las filas visibles: el primer error
        // mide contra el DEBUG intermedio (2 s) y el segundo contra el primer
        // error (6 s), aunque en la vista filtrada sean consecutivos.
        assert_eq!(t.delta_at(visibles[0] as usize), Some(2_000));
        assert_eq!(t.delta_at(visibles[1] as usize), Some(6_000));

        let pagina = t.page(&visibles, 0, visibles.len());
        assert_eq!(pagina[0].delta_ms, Some(2_000));
        assert_eq!(pagina[1].delta_ms, Some(6_000));
    }

    #[test]
    fn el_delta_de_la_vista_combinada_sigue_el_orden_combinado() {
        let a = fuente(
            "a.log",
            b"2026-10-22 10:00:00 INFO a0\n2026-10-22 10:00:04 INFO a1\n",
        );
        let b = fuente(
            "b.log",
            b"2026-10-22 10:00:01 INFO b0\n2026-10-22 10:00:02 INFO b1\n",
        );
        let set = LogSet::new(vec![a, b]);

        let deltas: Vec<Option<i64>> = (0..4).map(|index| set.delta_at(index)).collect();
        assert_eq!(
            deltas,
            vec![None, Some(1_000), Some(1_000), Some(2_000)],
            "cada fila mide contra la anterior de la vista, sea de la fuente que sea"
        );
        assert_eq!(set.row(2).delta_ms, Some(1_000));
    }

    #[test]
    fn el_tope_corta_una_entrada_sin_instantes() {
        let mut t = EntryTable::new(AutoParser::new());
        let mut text = String::new();
        for i in 0..(MAX_ENTRY_LINES as usize * 2) {
            text.push_str(&format!("linea sin instante {i}\n"));
        }
        t.ingest_bytes(text.as_bytes());
        assert!(
            t.len() >= 2,
            "debe partir en varias entradas, no en una sola: {}",
            t.len()
        );
    }

    #[test]
    fn present_fields_descarta_las_columnas_vacias() {
        let mut t = EntryTable::new(AutoParser::new());
        t.ingest_bytes(b"2026-10-23 01:23:49.683\nunknown\ninfo\nlogger.x: mensaje uno\n");

        let fields = t.present_fields(200);
        assert!(fields.contains(&"Tag".to_string()));
        assert!(fields.contains(&"Logger".to_string()));
        assert!(fields.contains(&"Message".to_string()));
        assert!(
            !fields.contains(&"Thread".to_string()),
            "este log no trae hilo, no debe haber columna: {fields:?}"
        );
    }

    #[test]
    fn present_fields_con_mapeo_explicito_no_anuncia_de_mas() {
        let parser = AutoParser::with_mapping(Some(vec![
            crate::parser::Role::Time,
            crate::parser::Role::Tag,
            crate::parser::Role::Level,
            crate::parser::Role::Message,
        ]));
        let mut t = EntryTable::new(parser);
        t.ingest_bytes(b"2026-10-23 01:23:49.683\nunknown\ninfo\nmensaje\n");

        let fields = t.present_fields(200);
        assert_eq!(fields, vec!["Tag".to_string(), "Message".to_string()]);
    }

    // ------------------------------------------------------------ LogSet

    fn fuente(name: &str, contenido: &[u8]) -> Source {
        let mut table = EntryTable::new(AutoParser::new());
        table.ingest_bytes(contenido);
        Source {
            name: name.to_string(),
            table,
        }
    }

    #[test]
    fn combina_dos_ficheros_en_orden_de_instante() {
        let a = fuente(
            "a.log",
            b"2026-10-22 10:00:00 INFO primero\n2026-10-22 10:00:04 ERROR cuarto\n",
        );
        let b = fuente(
            "b.log",
            b"2026-10-22 10:00:01 WARN segundo\n2026-10-22 10:00:02 INFO tercero\n",
        );

        let set = LogSet::new(vec![a, b]);
        assert_eq!(set.len(), 4);
        assert!(set.is_merged());

        let mensajes: Vec<String> = (0..4)
            .map(|i| {
                set.row(i)
                    .fields
                    .iter()
                    .find(|f| f.name == "Message")
                    .map(|f| f.value.clone())
                    .unwrap_or_default()
            })
            .collect();
        assert_eq!(
            mensajes,
            vec!["primero", "segundo", "tercero", "cuarto"],
            "deben intercalarse por instante"
        );

        // La columna de origen identifica el fichero de cada fila.
        assert_eq!(set.row(0).source, "a.log");
        assert_eq!(set.row(1).source, "b.log");
    }

    #[test]
    fn las_entradas_sin_instante_van_al_final() {        let a = fuente("a.log", b"2026-10-22 10:00:00 INFO con hora\n");
        let b = fuente("b.log", b"linea sin instante\n");
        let set = LogSet::new(vec![a, b]);

        assert_eq!(set.len(), 2);
        assert!(set.row(0).ts_ms.is_some());
        assert!(set.row(1).ts_ms.is_none());
    }

    fn mensajes(set: &LogSet) -> Vec<String> {
        (0..set.len())
            .map(|index| {
                set.row(index)
                    .fields
                    .iter()
                    .find(|field| field.name == "Message")
                    .map(|field| field.value.clone())
                    .unwrap_or_default()
            })
            .collect()
    }

    #[test]
    fn intercala_las_fuentes_cuando_el_instante_coincide() {
        let a = fuente(
            "a.log",
            b"2026-10-22 10:00:00 INFO a0\n2026-10-22 10:00:00 INFO a1\n2026-10-22 10:00:00 INFO a2\n",
        );
        let b = fuente(
            "b.log",
            b"2026-10-22 10:00:00 INFO b0\n2026-10-22 10:00:00 INFO b1\n2026-10-22 10:00:00 INFO b2\n",
        );
        let set = LogSet::new(vec![a, b]);

        // Mismo segundo: se alternan las fuentes en ronda, no se agrupan.
        assert_eq!(
            mensajes(&set),
            vec!["a0", "b0", "a1", "b1", "a2", "b2"],
            "con instantes iguales debe entremezclarse"
        );
    }

    #[test]
    fn una_fuente_con_mas_lineas_no_bloquea_a_la_otra() {
        let a = fuente(
            "a.log",
            b"2026-10-22 10:00:00 INFO a0\n2026-10-22 10:00:00 INFO a1\n2026-10-22 10:00:00 INFO a2\n2026-10-22 10:00:00 INFO a3\n",
        );
        let b = fuente("b.log", b"2026-10-22 10:00:00 INFO b0\n");
        let set = LogSet::new(vec![a, b]);

        // La corta se intercala y luego la larga sigue sola.
        assert_eq!(mensajes(&set), vec!["a0", "b0", "a1", "a2", "a3"]);
    }

    #[test]
    fn una_sola_fuente_respeta_el_orden_de_lectura() {
        let a = fuente(
            "a.log",
            b"2026-10-22 10:00:05 INFO posterior\n2026-10-22 10:00:00 INFO anterior\n",
        );
        let set = LogSet::new(vec![a]);
        assert!(!set.is_merged());
        assert_eq!(set.row(0).source, "");
        let mensaje = |i: usize| {
            set.row(i)
                .fields
                .iter()
                .find(|f| f.name == "Message")
                .map(|f| f.value.clone())
                .unwrap_or_default()
        };
        assert_eq!(mensaje(0), "posterior", "sin combinar no se reordena");
    }

    #[test]
    fn filtra_en_la_vista_combinada() {
        let a = fuente("a.log", b"2026-10-22 10:00:00 INFO uno\n");
        let b = fuente("b.log", b"2026-10-22 10:00:01 ERROR dos\n");
        let set = LogSet::new(vec![a, b]);

        let visibles = set.visible(&Filters {
            levels: Some(Level::Error.bit()),
            text: None,
            avanzado: None,
        });
        assert_eq!(visibles.len(), 1);
        assert_eq!(set.row(visibles[0] as usize).level, Level::Error);
    }

    #[test]
    fn present_fields_une_las_fuentes() {
        let a = fuente("a.log", b"2026-10-22 10:00:00 INFO [12] con hilo\n");
        let b = fuente("b.log", b"2026-10-22 10:00:01 ERROR sin hilo\n");
        let set = LogSet::new(vec![a, b]);
        let fields = set.present_fields(50);
        assert!(fields.contains(&"Thread".to_string()));
        assert!(fields.contains(&"Message".to_string()));
    }
}
