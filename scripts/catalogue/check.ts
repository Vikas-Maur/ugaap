import { compileCatalogue } from './compile.ts'

const result = await compileCatalogue({ check: true })
if (result.differences.length) {
  console.error(`Catalogue artifacts differ (${result.differences.length}):`)
  for (const path of result.differences) console.error(path)
  process.exitCode = 1
} else {
  console.log(`Catalogue artifacts are deterministic (${result.manifest.formCount} forms, ${result.manifest.categoryCount} categories).`)
}
