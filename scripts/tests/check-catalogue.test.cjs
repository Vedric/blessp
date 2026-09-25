const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { HEADERS, parseCsv, priceCents, validateCatalogue } = require('../check-catalogue.cjs');

const template = fs.readFileSync(path.join(__dirname, '../../config/catalogue.example.csv'), 'utf8');
const encode = rows => '\uFEFF' + rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\r\n') + '\r\n';
function fixture() {
  return parseCsv(template).map((row, index) => index === 0 ? row : [
    ...row.slice(0, 3), 'oui', '12,34', '5', row[0].endsWith(' Set') ? 'séparé' : '', '',
  ]);
}
function expectInvalid(rows, pattern) {
  const result = validateCatalogue(encode(rows));
  assert.equal(result.valid, false);
  assert.equal('variants' in result, false, 'Never return a usable plan on validation failure');
  assert.match(result.errors.map(error => error.message).join('\n'), pattern);
  return result;
}

test('blank committed template contains eight products and 32 undecided variants', () => {
  const rows = parseCsv(template);
  assert.equal(rows.length, 33);
  assert.equal(new Set(rows.slice(1).map(row => row[0])).size, 8);
  for (const row of rows.slice(1)) assert.deepEqual(row.slice(3), ['', '', '', '', '']);
  expectInvalid(rows, /Confirmer explicitement/);
});

