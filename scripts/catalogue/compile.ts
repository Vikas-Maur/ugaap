import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { persist } from '@orama/plugin-data-persistence'
import { buildSearchDocuments, createSearchEngine, ORAMA_VERSION, SEARCH_SCHEMA_VERSION } from '../../src/features/catalogue/search-core.ts'
import { searchEnrichmentSchema } from '../../src/features/catalogue/search-enrichment.ts'
import { captureSchema, completeCaptureFields, type Capture, type CaptureField, type AuthorityChunk, type CatalogueCategory, type CatalogueField, type CatalogueForm, type CatalogueIndex, type CatalogueManifest, type CatalogueWarning, type SearchDocument, type SearchIndexArtifact } from '../../src/features/catalogue/schema.ts'

type CompilerOptions = {
  capturesDir?: string
  outputDir?: string
  check?: boolean
}

type SourceRecord = { sourcePath: string; relativePath: string; capture: Capture }
type MutableCategory = CatalogueCategory & { sourceFields: CaptureField[]; sourcePath?: string; heading: string | null }

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const DEFAULT_CAPTURES = join(defaultRoot, 'local-research', 'cpgrams-form-catalogue', 'captures')
const DEFAULT_PUBLIC = join(defaultRoot, 'public', 'catalogue')

const AUTHORITY_ALIASES: Record<string, string> = {
  'central-board-of-direct-taxes-income-tax': 'Central Board of Direct Taxes (Income Tax)',
  'financial-services-banking-division': 'Financial Services (Banking Division)',
  'home-affairs': 'Home Affairs',
  'labour-and-employment': 'Labour and Employment',
  posts: 'Posts',
  telecommunications: 'Telecommunications',
}

const kindOrder: Record<string, number> = { text: 1, number: 2, select: 3, textarea: 4, file: 5 }

function slugify(value: string): string {
  const slug = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'untitled'
}

function titleCase(value: string): string {
  return value.split(/[-_]+/g).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]))
  }
  return value
}

