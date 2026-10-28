import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)

// Ejecuta el TypeScript de la aplicación sin arrancar Nuxt ni contactar con servicios.
export function loadModule(file, globals = {}) {
  const filename = path.resolve(file)
  const source = fs.readFileSync(filename, 'utf8')
  return evaluate(source, filename, globals)
}

export function evaluate(source, filename, globals = {}) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  })
  const module = { exports: {} }
  const localRequire = id => id.startsWith('~/')
    ? loadModule(`app/${id.slice(2)}.ts`, globals)
    : require(id)
  vm.runInNewContext(outputText, { ...globals, module, exports: module.exports, require: localRequire, console, Date, Intl }, { filename })
  return module.exports
}
