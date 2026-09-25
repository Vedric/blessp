// Offline preparation only: no database connection or publication side effects.
const fs = require('node:fs');
const path = require('node:path');

const HEADERS = [
  'produit_existant_a_valider', 'couleur_exemple_a_valider', 'taille_exemple_a_valider',
  'variante_reellement_vendue_oui_non', 'prix_unitaire_CAD_a_confirmer',
  'quantite_physique_vendable', 'ensemble_stock_separe_ou_partage', 'notes',
];
const TEMPLATE = path.join(__dirname, '../config/catalogue.example.csv');
const MAX_BYTES = 1024 * 1024;

function parseCsv(input) {
  if (Buffer.byteLength(input, 'utf8') > MAX_BYTES) throw new Error('CSV limité à 1 Mio.');
  const text = input.replace(/^\uFEFF/, '');
  const records = [];
  let row = [], field = '', quoted = false, closed = false;
  const finishField = () => { row.push(field); field = ''; closed = false; };
  const finishRow = () => { finishField(); records.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += char;
    } else if (char === ';') finishField();
    else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      finishRow();
    } else if (char === '"' && !field && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error(`Guillemets CSV invalides, enregistrement ${records.length + 1}.`);
      field += char;
    }
  }
  if (quoted) throw new Error('Champ CSV entre guillemets non terminé.');
  if (field || closed || row.length) finishRow();
  return records;
}

