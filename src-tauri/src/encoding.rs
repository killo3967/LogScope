//! Codificación del fichero de log.
//!
//! No todos los `.log` de Windows son UTF-8: eMule, bastantes aplicaciones
//! .NET y algunos exportadores de eventos escriben **UTF-16LE** con BOM; los
//! logs de consola antiguos van en la página OEM (**CP850**); y hay quien
//! escribe en cirílico, griego o japonés. Si esos bytes se leen como UTF-8, los
//! ceros de relleno se cuelan entre las letras (`2 4 / 1 0 / 2 0 2 6`) y los
//! acentos se convierten en basura.
//!
//! El resto del programa trabaja siempre con UTF-8, así que aquí solo se decide
//! la codificación y se convierte. La detección es automática, pero siempre se
//! puede forzar una desde la barra: para las páginas de un solo byte (CP1252,
//! CP850…) adivinar es ambiguo por definición, porque los mismos bytes
//! significan cosas distintas en cada una.

use chardetng::{EncodingDetector, Iso2022JpDetection, Utf8Detection};
use encoding_rs::{Decoder as RsDecoder, Encoding as RsEncoding, UTF_16BE, UTF_16LE};

/// Bytes que se miran para decidir sin BOM: de sobra para ver el patrón de
/// ceros de un texto UTF-16 o UTF-32.
const MUESTRA: usize = 512;

/// Bytes que se le pasan al detector estadístico: cuanto más texto, mejor
/// acierta, sin llegar a analizar un fichero entero.
const MUESTRA_DETECTOR: usize = 64 * 1024;

/// Codificación de un fichero. `Auto` delega en la detección.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Encoding {
    Auto,
    Utf8,
    Utf16Le,
    Utf16Be,
    Utf32Le,
    Utf32Be,
    Windows1252,
    Windows1250,
    Windows1251,
    Ibm850,
    Ibm437,
    Iso885915,
    Koi8R,
    ShiftJis,
    Gbk,
    Big5,
    EucJp,
    /// Lo que haya adivinado el detector estadístico, tal cual: cubre páginas
    /// que no están en el selector (griego, hebreo, turco, ISO-2022-JP…).
    Adivinada(&'static RsEncoding),
}

impl Encoding {
    /// Nombre estable: es el que viaja entre la interfaz y el núcleo, y el que
    /// se guarda en la receta de reapertura.
    pub fn name(self) -> &'static str {
        match self {
            Encoding::Auto => "auto",
            Encoding::Utf8 => "utf8",
            Encoding::Utf16Le => "utf16le",
            Encoding::Utf16Be => "utf16be",
            Encoding::Utf32Le => "utf32le",
            Encoding::Utf32Be => "utf32be",
            Encoding::Windows1252 => "windows1252",
            Encoding::Windows1250 => "windows1250",
            Encoding::Windows1251 => "windows1251",
            Encoding::Ibm850 => "cp850",
            Encoding::Ibm437 => "cp437",
            Encoding::Iso885915 => "iso8859-15",
            Encoding::Koi8R => "koi8-r",
            Encoding::ShiftJis => "shift_jis",
            Encoding::Gbk => "gbk",
            Encoding::Big5 => "big5",
            Encoding::EucJp => "euc-jp",
            Encoding::Adivinada(estatica) => estatica.name(),
        }
    }

    pub fn from_name(name: &str) -> Encoding {
        let clave = name.trim().to_ascii_lowercase();
        let sin_guiones = clave.replace(['-', '_'], "");
        match sin_guiones.as_str() {
            "utf8" => Encoding::Utf8,
            "utf16le" => Encoding::Utf16Le,
            "utf16be" => Encoding::Utf16Be,
            "utf32le" => Encoding::Utf32Le,
            "utf32be" => Encoding::Utf32Be,
            "windows1252" | "cp1252" => Encoding::Windows1252,
            "windows1250" | "cp1250" => Encoding::Windows1250,
            "windows1251" | "cp1251" => Encoding::Windows1251,
            "cp850" | "ibm850" => Encoding::Ibm850,
            "cp437" | "ibm437" => Encoding::Ibm437,
            "iso885915" | "latin9" => Encoding::Iso885915,
            "koi8r" => Encoding::Koi8R,
            "shiftjis" | "sjis" => Encoding::ShiftJis,
            "gbk" | "gb18030" => Encoding::Gbk,
            "big5" => Encoding::Big5,
            "eucjp" => Encoding::EucJp,
            _ => Encoding::Auto,
        }
    }

    /// Las que entiende `encoding_rs` (el juego estándar de la web).
    fn de_encoding_rs(self) -> Option<&'static RsEncoding> {
        match self {
            Encoding::Utf16Le => Some(UTF_16LE),
            Encoding::Utf16Be => Some(UTF_16BE),
            Encoding::Windows1252 => Some(encoding_rs::WINDOWS_1252),
            Encoding::Iso885915 => Some(encoding_rs::ISO_8859_15),
            Encoding::Koi8R => Some(encoding_rs::KOI8_R),
            Encoding::ShiftJis => Some(encoding_rs::SHIFT_JIS),
            Encoding::Gbk => Some(encoding_rs::GBK),
            Encoding::Big5 => Some(encoding_rs::BIG5),
            Encoding::EucJp => Some(encoding_rs::EUC_JP),
            Encoding::Adivinada(estatica) => Some(estatica),
            _ => None,
        }
    }

    /// Páginas de un solo byte que `encoding_rs` no trae (dejó fuera las OEM) y
    /// que Windows resuelve con su propia tabla: es exactamente la que usaba el
    /// programa que escribió el log.
    fn codepage(self) -> Option<u32> {
        match self {
            Encoding::Ibm437 => Some(437),
            Encoding::Ibm850 => Some(850),
            Encoding::Windows1250 => Some(1250),
            Encoding::Windows1251 => Some(1251),
            _ => None,
        }
    }
}

