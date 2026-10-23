#!/usr/bin/env node
// Sube la version de LogScope en los cinco sitios donde vive.
//
// Fuente de verdad: package.json. El resto de manifiestos se comprueba antes de
// tocar nada; si ya discrepan entre si, el script aborta en vez de propagar una
// version equivocada.
//
//   node scripts/bump-version.mjs 0.2.0
//   node scripts/bump-version.mjs 0.2.0 --dry-run
//   node scripts/bump-version.mjs 0.2.0 --tag
//
// Con --tag, ademas de escribir, hace el commit del release y crea la etiqueta
// anotada vX.Y.Z. Exige el arbol de trabajo limpio.

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

const FICHEROS = {
  paquete: "package.json",
  bloqueo: "package-lock.json",
  cargo: "src-tauri/Cargo.toml",
  cargoLock: "src-tauri/Cargo.lock",
  tauri: "src-tauri/tauri.conf.json",
};

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?$/;

function leer(relativa) {
  return readFileSync(join(RAIZ, relativa), "utf8");
}

function escribir(relativa, contenido) {
  writeFileSync(join(RAIZ, relativa), contenido, "utf8");
}

function git(...args) {
  // Sin trim: en `status --porcelain` el primer caracter es el estado del index
  // y recortarlo desplaza la ruta (package-lock.json -> ackage-lock.json).
  return execFileSync("git", args, { cwd: RAIZ, encoding: "utf8" });
}

/** Version declarada en cada manifiesto, sin modificar nada. */
function versionesActuales() {
  const paquete = JSON.parse(leer(FICHEROS.paquete));
  const bloqueo = JSON.parse(leer(FICHEROS.bloqueo));
  const tauri = JSON.parse(leer(FICHEROS.tauri));

  const cargo = leer(FICHEROS.cargo);
  const corte = cargo.indexOf("[package]");
  if (corte < 0) throw new Error(`${FICHEROS.cargo} no tiene seccion [package]`);
  const cargoVersion = cargo.slice(corte).match(/^version = "([^"]+)"/m)?.[1];

  return {
    paquete: paquete.version,
    bloqueo: bloqueo.packages?.[""]?.version ?? bloqueo.version,
    cargo: cargoVersion,
    cargoLock: versionEnCargoLock(leer(FICHEROS.cargoLock)),
    tauri: tauri.version,
  };
}

/** Entrada del propio crate en Cargo.lock; cargo la reescribe al compilar. */
function versionEnCargoLock(texto) {
  return texto.match(/\[\[package\]\]\nname = "logscope"\nversion = "([^"]+)"/)?.[1];
}

