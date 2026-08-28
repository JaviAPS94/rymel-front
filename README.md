# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```

## Motor de fórmulas

El diseñador **no evalúa las fórmulas por su cuenta**. Usa
`@rymel/formula-engine`, fijado a un tag inmutable:

```json
"@rymel/formula-engine": "github:JaviAPS94/rymel-formula-engine#v1.5.0"
```

Antes, `SpreadSheet.tsx` traducía cada fórmula a JavaScript con veintiséis
pasadas de `replace` y la ejecutaba con `Function()`. Eso era ejecución de
código arbitrario —una fórmula puede venir de un `.xlsx` que subió
cualquiera— y hacía que el resultado no se pudiera reproducir fuera de un
navegador, que es justo lo que el servidor necesita para recalcular un diseño.

La lógica de evaluación vive en `src/components/design/formula-evaluation.ts`
y **no dentro del componente**: enterrada en las siete mil líneas de
`SpreadSheet.tsx` no se podía ejercitar sin montar React, así que la única
forma de comprobar un cambio era abrir el navegador y mirar.

### Verificar tras actualizar el motor

```bash
node_modules/esbuild/bin/esbuild src/components/design/formula-evaluation.ts \
  --format=esm --platform=node --outfile=.tmp/formula-evaluation.mjs
MODULO="$PWD/.tmp/formula-evaluation.mjs" node scripts/verificar-evaluador.mjs <token-jwt>
```

Evalúa todas las celdas con fórmula de todos los diseños con **el mismo
código que usa la interfaz** y las contrasta contra los valores guardados.
También informa cuántas peticiones hizo: las invocaciones de fórmulas de
diseño se agrupan por nivel de dependencia, así que una hoja con cuarenta
celdas debe costar una petición, no cuarenta.

### Funciones que la ayuda promete y nadie implementa

`InstructionsModal.tsx` documenta `ELEGIR`, `MIN`, `MAX` y `COUNT`, que
**nunca estuvieron en el evaluador**: están rotas desde antes de la
migración. Conviene implementarlas o retirarlas de la ayuda.