/// Deduce la codificación por el BOM y, si no lo hay, por los ceros de relleno.
///
/// El orden importa: el BOM de UTF-32LE (`FF FE 00 00`) empieza igual que el de
/// UTF-16LE, así que UTF-32 se comprueba primero.
pub fn detect(bytes: &[u8]) -> Encoding {
    if bytes.starts_with(&[0xFF, 0xFE, 0x00, 0x00]) {
        return Encoding::Utf32Le;
    }
    if bytes.starts_with(&[0x00, 0x00, 0xFE, 0xFF]) {
        return Encoding::Utf32Be;
    }
    if bytes.starts_with(&[0xFF, 0xFE]) {
        return Encoding::Utf16Le;
    }
    if bytes.starts_with(&[0xFE, 0xFF]) {
        return Encoding::Utf16Be;
    }
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return Encoding::Utf8;
    }

    let muestra = &bytes[..bytes.len().min(MUESTRA)];
    if muestra.len() < 8 {
        return Encoding::Utf8;
    }

    // Ceros por posición dentro del grupo de cuatro: en UTF-32 con caracteres
    // latinos sobran tres de cada cuatro bytes.
    let mut ceros = [0usize; 4];
    for (index, byte) in muestra.iter().enumerate() {
        if *byte == 0 {
            ceros[index % 4] += 1;
        }
    }
    let cuarto = muestra.len() / 8;
    if ceros[1] > cuarto && ceros[2] > cuarto && ceros[3] > cuarto && ceros[0] < cuarto / 2 {
        return Encoding::Utf32Le;
    }
    if ceros[0] > cuarto && ceros[1] > cuarto && ceros[2] > cuarto && ceros[3] < cuarto / 2 {
        return Encoding::Utf32Be;
    }

    // UTF-16 con caracteres latinos: uno de cada dos bytes es cero. En LE el
    // cero cae en las posiciones impares y en BE en las pares.
    let mut ceros_pares = 0usize;
    let mut ceros_impares = 0usize;
    for (index, byte) in muestra.iter().enumerate() {
        if *byte == 0 {
            if index % 2 == 0 {
                ceros_pares += 1;
            } else {
                ceros_impares += 1;
            }
        }
    }

    let umbral = muestra.len() / 4;
    if ceros_impares > umbral && ceros_impares > ceros_pares * 4 {
        return Encoding::Utf16Le;
    }
    if ceros_pares > umbral && ceros_pares > ceros_impares * 4 {
        return Encoding::Utf16Be;
    }

    // Ni BOM ni ceros: si no es UTF-8 limpio, se pregunta al detector
    // estadístico (frecuencias de bytes), que es lo único que puede distinguir
    // cirílico de griego o CP1251 de KOI8-R.
    detectar_por_frecuencia(&bytes[..bytes.len().min(MUESTRA_DETECTOR)])
}