function priceCents(value) {
  if (!/^\d{1,8}(?:[.,]\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return cents > 0 && cents <= 2147483647 ? cents : null;
}

const normalize = value => value.normalize('NFKC').trim().toLocaleLowerCase('fr-CA');

function validateCatalogue(input) {
  const errors = [];
  const reject = (record, column, message) => errors.push({ record, column, message });
  let records;
  try { records = parseCsv(input); }
  catch (error) { return { valid: false, errors: [{ record: null, column: null, message: error.message }] }; }
  if (JSON.stringify(records[0]) !== JSON.stringify(HEADERS)) {
    reject(1, null, 'En-têtes absents ou modifiés : conserver les huit colonnes du modèle, dans leur ordre.');
    return { valid: false, errors };
  }
  if (records.length < 2 || records.length > 1601) {
    reject(null, null, 'Fournir de 1 à 1600 variantes.');
    return { valid: false, errors };
  }
  const names = [...new Set(parseCsv(fs.readFileSync(TEMPLATE, 'utf8')).slice(1).map(row => row[0]))];
  const known = new Set(names), seenProducts = new Set(), seenVariants = new Set();
  const prices = new Map(), productCounts = new Map(), dimensions = new Map();
  const selected = [];
  records.slice(1).forEach((raw, index) => {
    const record = index + 2;
    if (raw.length !== HEADERS.length) { reject(record, null, 'Huit cellules requises.'); return; }
    const [name, color, size, decision, price, stock, stockPolicy, notes] = raw.map(value => value.trim());
    if (!known.has(name)) reject(record, HEADERS[0], 'Fiche inconnue : conserver le nom de référence du modèle.');
    else seenProducts.add(name);
    for (const [value, max, column] of [[color, 50, HEADERS[1]], [size, 20, HEADERS[2]]]) {
      if (!value || value.length > max || /[\x00-\x1f\x7f]/.test(value)) reject(record, column, `Valeur requise, au plus ${max} caractères, sans caractères de contrôle.`);
    }
    if (notes.length > 2000) reject(record, HEADERS[7], 'Notes limitées à 2000 caractères.');
    const key = JSON.stringify([name, normalize(color), normalize(size)]);
    if (seenVariants.has(key)) reject(record, null, 'Variante dupliquée (produit, couleur, taille).');
    seenVariants.add(key);
    const sell = normalize(decision);
    if (!['oui', 'non'].includes(sell)) {
      reject(record, HEADERS[3], 'Confirmer explicitement oui ou non.');
      return;
    }
    if (sell === 'non') {
      if (price || stock || stockPolicy) reject(record, null, 'Variante exclue : laisser prix, quantité et règle de stock vides.');
      return;
    }
    const cents = priceCents(price);
    if (cents === null) reject(record, HEADERS[4], 'Prix CAD positif requis, sans symbole ni séparateur de milliers, au plus deux décimales (maximum 21474836,47).');
    else if (prices.has(name) && prices.get(name) !== cents) reject(record, HEADERS[4], 'Un même produit doit avoir le même prix pour toutes ses variantes.');
    else prices.set(name, cents);
    const quantity = /^\d{1,7}$/.test(stock) && Number(stock) <= 1000000 ? Number(stock) : null;
    if (quantity === null) reject(record, HEADERS[5], 'Quantité entière requise entre 0 et 1000000 ; une cellule vide ne vaut pas zéro.');
    const policy = normalize(stockPolicy).normalize('NFD').replace(/\p{M}/gu, '');
    if (name.endsWith(' Set')) {
      if (policy === 'partage') reject(record, HEADERS[6], 'Stock partagé non pris en charge : exclure cet ensemble ou implémenter la déduction de ses composants avant vente.');
      else if (policy !== 'separe') reject(record, HEADERS[6], 'Confirmer separe ou partage pour cet ensemble.');
    } else if (policy) reject(record, HEADERS[6], 'Cette colonne concerne uniquement les ensembles.');
    const count = (productCounts.get(name) || 0) + 1;
    productCounts.set(name, count);
    if (count > 200) reject(record, null, 'Maximum 200 variantes vendues par produit.');
    const dims = dimensions.get(name) || { colors: new Set(), sizes: new Set() };
    dims.colors.add(normalize(color)); dims.sizes.add(normalize(size)); dimensions.set(name, dims);
    if (dims.colors.size > 30 || dims.sizes.size > 20) reject(record, null, 'Maximum 30 couleurs et 20 tailles par produit.');
    selected.push({ referenceName: name, color, size, priceCents: cents, physicalQuantity: quantity, stockPolicy: policy || null });
  });
  for (const name of names) if (!seenProducts.has(name)) reject(null, HEADERS[0], `Décision manquante pour ${name} : conserver au moins une ligne, même si le produit est exclu.`);
  if (!selected.length) reject(null, HEADERS[3], 'Aucune variante sélectionnée pour la vente.');
  return {
    valid: errors.length === 0, errors,
    ...(errors.length ? {} : {
      status: 'preparation_only', currency: 'CAD',
      productCount: productCounts.size, variantCount: selected.length,
      totalPhysicalQuantity: selected.reduce((total, variant) => total + variant.physicalQuantity, 0),
      variants: selected,
    }),
  };
}

function main(args) {
  if (args.includes('--help')) {
    console.log('Usage : npm run catalogue:check -- chemin.csv [--json]\nVérification hors ligne, sans import ni publication.');
    return 0;
  }
  const files = args.filter(arg => arg !== '--json');
  if (files.length !== 1 || files[0].startsWith('-')) {
    console.error('Usage : npm run catalogue:check -- chemin.csv [--json]');
    return 2;
  }
  let result;
  try {
    if (fs.statSync(files[0]).size > MAX_BYTES) throw new Error('CSV limité à 1 Mio.');
    result = validateCatalogue(fs.readFileSync(files[0], 'utf8'));
  } catch (error) {
    result = { valid: false, errors: [{ record: null, column: null, message: `Lecture impossible : ${error.code || error.message}` }] };
  }
  if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else if (result.valid) {
    console.log(`Préparation cohérente : ${result.productCount} produits, ${result.variantCount} variantes, ${result.totalPhysicalQuantity} unités physiques déclarées.\nÀ rapprocher du stock réel et des réservations avant saisie administrative. Ce contrôle ne valide pas une mise en production.`);
  } else {
    for (const error of result.errors) console.error(`${error.record ? `Enregistrement ${error.record}` : 'Catalogue'}${error.column ? ` (${error.column})` : ''} : ${error.message}`);
    console.error(`${result.errors.length} anomalie(s). Aucun import effectué.`);
  }
  return result.valid ? 0 : 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { HEADERS, parseCsv, priceCents, validateCatalogue };