test('CSV accepts BOM, CRLF, escaped quotes, semicolons and multiline notes', () => {
  const rows = fixture();
  rows[1][7] = 'Note ; "physique"\r\nDeuxième ligne';
  assert.deepEqual(parseCsv(encode(rows)), rows);
  assert.equal(validateCatalogue(encode(rows)).valid, true);
  assert.deepEqual(parseCsv('a;b\nc;d'), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(parseCsv('a;b\rc;d\r'), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(parseCsv('a;""'), [['a', '']]);
});

for (const malformed of ['a;"unclosed', 'a;"closed"x', 'a;un"quoted', 'a;"closed" "again"']) {
  test(`malformed CSV is rejected: ${JSON.stringify(malformed)}`, () => {
    assert.throws(() => parseCsv(malformed));
    assert.equal(validateCatalogue(malformed).valid, false);
  });
}

test('valid preparation produces integer cents and physical quantities, including declared zero', () => {
  const rows = fixture(); rows[1][5] = '0'; rows[2][4] = '12.34';
  const result = validateCatalogue(encode(rows));
  assert.deepEqual(result.errors, []);
  assert.equal(result.status, 'preparation_only');
  assert.equal(result.currency, 'CAD');
  assert.equal(result.productCount, 8);
  assert.equal(result.variantCount, 32);
  assert.equal(result.totalPhysicalQuantity, 155);
  assert.deepEqual(result.variants[0], {
    referenceName: 'Classic Black Hoodie', color: 'Black', size: 'S',
    priceCents: 1234, physicalQuantity: 0, stockPolicy: null,
  });
});

test('prices use exact decimal conversion and enforce PostgreSQL Int boundary', () => {
  for (const [input, expected] of [['0.01', 1], ['1', 100], ['1,1', 110], ['0.29', 29], ['21474836.47', 2147483647]]) {
    assert.equal(priceCents(input), expected);
  }
  for (const input of ['', '0', '-1', '+1', '1e2', 'NaN', 'Infinity', '12.345', '1,234.56', '12 CAD', '=1+2', '21474836.48']) {
    assert.equal(priceCents(input), null, input);
    const rows = fixture(); rows[1][4] = input;
    expectInvalid(rows, /Prix CAD positif/);
  }
});

test('blank, fractional, negative, formula and oversized quantities cannot become stock', () => {
  for (const input of ['', '-1', '+1', '1.5', '1,5', '1e2', 'Infinity', '=5', '1000001']) {
    const rows = fixture(); rows[1][5] = input;
    expectInvalid(rows, /Quantité entière requise/);
  }
  const rows = fixture(); rows[1][5] = '1000000';
  assert.equal(validateCatalogue(encode(rows)).valid, true);
});

test('different prices within one product are rejected', () => {
  const rows = fixture(); rows[1][4] = '12.35';
  expectInvalid(rows, /même prix/);
});

test('every variant needs an explicit decision; excluding one requires empty commercial cells', () => {
  for (const value of ['', 'yes', 'peut-être']) {
    const rows = fixture(); rows[1][3] = value;
    expectInvalid(rows, /Confirmer explicitement/);
  }
  const rows = fixture(); rows[1][3] = 'non';
  expectInvalid(rows, /Variante exclue/);
  rows[1].splice(4, 3, '', '', '');
  assert.equal(validateCatalogue(encode(rows)).variantCount, 31);
});

test('shared or undecided set stock cannot be approved accidentally', () => {
  for (const policy of ['', 'partage', 'partagé', 'unknown']) {
    const rows = fixture(); const set = rows.find(row => row[0].endsWith(' Set'));
    set[6] = policy;
    expectInvalid(rows, /Stock partagé non pris en charge|Confirmer separe ou partage/);
  }
  const rows = fixture(); rows[1][6] = 'separe';
  expectInvalid(rows, /uniquement les ensembles/);
});

test('explicitly excluded sets allow standalone sales without inferring component quantities', () => {
  const rows = fixture().map(row => row[0].endsWith(' Set') ? [...row.slice(0, 3), 'non', '', '', '', 'Stock à déterminer'] : row);
  const result = validateCatalogue(encode(rows));
  assert.equal(result.valid, true);
  assert.equal(result.productCount, 5);
  assert.equal(result.variantCount, 20);
});

test('duplicate variants are detected across case and Unicode presentation differences', () => {
  const rows = fixture(); rows.push([...rows[1]]); rows.at(-1)[1] = ' black '; rows.at(-1)[2] = 'ｓ';
  expectInvalid(rows, /Variante dupliquée/);
});

test('real sizes and colors can replace examples, with limits compatible with the admin API', () => {
  const rows = fixture(); rows[1][1] = 'Noir'; rows[1][2] = 'XXL';
  assert.equal(validateCatalogue(encode(rows)).valid, true);
  for (const [column, value] of [[1, ''], [2, ''], [1, 'x'.repeat(51)], [2, 'x'.repeat(21)], [1, 'Bl\nack']]) {
    const invalid = fixture(); invalid[1][column] = value;
    expectInvalid(invalid, /Valeur requise/);
  }
});

test('missing and unknown products require an explicit catalogue review', () => {
  const rows = fixture(); rows[1][0] = 'Unknown product';
  expectInvalid(rows, /Fiche inconnue/);
  expectInvalid(fixture().filter(row => row[0] !== 'Classic Black Hoodie'), /Décision manquante pour Classic Black Hoodie/);
});

test('no selected variants is not a ready catalogue', () => {
  const rows = parseCsv(template); for (const row of rows.slice(1)) row[3] = 'non';
  expectInvalid(rows, /Aucune variante/);
});

test('missing, reordered and duplicate headers or wrong row widths fail', () => {
  for (const header of [[], HEADERS.slice(1), [...HEADERS].reverse(), [...HEADERS.slice(0, 7), HEADERS[0]]]) {
    const rows = fixture(); rows[0] = header;
    expectInvalid(rows, /En-têtes/);
  }
  for (const cells of [[], [''], [...fixture()[1], 'extra']]) {
    const rows = fixture(); rows[1] = cells;
    expectInvalid(rows, /Huit cellules/);
  }
});

test('input and API dimension limits are enforced', () => {
  assert.throws(() => parseCsv('x'.repeat(1024 * 1024 + 1)), /1 Mio/);
  expectInvalid([HEADERS], /1 à 1600/);
  expectInvalid([HEADERS, ...Array.from({ length: 1601 }, () => fixture()[1])], /1 à 1600/);
  const rows = fixture(); rows[1][7] = 'x'.repeat(2001);
  expectInvalid(rows, /Notes limitées/);
  const tooMany = fixture();
  for (let i = 0; i < 201; i++) tooMany.push([tooMany[1][0], `Color${i % 30}`, `Size${Math.floor(i / 30)}`, 'oui', '12.34', '1', '', '']);
  expectInvalid(tooMany, /Maximum 200 variantes/);
  expectInvalid(tooMany, /Maximum 30 couleurs/);
  const sizes = fixture();
  for (let i = 0; i < 21; i++) sizes.push([sizes[1][0], 'Black', `Size${i}`, 'oui', '12.34', '1', '', '']);
  expectInvalid(sizes, /Maximum 30 couleurs et 20 tailles/);
});

test('CLI success, rejection, missing input and usage have deterministic exit codes without changing files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blessp-catalogue-'));
  const file = path.join(directory, 'catalogue.csv');
  const cli = path.join(__dirname, '../check-catalogue.cjs');
  const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  try {
    const original = encode(fixture()); fs.writeFileSync(file, original);
    const success = run([file, '--json']);
    assert.equal(success.status, 0, success.stderr);
    assert.equal(JSON.parse(success.stdout).variantCount, 32);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
    assert.equal(run([file]).status, 0);
    fs.writeFileSync(file, template);
    const rejected = run([file, '--json']);
    assert.equal(rejected.status, 1);
    assert.equal(JSON.parse(rejected.stdout).valid, false);
    assert.match(run([file]).stderr, /Aucun import/);
    assert.equal(fs.readFileSync(file, 'utf8'), template);
    assert.deepEqual(fs.readdirSync(directory), ['catalogue.csv']);
    assert.equal(run([path.join(directory, 'missing.csv')]).status, 1);
    assert.equal(run([]).status, 2);
    assert.equal(run(['--unknown']).status, 2);
    assert.equal(run([file, file]).status, 2);
    assert.equal(run(['--help']).status, 0);
    fs.writeFileSync(file, 'x'.repeat(1024 * 1024 + 1));
    assert.match(JSON.parse(run([file, '--json']).stdout).errors[0].message, /1 Mio/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