/// Última capa de la detección: análisis de frecuencias con `chardetng` (el
/// detector de Mozilla).
///
/// Se le pregunta **solo** cuando la cabecera no es UTF-8 razonablemente limpia:
/// adivinar de más rompe ficheros UTF-8 cuyo principio es ASCII o que llevan
/// algún byte corrupto suelto.
fn detectar_por_frecuencia(bytes: &[u8]) -> Encoding {
    let invalidos = bytes_invalidos(bytes);
    if invalidos == 0 {
        return Encoding::Utf8;
    }
    if tiene_multibyte_valido(bytes) && invalidos * 5 < bytes.len() {
        return Encoding::Utf8;
    }

    // ISO-2022-JP queda fuera: un log no debería traer secuencias de escape de
    // cambio de juego de caracteres.
    let mut detector = EncodingDetector::new(Iso2022JpDetection::Deny);
    detector.feed(bytes, true);
    match detector.guess(None, Utf8Detection::Allow) {
        estatica if estatica == encoding_rs::UTF_8 => Encoding::Utf8,
        estatica => Encoding::Adivinada(estatica),
    }
}

/// Bytes que no forman parte de ninguna secuencia UTF-8 válida.
fn bytes_invalidos(bytes: &[u8]) -> usize {
    let mut resto = bytes;
    let mut total = 0usize;
    loop {
        match std::str::from_utf8(resto) {
            Ok(_) => return total,
            Err(error) => {
                total += 1;
                let salto = error.valid_up_to() + 1;
                if salto >= resto.len() {
                    return total;
                }
                resto = &resto[salto..];
            }
        }
    }
}

/// ¿Hay alguna secuencia UTF-8 de varios bytes bien formada?
///
/// Sirve para distinguir «UTF-8 con basura suelta» de «texto de una página de un
/// solo byte»: esta última nunca produce secuencias multibyte válidas.
pub fn tiene_multibyte_valido(bytes: &[u8]) -> bool {
    let mut resto = bytes;
    loop {
        match std::str::from_utf8(resto) {
            Ok(texto) => return texto.bytes().any(|byte| byte >= 0x80),
            Err(error) => {
                if resto[..error.valid_up_to()].iter().any(|byte| *byte >= 0x80) {
                    return true;
                }
                let salto = error.valid_up_to() + 1;
                if salto >= resto.len() {
                    return false;
                }
                resto = &resto[salto..];
            }
        }
    }
}

/// Busca el BOM al principio del primer bloque, para descartarlo.
fn bom_len(bytes: &[u8]) -> usize {
    if bytes.starts_with(&[0xFF, 0xFE, 0x00, 0x00])
        || bytes.starts_with(&[0x00, 0x00, 0xFE, 0xFF])
        || bytes.starts_with(&[0xEF, 0xBB, 0xBF])
    {
        4
    } else if bytes.starts_with(&[0xFF, 0xFE]) || bytes.starts_with(&[0xFE, 0xFF]) {
        2
    } else {
        0
    }
}

enum Inner {
    /// Los bytes ya sirven tal cual (UTF-8; el respaldo por línea lo hace el índice).
    Passthrough,
    /// Decodificador con estado de `encoding_rs` (UTF-16 y multibyte asiático).
    Rs(RsDecoder),
    /// Página de un solo byte resuelta por Windows: no hay estado.
    Codepage(u32),
    /// UTF-32: se acumulan los bytes que no completan una unidad.
    Utf32 {
        big_endian: bool,
        pendiente: Vec<u8>,
    },
}

/// Conversor incremental para lo que llega por trozos (lectura por bloques y
/// tail): el estado se queda entre llamadas, así que un par sustituto o una
/// unidad partida por el borde del bloque no se corrompe.
pub struct Decoder {
    encoding: Encoding,
    inner: Inner,
    /// Bytes de BOM que quedan por descartar: puede llegar partido entre bloques.
    saltar: usize,
}

impl Decoder {
    /// Sin conversión: los bytes se entregan tal cual, que es el caso normal.
    pub fn passthrough() -> Self {
        Self {
            encoding: Encoding::Utf8,
            inner: Inner::Passthrough,
            saltar: 0,
        }
    }