/** Devuelve el contenido nuevo de cada fichero, o null si no cambia. */
function calcularCambios(destino) {
  const cambios = {};

  const paquete = JSON.parse(leer(FICHEROS.paquete));
  if (paquete.version !== destino) {
    paquete.version = destino;
    cambios[FICHEROS.paquete] = `${JSON.stringify(paquete, null, 2)}\n`;
  }

  // El lock se regenera con formato estable en npm: se puede reescribir entero.
  const bloqueo = JSON.parse(leer(FICHEROS.bloqueo));
  if (bloqueo.packages?.[""]?.version !== destino || bloqueo.version !== destino) {
    bloqueo.version = destino;
    if (bloqueo.packages?.[""]) bloqueo.packages[""].version = destino;
    cambios[FICHEROS.bloqueo] = `${JSON.stringify(bloqueo, null, 2)}\n`;
  }

  // Cargo.toml: solo la version de [package], no las de las dependencias.
  const cargo = leer(FICHEROS.cargo);
  const corte = cargo.indexOf("[package]");
  if (corte < 0) throw new Error(`${FICHEROS.cargo} no tiene seccion [package]`);
  const cabecera = cargo.slice(0, corte);
  const cuerpo = cargo.slice(corte).replace(/^version = "[^"]+"/m, `version = "${destino}"`);
  if (`${cabecera}${cuerpo}` !== cargo) cambios[FICHEROS.cargo] = `${cabecera}${cuerpo}`;

  // Cargo.lock repite la version del propio crate. Si no se toca aqui, cargo
  // (o rust-analyzer) la reescribe por su cuenta y el arbol queda sucio.
  const cargoLock = leer(FICHEROS.cargoLock);
  const cargoLockNuevo = cargoLock.replace(
    /(\[\[package\]\]\nname = "logscope"\nversion = ")[^"]+(")/,
    `$1${destino}$2`,
  );
  if (cargoLockNuevo !== cargoLock) cambios[FICHEROS.cargoLock] = cargoLockNuevo;

  // tauri.conf.json tiene arrays en linea; un round-trip de JSON lo reformatea.
  const tauri = leer(FICHEROS.tauri);
  const tauriNuevo = tauri.replace(/^ {2}"version": "[^"]+"/m, `  "version": "${destino}"`);
  if (tauriNuevo !== tauri) cambios[FICHEROS.tauri] = tauriNuevo;

  return cambios;
}

function principal() {
  const args = process.argv.slice(2);
  const destino = args.find((a) => !a.startsWith("-"));
  const seco = args.includes("--dry-run");
  const etiquetar = args.includes("--tag");

  if (!destino) {
    console.error("Uso: bump.cmd <X.Y.Z> [--dry-run] [--tag]");
    return 2;
  }
  if (!SEMVER.test(destino)) {
    console.error(`[ERROR] "${destino}" no es una version semantica valida (X.Y.Z).`);
    return 2;
  }

  const actuales = versionesActuales();
  const distintas = Object.entries(actuales).filter(([, v]) => v !== actuales.paquete);
  if (distintas.length > 0) {
    console.error("[ERROR] Los manifiestos ya no coinciden entre si. Arreglalo antes de subir la version:");
    for (const [donde, v] of Object.entries(actuales)) {
      console.error(`        ${donde.padEnd(10)} ${v ?? "(no encontrada)"}`);
    }
    return 1;
  }

  const actual = actuales.paquete;
  const cambios = calcularCambios(destino);
  const afectados = Object.keys(cambios);
  const etiqueta = `v${destino}`;

  // Los guards de --tag van antes de escribir: si el arbol no esta en
  // condiciones, se aborta sin haber tocado los manifiestos.
  if (etiquetar && !seco) {
    const permitidos = new Set(afectados);
    const ajenos = git("status", "--porcelain")
      .split("\n")
      .filter(Boolean)
      .map((l) => l.slice(3).trim())
      .filter((f) => !permitidos.has(f));
    if (ajenos.length > 0) {
      console.error("[ERROR] Hay cambios sin commitear que no son del release:");
      for (const f of ajenos) console.error(`        ${f}`);
      console.error("        Commitealos o apartalos, y repite con --tag.");
      return 1;
    }
    if (git("tag", "-l", etiqueta).trim()) {
      console.error(`[ERROR] La etiqueta ${etiqueta} ya existe.`);
      return 1;
    }
  }

  if (afectados.length === 0) {
    console.log(`== Ya estan todos en ${destino}. Nada que hacer.`);
  } else if (seco) {
    console.log(`== Simulacion: ${actual} -> ${destino}`);
    for (const f of afectados) console.log(`        ${f}`);
  } else {
    for (const [f, contenido] of Object.entries(cambios)) escribir(f, contenido);
    console.log(`== Version ${actual} -> ${destino}`);
    for (const f of afectados) console.log(`        ${f}`);
  }

  if (etiquetar && !seco) {
    // Sin cambios que escribir, --tag sirve para etiquetar el commit actual
    // (util en la primera version, cuando el numero ya era el correcto).
    if (afectados.length > 0) {
      git("add", ...afectados);
      git("commit", "-m", `chore(release): ${etiqueta}`);
    }
    git("tag", "-a", etiqueta, "-m", etiqueta);
    console.log(
      afectados.length > 0
        ? `== Commit y etiqueta ${etiqueta} creados.`
        : `== Etiqueta ${etiqueta} creada sobre ${git("rev-parse", "--short", "HEAD").trim()}.`,
    );
  }

  if (!seco && afectados.length > 0) {
    console.log("");
    console.log("Pendiente a mano:");
    console.log(`  - CHANGELOG.md: cerrar [Unreleased] como [${destino}] y actualizar los enlaces.`);
    if (!etiquetar) {
      console.log(`  - git add ${afectados.join(" ")}`);
      console.log(`  - git commit -m "chore(release): v${destino}" && git tag -a v${destino} -m v${destino}`);
    }
  }

  return 0;
}

process.exit(principal());