export function normalizedJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`
}

function checksum(value: unknown): string {
  return createHash('sha256').update(normalizedJson(value)).digest('hex')
}

async function discoverFormFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths: string[] = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) paths.push(...await discoverFormFiles(path))
    else if (entry.isFile() && entry.name === 'form.json') paths.push(path)
  }
  return paths.sort((a, b) => a.localeCompare(b))
}

function sourceRelativePath(capturesDir: string, sourcePath: string): string {
  return relative(capturesDir, sourcePath).split(sep).join('/')
}

function authorityFor(record: { capture: Capture; relativePath: string }): { name: string; slug: string } {
  const explicit = record.capture.snapshot.authority?.trim()
  const topFolder = record.relativePath.split('/')[0] ?? 'unknown-authority'
  const name = explicit || AUTHORITY_ALIASES[topFolder] || titleCase(topFolder)
  return { name, slug: slugify(name) }
}

function folderCategoryPath(relativePath: string): string[] {
  const segments = relativePath.split('/').slice(1, -1)
  return segments.map(titleCase)
}

function categoryPathFor(record: SourceRecord): string[] {
  const fromSnapshot = record.capture.snapshot.categoryPath.map((part) => part.trim()).filter(Boolean)
  return fromSnapshot.length ? fromSnapshot : folderCategoryPath(record.relativePath)
}

function isNavigationField(field: CaptureField): boolean {
  return field.kind === 'search' || (field.kind === 'select' && /^category[_-]/i.test(field.id ?? ''))
}

function displayFieldLabel(field: CaptureField): string {
  const raw = field.label?.trim() || field.name?.trim() || field.id?.trim()
  if (!raw) return 'Field'
  const readable = raw.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return readable.charAt(0).toUpperCase() + readable.slice(1)
}

function outputField(field: CaptureField, id = slugify(field.id || field.name || field.label || 'field')): CatalogueField {
  const result: CatalogueField = {
    id,
    label: displayFieldLabel(field),
    kind: field.kind as CatalogueField['kind'],
    required: field.required,
  }
  if (field.placeholder) result.placeholder = field.placeholder
  if (field.maximumLength) {
    const length = Number.parseInt(field.maximumLength, 10)
    if (Number.isFinite(length)) result.maximumLength = length
  }
  if (field.pattern) result.pattern = field.pattern
  if (field.options) result.options = [...field.options]
  return result
}

function createCategory(authorityId: string, path: string[]): MutableCategory {
  const authoritySlug = authorityId.replace(/^authority-/, '')
  const slugPath = path.map(slugify)
  const id = `category-${authoritySlug}-${slugPath.join('-')}`
  return { id, authorityId, parentId: null, name: path[path.length - 1] ?? 'Uncategorized', slug: slugPath.at(-1) ?? 'uncategorized', path, children: [], navigationOptions: [], formCapable: false, sourceFields: [], heading: null }
}

function addCategory(categories: Map<string, MutableCategory>, authorityId: string, path: string[]): MutableCategory {
  const authoritySlug = authorityId.replace(/^authority-/, '')
  let parent: MutableCategory | undefined
  for (let index = 0; index < path.length; index += 1) {
    const segmentPath = path.slice(0, index + 1)
    const id = `category-${authoritySlug}-${segmentPath.map(slugify).join('-')}`
    let category = categories.get(id)
    if (!category) {
      category = createCategory(authorityId, segmentPath)
      category.parentId = parent?.id ?? null
      categories.set(id, category)
      if (parent && !parent.children.includes(category.id)) parent.children.push(category.id)
    }
    parent = category
  }
  return parent ?? addCategory(categories, authorityId, ['Uncategorized'])
}

function sortedCategories(categories: Map<string, MutableCategory>): CatalogueCategory[] {
  return [...categories.values()].map(({ sourceFields: _sourceFields, heading: _heading, ...category }) => ({ ...category, children: [...category.children].sort() })).sort((a, b) => a.id.localeCompare(b.id))
}

function formTitle(path: string[], heading: string | null): string {
  return heading?.trim() || path.at(-1) || 'General grievance'
}

function buildForm(record: SourceRecord, authority: { name: string; slug: string }, category: MutableCategory, warnings: CatalogueWarning[]): CatalogueForm {
  const sourceFields = record.capture.snapshot.fields.filter((field) => !isNavigationField(field))
  const completedFields = completeCaptureFields(sourceFields)
  const usedFieldIds = new Set<string>()
  const fields = completedFields.fields.map((field) => {
    const baseId = slugify(field.id || field.name || field.label || 'field')
    let fieldId = baseId
    if (usedFieldIds.has(fieldId)) {
      fieldId = `${baseId}-${slugify(field.name || field.label || field.kind)}`
      if (usedFieldIds.has(fieldId)) fieldId = `${fieldId}-${checksum(field).slice(0, 8)}`
    }
    usedFieldIds.add(fieldId)
    return outputField(field, fieldId)
  })
  if (completedFields.synthesized.length) warnings.push({ sourcePath: record.relativePath, message: 'Synthesized missing completion field(s)', fields: completedFields.synthesized })
  fields.sort((a, b) => (kindOrder[a.kind] - kindOrder[b.kind]) || a.id.localeCompare(b.id))
  const categoryPath = category.path
  const categoryId = category.id
  const id = `form-${authority.slug}-${categoryPath.map(slugify).join('-')}`
  const form: CatalogueForm = { id, version: 1, authorityId: `authority-${authority.slug}`, categoryId, categoryPath, title: formTitle(categoryPath, record.capture.snapshot.heading), heading: record.capture.snapshot.heading, fields, sourcePath: record.relativePath, checksum: '', active: true }
  form.checksum = formContentChecksum(form)
  return form
}

function withoutLegacyPathname(form: CatalogueForm): CatalogueForm {
  const { pathname: _pathname, ...current } = form as CatalogueForm & { pathname?: unknown }
  return current
}

function formContentChecksum(form: CatalogueForm): string {
  return checksum({ ...withoutLegacyPathname(form), version: 1, active: true, checksum: undefined })
}

function addNavigationOptions(category: MutableCategory, capture: Capture): void {
  for (const field of capture.snapshot.fields) {
    if (!isNavigationField(field) || !field.options) continue
    for (const option of field.options) {
      const clean = option.trim()
      if (clean && !/^please select|^select next level/i.test(clean) && !category.navigationOptions.includes(clean)) category.navigationOptions.push(clean)
    }
  }
}

async function parseSources(capturesDir: string): Promise<{ records: SourceRecord[]; errors: Array<{ sourcePath: string; message: string }>; sourceCount: number }> {
  const paths = await discoverFormFiles(capturesDir)
  const records: SourceRecord[] = []
  const errors: Array<{ sourcePath: string; message: string }> = []
  for (const sourcePath of paths) {
    const relativePath = sourceRelativePath(capturesDir, sourcePath)
    try {
      const parsed: unknown = JSON.parse(await readFile(sourcePath, 'utf8'))
      const result = captureSchema.safeParse(parsed)
      if (!result.success) {
        errors.push({ sourcePath: relativePath, message: result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ') })
      } else records.push({ sourcePath, relativePath, capture: result.data })
    } catch (error) {
      errors.push({ sourcePath: relativePath, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return { records, errors, sourceCount: paths.length }
}

function compileArtifacts(records: SourceRecord[], errors: Array<{ sourcePath: string; message: string }>, sourceCount: number): { manifest: CatalogueManifest; chunks: Record<string, AuthorityChunk>; searchIndex: SearchDocument[] } {
  const authorities = new Map<string, { name: string; slug: string; categories: Map<string, MutableCategory>; records: Array<{ record: SourceRecord; category: MutableCategory }> }>()
  const warnings: CatalogueWarning[] = []
  for (const record of records) {
    const authority = authorityFor(record)
    const authorityId = `authority-${authority.slug}`
    let bucket = authorities.get(authorityId)
    if (!bucket) { bucket = { ...authority, categories: new Map(), records: [] }; authorities.set(authorityId, bucket) }
    const category = addCategory(bucket.categories, authorityId, categoryPathFor(record))
    addNavigationOptions(category, record.capture)
    category.sourceFields.push(...record.capture.snapshot.fields.filter((field) => !isNavigationField(field)))
    category.sourcePath = record.relativePath
    category.heading = record.capture.snapshot.heading
    bucket.records.push({ record, category })
  }
  const chunks: Record<string, AuthorityChunk> = {}
  const searchIndex: SearchDocument[] = []
  for (const bucket of [...authorities.values()].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const forms: CatalogueForm[] = []
    for (const item of bucket.records.sort((a, b) => a.category.id.localeCompare(b.category.id))) {
      const form = buildForm(item.record, bucket, item.category, warnings)
      item.category.formCapable = true
      item.category.formId = form.id
      forms.push(form)
    }
    const chunk: AuthorityChunk = { schemaVersion: 1, authority: { id: `authority-${bucket.slug}`, name: bucket.name, slug: bucket.slug }, categories: sortedCategories(bucket.categories), forms: forms.sort((a, b) => a.id.localeCompare(b.id)), checksum: '' }
    chunk.checksum = checksum({ ...chunk, checksum: undefined })
    chunks[bucket.slug] = chunk
  }
  searchIndex.sort((a, b) => a.id.localeCompare(b.id))
  const authoritiesChecksums = Object.fromEntries(Object.entries(chunks).sort(([a], [b]) => a.localeCompare(b)).map(([slug, chunk]) => [slug, chunk.checksum]))
  const searchChecksum = checksum(searchIndex)
  const manifestBase = { schemaVersion: 1 as const, sourceCount, organizationCount: Object.keys(chunks).length, categoryCount: Object.values(chunks).reduce((count, chunk) => count + chunk.categories.length, 0), formCount: Object.values(chunks).reduce((count, chunk) => count + chunk.forms.length, 0), synthesizedFieldWarnings: warnings.length, synthesizedFieldCount: warnings.reduce((count, warning) => count + (warning.fields?.length ?? 0), 0), warnings: warnings.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath)), errors: errors.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath)), checksums: { catalogue: '', searchIndex: searchChecksum, authorities: authoritiesChecksums } }
  const manifest: CatalogueManifest = { ...manifestBase, checksums: { ...manifestBase.checksums, catalogue: checksum({ chunks: authoritiesChecksums, searchIndex: searchChecksum, sourceCount, errors: manifestBase.errors }) } }
  return { manifest, chunks, searchIndex }
}

function isAuthorityChunk(value: unknown): value is AuthorityChunk {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AuthorityChunk>
  return candidate.schemaVersion === 1 && Array.isArray(candidate.categories) && Array.isArray(candidate.forms) && typeof candidate.checksum === 'string' && Boolean(candidate.authority)
}

async function readPreviousChunks(outputDir: string): Promise<Record<string, AuthorityChunk>> {
  const directory = join(outputDir, 'authorities')
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  const previous: Record<string, AuthorityChunk> = {}
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    try {
      const parsed: unknown = JSON.parse(await readFile(join(directory, entry.name), 'utf8'))
      if (isAuthorityChunk(parsed)) previous[entry.name.slice(0, -5)] = parsed
    } catch {
      // A malformed old artifact is replaced by the current import.
    }
  }
  return previous
}

function refreshArtifacts(artifacts: { manifest: CatalogueManifest; chunks: Record<string, AuthorityChunk>; searchIndex: SearchDocument[] }): void {
  for (const chunk of Object.values(artifacts.chunks)) {
    chunk.forms.sort((a, b) => a.id.localeCompare(b.id))
    chunk.checksum = checksum({ ...chunk, checksum: undefined })
  }
  artifacts.searchIndex = buildSearchDocuments(Object.values(artifacts.chunks))
  const authorities = Object.fromEntries(Object.entries(artifacts.chunks).sort(([a], [b]) => a.localeCompare(b)).map(([slug, chunk]) => [slug, chunk.checksum]))
  const searchIndex = checksum(artifacts.searchIndex)
  artifacts.manifest.organizationCount = Object.keys(artifacts.chunks).length
  artifacts.manifest.categoryCount = Object.values(artifacts.chunks).reduce((count, chunk) => count + chunk.categories.length, 0)
  artifacts.manifest.formCount = Object.values(artifacts.chunks).reduce((count, chunk) => count + chunk.forms.filter((form) => form.active).length, 0)
  artifacts.manifest.checksums = { authorities, searchIndex, catalogue: checksum({ chunks: authorities, searchIndex, sourceCount: artifacts.manifest.sourceCount, errors: artifacts.manifest.errors }) }
}

async function applySearchEnrichment(outputDir: string, artifacts: { manifest: CatalogueManifest; searchIndex: SearchDocument[] }): Promise<string> {
  const authorityEntries = Object.entries(artifacts.manifest.checksums.authorities).sort(([a], [b]) => a.localeCompare(b))
  const sourceChecksum = createHash('sha256').update(JSON.stringify(authorityEntries)).digest('hex')
  let parsed: ReturnType<typeof searchEnrichmentSchema.safeParse> | undefined
  try { parsed = searchEnrichmentSchema.safeParse(JSON.parse(await readFile(join(outputDir, 'search-enrichment.json'), 'utf8'))) } catch { parsed = undefined }
  if (!parsed?.success || parsed.data.sourceChecksum !== sourceChecksum) {
    if (parsed?.success) console.warn('Ignoring stale catalogue search enrichment; run pnpm catalogue:enrich to refresh it.')
    return 'deterministic-v1'
  }
  const byId = new Map(parsed.data.items.map((item) => [item.id, item]))
  for (const document of artifacts.searchIndex) {
    const enrichment = byId.get(document.id)
    if (!enrichment) continue
    document.aliases = [...new Set([document.aliases, ...enrichment.aliases])].join(' ')
    document.keywords = [...new Set([document.keywords, ...enrichment.keywords])].join(' ')
    document.phrases = [...new Set([document.phrases, ...enrichment.phrases])].join(' ')
  }
  const searchIndex = checksum(artifacts.searchIndex)
  artifacts.manifest.checksums.searchIndex = searchIndex
  artifacts.manifest.checksums.catalogue = checksum({ chunks: artifacts.manifest.checksums.authorities, searchIndex, sourceCount: artifacts.manifest.sourceCount, errors: artifacts.manifest.errors })
  return checksum(parsed.data)
}

function buildCatalogueIndex(artifacts: { manifest: CatalogueManifest; chunks: Record<string, AuthorityChunk> }): CatalogueIndex {
  return {
    schemaVersion: 1,
    catalogueChecksum: artifacts.manifest.checksums.catalogue,
    organizationCount: artifacts.manifest.organizationCount,
    categoryCount: artifacts.manifest.categoryCount,
    formCount: artifacts.manifest.formCount,
    authorities: Object.values(artifacts.chunks)
      .sort((a, b) => a.authority.name.localeCompare(b.authority.name))
      .map((chunk) => ({
        ...chunk.authority,
        checksum: chunk.checksum,
        categoryCount: chunk.categories.length,
        formCount: chunk.forms.filter((form) => form.active).length,
      })),
  }
}

function applyHistoricalState(artifacts: { manifest: CatalogueManifest; chunks: Record<string, AuthorityChunk> }, previous: Record<string, AuthorityChunk>): void {
  for (const [slug, oldChunk] of Object.entries(previous)) {
    const chunk = artifacts.chunks[slug]
    if (!chunk) {
      artifacts.chunks[slug] = { ...oldChunk, forms: oldChunk.forms.map((form) => ({ ...withoutLegacyPathname(form), active: false })) }
      continue
    }
    const currentIds = new Set(chunk.forms.map((form) => form.id))
    const oldById = new Map(oldChunk.forms.map((form) => [form.id, form]))
    for (const form of chunk.forms) {
      const old = oldById.get(form.id)
      if (!old) continue
      const currentChecksum = formContentChecksum(form)
      if (currentChecksum === old.checksum || currentChecksum === formContentChecksum(old)) {
        form.version = old.version
        form.checksum = old.checksum
      } else {
        form.version = (old.version ?? 1) + 1
        form.checksum = currentChecksum
      }
    }
    for (const old of oldChunk.forms) if (!currentIds.has(old.id)) chunk.forms.push({ ...withoutLegacyPathname(old), active: false })
  }
}

async function writeOrCheck(path: string, value: unknown, check: boolean, differences: string[]): Promise<void> {
  const expected = normalizedJson(value)
  let actual: string | undefined
  try { actual = await readFile(path, 'utf8') } catch { actual = undefined }
  if (actual !== expected) { differences.push(path); if (!check) { await writeFile(path, expected, 'utf8') } }
}

async function ensureDirectory(path: string): Promise<void> {
  const result = await stat(path).catch(() => undefined)
  if (!result) await mkdir(path, { recursive: true })
}

export async function compileCatalogue(options: CompilerOptions = {}): Promise<{ manifest: CatalogueManifest; differences: string[] }> {
  const capturesDir = resolve(options.capturesDir ?? DEFAULT_CAPTURES)
  const outputDir = resolve(options.outputDir ?? DEFAULT_PUBLIC)
  const parsed = await parseSources(capturesDir)
  const artifacts = compileArtifacts(parsed.records, parsed.errors, parsed.sourceCount)
  const previous = await readPreviousChunks(outputDir)
  applyHistoricalState(artifacts, previous)
  refreshArtifacts(artifacts)
  const enrichmentChecksum = await applySearchEnrichment(outputDir, artifacts)
  const catalogueIndex = buildCatalogueIndex(artifacts)
  const searchEngine = await createSearchEngine(artifacts.searchIndex)
  const persisted = await persist(searchEngine, 'json', 'node')
  const persistedBytes = typeof persisted === 'string'
    ? Buffer.from(persisted)
    : Buffer.isBuffer(persisted)
      ? persisted
      : Buffer.from(new Uint8Array(persisted))
  const searchArtifact: SearchIndexArtifact = {
    schemaVersion: SEARCH_SCHEMA_VERSION,
    oramaVersion: ORAMA_VERSION,
    catalogueChecksum: artifacts.manifest.checksums.catalogue,
    enrichmentChecksum,
    documentCount: artifacts.searchIndex.length,
    asset: 'search-index.data.json',
    assetChecksum: createHash('sha256').update(persistedBytes).digest('hex'),
  }
  const differences: string[] = []
  if (!options.check) { await ensureDirectory(outputDir); await ensureDirectory(join(outputDir, 'authorities')) }
  const writes: Array<[string, unknown]> = [[join(outputDir, 'index.json'), catalogueIndex], [join(outputDir, 'manifest.json'), artifacts.manifest], [join(outputDir, 'search-index.json'), searchArtifact]]
  for (const [slug, chunk] of Object.entries(artifacts.chunks)) writes.push([join(outputDir, 'authorities', `${slug}.json`), chunk])
  for (const [path, value] of writes) await writeOrCheck(path, value, options.check ?? false, differences)
  const binaryPath = join(outputDir, 'search-index.data.json')
  const previousBinary = await readFile(binaryPath).catch(() => undefined)
  if (!previousBinary || !previousBinary.equals(persistedBytes)) {
    differences.push(binaryPath)
    if (!options.check) await writeFile(binaryPath, persistedBytes)
  }
  return { manifest: artifacts.manifest, differences }
}

function parseCli(argv: string[]): CompilerOptions {
  const result: CompilerOptions = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--check') result.check = true
    else if (argument === '--captures' && argv[index + 1]) result.capturesDir = argv[++index]
    else if (argument === '--public' && argv[index + 1]) result.outputDir = argv[++index]
  }
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const options = parseCli(process.argv.slice(2))
  const result = await compileCatalogue(options)
  console.log(JSON.stringify({ ...result.manifest, differences: result.differences }, null, 2))
  if (options.check && result.differences.length) process.exitCode = 1
}