    /// Prepara el conversor: `elegida` puede ser `Auto` (se deduce de `head`).
    pub fn new(elegida: Encoding, head: &[u8]) -> Self {
        let encoding = match elegida {
            Encoding::Auto => detect(head),
            otra => otra,
        };

        let inner = match encoding {
            Encoding::Utf8 => Inner::Passthrough,
            Encoding::Utf32Le => Inner::Utf32 {
                big_endian: false,
                pendiente: Vec::new(),
            },
            Encoding::Utf32Be => Inner::Utf32 {
                big_endian: true,
                pendiente: Vec::new(),
            },
            otra => match otra.de_encoding_rs() {
                // `encoding_rs` quita el BOM de UTF-16 por su cuenta.
                Some(rs) => Inner::Rs(rs.new_decoder_with_bom_removal()),
                None => match otra.codepage() {
                    Some(pagina) => Inner::Codepage(pagina),
                    None => Inner::Passthrough,
                },
            },
        };

        // El resto de caminos no descartan el BOM solos; se apunta cuántos bytes
        // hay que saltar y se van consumiendo entre bloques.
        let saltar = if matches!(inner, Inner::Rs(_)) { 0 } else { bom_len(head) };

        Self {
            encoding,
            inner,
            saltar,
        }
    }

    /// Codificación con la que de verdad se está leyendo (ya resuelta).
    pub fn encoding(&self) -> Encoding {
        self.encoding
    }

    /// Texto UTF-8 del trozo, o `None` si no hace falta convertir.
    pub fn decode(&mut self, bytes: &[u8]) -> Option<String> {
        let bytes = self.sin_bom(bytes);

        match &mut self.inner {
            Inner::Passthrough => None,
            Inner::Codepage(pagina) => Some(decodifica_pagina(*pagina, bytes)),
            Inner::Rs(decoder) => {
                // Reserva holgada: `decode_to_string` limita la salida a la
                // capacidad del `String` y, si se queda corta, devuelve
                // `OutputFull` sin leer ni un byte.
                let mut salida = String::with_capacity(bytes.len() * 2 + 32);
                // `last = false`: puede quedar media unidad para el trozo siguiente.
                let (_resultado, leidos, _) = decoder.decode_to_string(bytes, &mut salida, false);
                debug_assert_eq!(leidos, bytes.len(), "el bloque entero debe consumirse");
                Some(salida)
            }
            Inner::Utf32 {
                big_endian,
                pendiente,
            } => Some(decode_utf32(bytes, *big_endian, pendiente)),
        }
    }

    /// Descuenta los bytes de BOM aunque lleguen repartidos entre bloques.
    fn sin_bom<'a>(&mut self, bytes: &'a [u8]) -> &'a [u8] {
        if self.saltar == 0 {
            return bytes;
        }
        let salto = self.saltar.min(bytes.len());
        self.saltar -= salto;
        &bytes[salto..]
    }
}

/// Convierte una página de códigos con la tabla del propio Windows
/// (`MultiByteToWideChar`), que es la que usaba el programa que escribió el log.
/// Así no hace falta añadir una dependencia con las tablas OEM.
#[cfg(windows)]
fn decodifica_pagina(pagina: u32, bytes: &[u8]) -> String {
    use std::os::raw::c_int;

    extern "system" {
        fn MultiByteToWideChar(
            code_page: u32,
            flags: u32,
            multi_byte_str: *const u8,
            cb_multi_byte: c_int,
            wide_char_str: *mut u16,
            cch_wide_char: c_int,
        ) -> c_int;
    }

    if bytes.is_empty() {
        return String::new();
    }

    let largo = unsafe {
        MultiByteToWideChar(
            pagina,
            0,
            bytes.as_ptr(),
            bytes.len() as c_int,
            std::ptr::null_mut(),
            0,
        )
    };
    if largo <= 0 {
        return String::from_utf8_lossy(bytes).into_owned();
    }

    let mut salida = vec![0u16; largo as usize];
    let escrito = unsafe {
        MultiByteToWideChar(
            pagina,
            0,
            bytes.as_ptr(),
            bytes.len() as c_int,
            salida.as_mut_ptr(),
            largo,
        )
    };
    if escrito <= 0 {
        return String::from_utf8_lossy(bytes).into_owned();
    }
    salida.truncate(escrito as usize);
    String::from_utf16_lossy(&salida)
}

#[cfg(not(windows))]
fn decodifica_pagina(_pagina: u32, bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).into_owned()
}

