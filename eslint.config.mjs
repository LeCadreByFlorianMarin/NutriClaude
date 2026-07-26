import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Ignores par défaut d'eslint-config-next :
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Outillage et artefacts hors code applicatif :
    "_bmad/**",
    "_bmad-output/**",
    ".claude/**",
    "design-artifacts/**",
    "supabase/**",
  ]),
  {
    rules: {
      /*
       * Convention : un identifiant préfixé d'un `_` est intentionnellement
       * inutilisé. Cas d'usage dans le socle : le paramètre `headers` de `setAll`
       * dans `lib/supabase/server.ts`, qu'un Server Component ne peut pas
       * exploiter (il ne peut pas écrire d'en-têtes de réponse).
       *
       * Le niveau `warn` n'est pas un assouplissement : `eslint-config-next`
       * pose déjà cette règle en `warn` (dist/typescript.js).
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