/// Convierte UTF-32 guardando los bytes que no completan una unidad.
fn decode_utf32(bytes: &[u8], big_endian: bool, pendiente: &mut Vec<u8>) -> String {
    let mut unido: Vec<u8>;
    let entrada: &[u8] = if pendiente.is_empty() {
        bytes
    } else {
        unido = std::mem::take(pendiente);
        unido.extend_from_slice(bytes);
        &unido
    };

    let mut salida = String::with_capacity(entrada.len());
    let mut i = 0;
    while i + 4 <= entrada.len() {
        let trozo = [entrada[i], entrada[i + 1], entrada[i + 2], entrada[i + 3]];
        let valor = if big_endian {
            u32::from_be_bytes(trozo)
        } else {
            u32::from_le_bytes(trozo)
        };
        // Un código que no es un carácter válido se sustituye, no se pierde la línea.
        match char::from_u32(valor) {
            Some(caracter) => salida.push(caracter),
            None => salida.push('\u{FFFD}'),
        }
        i += 4;
    }
    pendiente.extend_from_slice(&entrada[i..]);
    salida
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utf16le(texto: &str) -> Vec<u8> {
        let mut bytes = vec![0xFF, 0xFE];
        for unidad in texto.encode_utf16() {
            bytes.extend_from_slice(&unidad.to_le_bytes());
        }
        bytes
    }

    fn utf32le(texto: &str) -> Vec<u8> {
        let mut bytes = vec![0xFF, 0xFE, 0x00, 0x00];
        for caracter in texto.chars() {
            bytes.extend_from_slice(&(caracter as u32).to_le_bytes());
        }
        bytes
    }

    #[test]
    fn detecta_utf16le_por_bom() {
        assert_eq!(detect(&utf16le("24/10/2026")), Encoding::Utf16Le);
    }

    #[test]
    fn detecta_utf16be_por_bom() {
        let mut bytes = vec![0xFE, 0xFF];
        for unidad in "24/10/2026".encode_utf16() {
            bytes.extend_from_slice(&unidad.to_be_bytes());
        }
        assert_eq!(detect(&bytes), Encoding::Utf16Be);
    }

    #[test]
    fn detecta_utf32_antes_que_utf16() {
        // El BOM de UTF-32LE empieza como el de UTF-16LE: si se comprueba
        // UTF-16 primero, el fichero se leería como UTF-16 y saldrían ceros.
        let bytes = utf32le("hola");
        assert_eq!(detect(&bytes), Encoding::Utf32Le);
        assert_eq!(Decoder::new(Encoding::Auto, &bytes).encoding(), Encoding::Utf32Le);
    }

    #[test]
    fn detecta_utf32be_por_bom() {
        let mut bytes = vec![0x00, 0x00, 0xFE, 0xFF];
        for caracter in "hola".chars() {
            bytes.extend_from_slice(&(caracter as u32).to_be_bytes());
        }
        assert_eq!(detect(&bytes), Encoding::Utf32Be);
    }

    #[test]
    fn detecta_utf32_sin_bom_por_los_ceros() {
        let mut bytes = Vec::new();
        for caracter in "2026-10-22 10:00:00 INFO prueba de deteccion".chars() {
            bytes.extend_from_slice(&(caracter as u32).to_le_bytes());
        }
        assert_eq!(detect(&bytes), Encoding::Utf32Le);
    }

    #[test]
    fn detecta_utf16le_sin_bom_por_los_ceros() {
        let mut bytes = Vec::new();
        for unidad in "2026-10-22 10:00:00 INFO prueba de deteccion".encode_utf16() {
            bytes.extend_from_slice(&unidad.to_le_bytes());
        }
        assert_eq!(detect(&bytes), Encoding::Utf16Le);
    }

    #[test]
    fn el_texto_normal_sigue_siendo_utf8() {
        assert_eq!(
            detect(b"2026-10-24 10:00:00 INFO prueba con acentos: sesion"),
            Encoding::Utf8
        );
        // Un fichero con ceros sueltos no debe confundirse con UTF-16.
        assert_eq!(detect(b"2026-10-24 10:00:00\0 INFO\0 x\0"), Encoding::Utf8);
    }

    #[test]
    fn reproduce_utf16_y_utf32_completos() {
        let texto = "hola\r\nadios\r\ncon acentos: sesión";
        for (codificacion, bytes) in [
            (Encoding::Utf16Le, utf16le(texto)),
            (Encoding::Utf32Le, utf32le(texto)),
        ] {
            let mut decoder = Decoder::new(codificacion, &bytes);
            let mut salida = String::new();
            for trozo in bytes.chunks(3) {
                if let Some(parte) = decoder.decode(trozo) {
                    salida.push_str(&parte);
                }
            }
            assert_eq!(salida, texto, "troceado a 3 bytes en {codificacion:?}");
        }
    }

    #[test]
    fn get_utf8_no_convierte_lo_que_ya_esta_en_utf8() {
        let mut decoder = Decoder::new(Encoding::Utf8, b"texto");
        assert!(decoder.decode(b"texto").is_none());
        assert_eq!(decoder.encoding(), Encoding::Utf8);
    }

    #[test]
    fn lee_la_pagina_oem_850_de_consola() {
        // En CP850 «sesión» se escribe con 0xA2 en lugar de la ó de UTF-8.
        let bytes = b"sesi\xA2n completa";
        let mut decoder = Decoder::new(Encoding::Ibm850, bytes);
        assert_eq!(decoder.decode(bytes).unwrap(), "sesión completa");
    }

    #[test]
    fn lee_cp437_y_cp1251() {
        // CP437: 0xA2 es la ó. CP1251: 0xEE es la о cirílica (U+043E).
        assert_eq!(
            Decoder::new(Encoding::Ibm437, b"sesi\xA2n").decode(b"sesi\xA2n").unwrap(),
            "sesión"
        );
        let cirilico = Decoder::new(Encoding::Windows1251, b"\xEE")
            .decode(b"\xEE")
            .unwrap();
        assert_eq!(cirilico, "о");
    }

    #[test]
    fn lee_windows1252_forzado() {
        let bytes = b"sesi\xF3n";
        let mut decoder = Decoder::new(Encoding::Windows1252, bytes);
        assert_eq!(decoder.decode(bytes).unwrap(), "sesión");
    }

    #[test]
    fn adivina_cirilico_en_cp1251() {
        let texto = "2026-10-24 10:00:00 INFO Sesion del cliente iniciada en el servidor remoto\r\n"
            .replace("Sesion del cliente", "Сессия клиента");
        let mut original = String::new();
        for _ in 0..4 {
            original.push_str(&texto);
        }
        let (bytes, _, _) = encoding_rs::WINDOWS_1251.encode(&original);
        let mut decoder = Decoder::new(Encoding::Auto, &bytes);
        let salida = decoder.decode(&bytes).expect("deberia convertir");
        assert!(
            salida.contains("Сессия клиента"),
            "detectado {:?} y salio {salida:?}",
            decoder.encoding()
        );
    }

    #[test]
    fn adivina_japones_en_shift_jis() {
        let linea = "2026-10-24 10:00:00 INFO 日本語のログを記録しました\r\n";
        let original = linea.repeat(4);
        let (bytes, _, _) = encoding_rs::SHIFT_JIS.encode(&original);
        let mut decoder = Decoder::new(Encoding::Auto, &bytes);
        let salida = decoder.decode(&bytes).expect("deberia convertir");
        assert!(
            salida.contains("日本語のログ"),
            "detectado {:?} y salio {salida:?}",
            decoder.encoding()
        );
    }

    #[test]
    fn adivina_espanol_en_windows1252() {
        let original = "2026-10-24 10:00:00 INFO sesión cerrada, señal enviada\r\n".repeat(4);
        let (bytes, _, _) = encoding_rs::WINDOWS_1252.encode(&original);
        let mut decoder = Decoder::new(Encoding::Auto, &bytes);
        let salida = decoder.decode(&bytes).expect("deberia convertir");
        assert!(salida.contains("sesión cerrada"), "salio {salida:?}");
    }

    #[test]
    fn una_linea_utf8_con_un_byte_roto_sigue_siendo_utf8() {
        // El detector no debe reinterpretar un UTF-8 con basura suelta: hay
        // secuencias multibyte válidas y los bytes rotos son pocos.
        let mut bytes = "2026-10-24 10:00:00 INFO sesión con acentos ç ".as_bytes().to_vec();
        bytes.push(0xFF);
        bytes.extend_from_slice(b" y mas texto\r\n");
        assert_eq!(detect(&bytes), Encoding::Utf8);
    }

    #[test]
    fn los_nombres_van_y_vuelven() {
        for codificacion in [
            Encoding::Auto,
            Encoding::Utf8,
            Encoding::Utf16Le,
            Encoding::Utf16Be,
            Encoding::Utf32Le,
            Encoding::Utf32Be,
            Encoding::Windows1252,
            Encoding::Windows1250,
            Encoding::Windows1251,
            Encoding::Ibm850,
            Encoding::Ibm437,
            Encoding::Iso885915,
            Encoding::Koi8R,
            Encoding::ShiftJis,
            Encoding::Gbk,
            Encoding::Big5,
            Encoding::EucJp,
        ] {
            assert_eq!(Encoding::from_name(codificacion.name()), codificacion);
        }
        assert_eq!(Encoding::from_name("vaya usted a saber"), Encoding::Auto);
    }
}
