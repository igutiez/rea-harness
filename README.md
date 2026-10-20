<div align="center">

# `rea-harness`

**El meta-harness de rsc, vitaminado con REA.**

Memoria, manos, oficio y reflejos para tu agente. Y, cuando la respuesta depende del artefacto que
se ejecuta y no del código que se lee, ingeniería inversa con evidencia.

</div>

---

## Qué es

`rea-harness` es un fork privado de [rsc-harness](https://github.com/ericrisco/rsc-harness) que
integra [REA](https://github.com/morluto/rea) como capacidad de primera clase:

| Pieza | Dónde vive | Qué hace |
| --- | --- | --- |
| **Memoria** | `02-DOCS/` | Un wiki que el agente lee antes de trabajar y mantiene mientras trabaja. |
| **Manos** | `01-TOOLS/` | Una carpeta por herramienta, con una prueba que demuestra que la conexión funciona. |
| **Oficio** | skills | 272 skills disponibles; se instalan las que el proyecto justifica. |
| **Reflejos** | hooks | Reglas que se cumplen aunque el agente las olvide a mitad de sesión. |
| **REA** | `skills/rea/` + `01-TOOLS/rea/` + `02-DOCS/wiki/rea/` | Evidencia de artefactos: binarios, ASAR/Electron, APK, firmware, navegador y comportamiento en ejecución. |

rsc decide **qué arnés necesita el proyecto**. REA decide **qué se puede afirmar del artefacto**.
Juntos evitan las dos formas de inventar: la documentación que falta y la conclusión que no se
sostiene sobre evidencia.

## Por qué

- **Explicas todo otra vez.** Cada sesión, cada proyecto: el stack, las convenciones, lo decidido,
  lo que no se toca.
- **Lo que el agente no sabe, se lo inventa.** Y la invención suena plausible, que es peor que un
  error evidente.
- **El código no cuenta toda la historia.** La app empaquetada, el binario firmado, el APK que
  cambió entre versiones y la sesión que solo existe en ejecución no están en el repositorio.
  Sin REA, el agente adivina; con REA, cita Evidence IDs y separa observación, inferencia y
  desconocido.

## Instalar

Desde la raíz del proyecto que quieres equipar (no desde un clon del repositorio):

```bash
npx github:igutiez/rea-harness onboard --with-rea
```

El repositorio es privado: `npx` y `npm` necesitan tus credenciales de GitHub. También puedes
instalarlo globalmente desde un clon:

```bash
git clone git@github.com:igutiez/rea-harness.git
cd rea-harness && npm install && npm link
rea-harness onboard --with-rea
```

Sin `--with-rea` obtienes el arnés de rsc sin la capa de artefactos. En modo interactivo, el
instalador también pregunta si quieres REA.

### Para agentes

If you are an agent, run the command above in the project root. Relay the questions to the user;
never invent or default an answer. The preview writes nothing; apply only with the exact plan id the
user accepted.

### Qué escribe, y qué te pregunta antes

Primero muestra el plan completo y su id SHA-256; **no escribe nada hasta que aceptas ese plan
exacto**. Cada pieza aparece como `selected`, `deferred` o `excluded`, con su motivo.

- **En el proyecto:** `.rsc/` (skills reales y estado), enlaces por asistente (`.claude/skills`,
  `.dsh/skills`, `AGENTS.md`, …), `01-TOOLS/rea/`, `02-DOCS/wiki/rea/` y los documentos del arnés.
- **Fuera del proyecto:** la registración MCP de REA. Se delega en `rea setup --skill=false`, que
  es quien conoce los formatos, las copias de seguridad y la verificación de cada cliente. Para
  DeepSeek Harness escribe `$DSH_HOME/cordis.patch.yml`; para Claude Code, `~/.claude.json`; para
  Codex, `~/.codex/config.toml`; y así para cada cliente soportado.
- **Nunca** ejecuta el artefacto que vas a analizar. El análisis en ejecución es una acción
  separada, autorizada y declarada.

Si la registración falla (sin red, cliente cerrado, versión de Node incompatible), el arnés local
queda instalado y el instalador imprime el comando exacto para repararlo. No revierte el trabajo
por un fallo de un paso externo.

### Aceptar un plan concreto

```bash
rea-harness onboard --technical-level technical --project-kind software \
  --goal "reverse engineer the shipped desktop app to compare its update protocol" \
  --software-scope growing --target deepseek --with-rea
# Tras aceptar el id impreso:
rea-harness onboard ... --with-rea --accept-plan <SHA256>
```

Si la evidencia del proyecto cambia entre la vista previa y la aceptación, devuelve
`RSC_PLAN_CHANGED` y no escribe nada. Tras aplicar, verifica y termina con
`RSC_ONBOARDING_READY` o `RSC_ONBOARDING_INCOMPLETE` con cada camino que falta.

## La capa REA

### El skill

`skills/rea/` es el skill `reverse-engineer-anything` de REA 6.7.0 (MIT), adaptado al arnés:

- enruta el objetivo primero (ASAR/JS, binario nativo, APK, firmware, navegador, captura);
- distingue observación, inferencia y desconocido, y exige un Evidence ID por conclusión;
- conserva las limitaciones y la cobertura que devuelve la herramienta;
- añade la sección **In this harness**: dónde escribir la evidencia y cómo reparar la conexión;
- usa la versión fijada `rea-agents@6.7.0` en lugar de `@latest`.

### Las manos

`01-TOOLS/rea/` es tuyo y se crea una sola vez:

| Archivo | Para qué |
| --- | --- |
| `README.md` | Qué es REA, qué clientes están registrados y cómo usarlo. |
| `CREDENTIALS.md` | No hay credenciales. Prerrequisitos y proveedores opcionales con su licencia. |
| `.env.example` | `REA_BIN`, `REA_MCP_CLIENTS` y rutas de proveedores. `.env` está ignorado por git. |
| `test_connection.mjs` | Prueba de solo lectura: `rea doctor --client … --json`, sin escribir ni analizar nada. |

```bash
node 01-TOOLS/rea/test_connection.mjs
```

### La evidencia

`02-DOCS/wiki/rea/` es el cuaderno de la investigación, no el chat:

- `index.md`: objetivos, autorización, estado y preguntas abiertas.
- `evidence-ledger.md`: una fila por conclusión con su Evidence ID, tipo y límite de búsqueda.
- `targets/<slug>.md`: identidad del artefacto (ruta, SHA-256), proveedor, observaciones,
  inferencias, desconocidos y cobertura.

Una conclusión sin Evidence ID es una inferencia, y se etiqueta como tal. El análisis estático no
se presenta nunca como comportamiento observado.

### Los comandos

```bash
rea-harness rea status          # qué declaró el proyecto, scaffold y lanzador resuelto
rea-harness rea setup           # registra o repara el MCP (delegado a REA)
rea-harness rea setup --dry-run # enseña el plan de REA sin escribir
rea-harness rea doctor          # prueba de solo lectura de las registraciones
rea-harness rea analyze <path> --json  # CLI de REA con la salida heredada
rea-harness rea evidence        # rutas del cuaderno de evidencia
rea-harness rea enable          # el comando exacto para un nuevo plan con REA
```

`rea setup` solo actúa si el plan aceptado seleccionó REA. `rea analyze` es una acción explícita:
no la ejecuta el instalador ni `doctor`.

### Clientes

| Asistente rsc | Cliente REA | Configuración |
| --- | --- | --- |
| `claude` | `claude_code` | `~/.claude.json` |
| `codex` | `codex` | `~/.codex/config.toml` |
| `cursor` | `cursor` | `~/.cursor/mcp.json` |
| `gemini` | `gemini_cli` | `~/.gemini/settings.json` |
| `windsurf` | `windsurf` | `~/.codeium/windsurf/mcp_config.json` |
| `opencode` | `opencode` | `$XDG_CONFIG_HOME/opencode/…` |
| `copilot` | `copilot_cli` | `~/.copilot/mcp-config.json` |
| `deepseek` | `dsh` | `$DSH_HOME/cordis.patch.yml` |
| `antigravity` | `antigravity` | `~/.gemini/config/mcp_config.json` |

El resto de asistentes reciben el skill y el fallback de CLI:

```bash
npx -y rea-agents@6.7.0 analyze-javascript-application /absolute/path/to/app --json
```

## Los tres carriles, y REA dentro de ellos

Cada turno toma exactamente un carril; el agente lo nombra en una línea.

1. **Answer.** Información: explicar, comparar, investigar, auditar, revisar. Es de solo lectura.
   REA encaja aquí cuando la respuesta depende del artefacto.
2. **FTD, Fast-Track Development.** El cambio ordinario: un documento de feature con intención,
   alcance, checklist, evidencia y siguiente paso.
3. **SDD, la cadena de diez fases.** Para lo grande o lo que tiene decisiones que se afectan entre
   sí. The agent enters it on its own; you approve the spec. El agente elige el carril y dice por qué.

REA **no es un cuarto carril**: es la evidencia dentro del carril que ya toca. Una investigación
Answer puede producir un target page; un FTD puede necesitar la evidencia para justificar un
cambio; una spec SDD puede apoyarse en la comparación de versiones.

## El arnés de rsc, intacto

Este fork conserva el motor de rsc 3.1.3: onboarding con plan aceptado por hash, catálogo de 272
skills, 18 asistentes, 34 agents y 53 command entries, hooks de Claude Code, worktrees por sesión,
knowledge sync, doctor, repair, backup, purge y los carriles Answer/FTD/SDD. Lo que cambia es la identidad del paquete, la
invocación (`rea-harness`), la capa REA y las pruebas que la cubren.

## Compartir el arnés

Whoever clones this repository gets the same harness. The version comes from `catalogVersion` in
`.rsc.json`, not from a floating tag: run `rea-harness sync` and the project rebuilds with the
catalog it declared. On the first session the harness tells you, in the first message, that it is
rebuilding from `.rsc.json`, and hands you the command naming the pinned version.

Commit `.rsc.json` and `.claude/rsc-bootstrap.mjs` (the committed bootstrap some assistants need)
so a clone can announce and rebuild. Per-machine state (backups, cached bases, secrets) stays out.

**Own skills.** The catalog never installs, updates or overwrites a folder it did not put there: your
own skills are yours, and a collision is shown before the plan is accepted.

### Asistentes soportados

`claude`, `codex`, `copilot`, `cursor`, `gemini`, `windsurf`, `cline`, `antigravity`, `zed`,
`continue`, `roo`, `amp`, `opencode`, `deepseek`, `jules`, `junie`, `kiro`, `aider`.

A post-merge hook retires the worktree once the branch lands. Los skills se escriben una vez en `.rsc/skills/<id>/`; cada asistente recibe un enlace (o una
copia convertida en Windows). En DeepSeek Harness se descubren de forma nativa en
`.dsh/skills/<id>/`.

### Doctor

```bash
rea-harness doctor --json
```

Además del estado del arnés, el informe incluye `rea`: si el plan lo seleccionó, si el workspace
está completo, qué clientes declara y qué lanzador resolvería. No descarga ni ejecuta nada; para
probar el servidor, `rea-harness rea doctor`.

### Desinstalar

```bash
rea-harness purge              # quita el arnés; conserva 02-DOCS/
rea-harness purge --with-docs  # quita también el conocimiento
npx -y rea-agents@6.7.0 uninstall  # quita solo lo que REA registró (config de usuario)
```

`purge` no toca la configuración de usuario de REA. Son dos propietarios distintos: el proyecto y
la cuenta.

## Seguridad y límites

- Analiza solo artefactos que el usuario posee o está autorizado a inspeccionar.
- No ejecutes objetivos no confiables, no extraigas credenciales y no eludas licencias.
- El análisis en ejecución se declara antes de ejecutarse y no amplía el objetivo ni la acción.
- REA no necesita cuenta ni API key. Los proveedores nativos (Hopper, Ghidra, IDA, JADX, Kuna,
  tshark, binwalk) son responsabilidad del operador y conservan su licencia.
- El informe separa siempre observación, inferencia y desconocido. Un límite de búsqueda no es una
  prueba de ausencia.

## Procedencia y licencias

- **rsc-harness 3.1.3** — © Eric Risco, MIT. Motor, catálogo, targets y hooks.
- **REA 6.7.0** — © morluto, MIT. Skill, referencias y CLI/MCP. Commit de origen `0bc2b42`.
- **Este fork** — cambios de integración, licencia MIT. No está afiliado a ninguno de los dos
  proyectos.

Los avisos completos están en [`UPSTREAM.md`](UPSTREAM.md), [`LICENSE`](LICENSE) y
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

---

## The catalog

272 skills, grouped by what you are trying to do. Click any skill to read its `SKILL.md`. It fires on
its own when a task matches.

### 🧭 Core & control plane

[init](skills/init/) · [harness](skills/harness/) · [orient](skills/orient/) · [suggest](skills/suggest/) · [unslop](skills/unslop/) · [author-skill](skills/author-skill/) · [sdd-init](skills/sdd-init/)

### 📐 Spec-Driven Development

Two lanes for change: `ftd` for ordinary work, and the ten-phase chain when durable artifacts would
settle a real ambiguity. `idea-refinement` runs inside `specify`; `decision-challenge` is on demand.

[ftd](skills/ftd/) · [sdd](skills/sdd/) · [constitution](skills/constitution/) · [idea-refinement](skills/idea-refinement/) · [specify](skills/specify/) · [clarify](skills/clarify/) · [plan](skills/plan/) · [tasks](skills/tasks/) · [analyze](skills/analyze/) · [decision-challenge](skills/decision-challenge/) · [implement](skills/implement/) · [source-grounded-development](skills/source-grounded-development/) · [verify](skills/verify/) · [review](skills/review/) · [simplify-code](skills/simplify-code/) · [ship](skills/ship/) · [debug](skills/debug/) · [worktrees](skills/worktrees/) · [parallel](skills/parallel/)

### 💼 Run a business

[finance-ops](skills/finance-ops/) · [invoicing](skills/invoicing/) · [bookkeeping](skills/bookkeeping/) · [pricing](skills/pricing/) · [sales-pipeline](skills/sales-pipeline/) · [lead-gen](skills/lead-gen/) · [cold-outreach](skills/cold-outreach/) · [proposals](skills/proposals/) · [contracts](skills/contracts/) · [customer-support](skills/customer-support/) · [client-onboarding](skills/client-onboarding/) · [retention](skills/retention/) · [hiring](skills/hiring/) · [people-ops](skills/people-ops/) · [inventory](skills/inventory/) · [logistics-ops](skills/logistics-ops/) · [procurement](skills/procurement/) · [meeting-notes](skills/meeting-notes/) · [sop-builder](skills/sop-builder/) · [project-ops](skills/project-ops/)

### 💸 Raise & model money

[pitch-deck](skills/pitch-deck/) · [investor-materials](skills/investor-materials/) · [financial-model](skills/financial-model/) · [fundraising](skills/fundraising/) · [unit-economics](skills/unit-economics/) · [grants](skills/grants/)

### ⚖️ Legal, privacy & compliance

[gdpr-privacy](skills/gdpr-privacy/) · [terms-conditions](skills/terms-conditions/) · [compliance](skills/compliance/) · [data-policy](skills/data-policy/) · [ip-trademark](skills/ip-trademark/)

### 📣 Market & brand

[marketing](skills/marketing/) · [seo-geo](skills/seo-geo/) · [content-engine](skills/content-engine/) · [social-publisher](skills/social-publisher/) · [brand-voice](skills/brand-voice/) · [brand-identity](skills/brand-identity/) · [newsletter](skills/newsletter/) · [landing-copy](skills/landing-copy/) · [ads](skills/ads/) · [article-writing](skills/article-writing/) · [case-studies](skills/case-studies/) · [video-shorts](skills/video-shorts/) · [podcast](skills/podcast/) · [market-research](skills/market-research/) · [competitor-watch](skills/competitor-watch/) · [press-kit](skills/press-kit/) · [community](skills/community/) · [webinar](skills/webinar/) · [review-management](skills/review-management/)

### 🎬 Grow a channel

Each with a `02-DOCS` feedback loop that learns from your own results.

[youtube-api](skills/youtube-api/) · [youtube-strategy](skills/youtube-strategy/) · [youtube-ideation](skills/youtube-ideation/) · [youtube-thumbnails](skills/youtube-thumbnails/) · [youtube-packaging](skills/youtube-packaging/) · [remotion-video](skills/remotion-video/) · [tiktok-api](skills/tiktok-api/) · [instagram-api](skills/instagram-api/) · [shortform-strategy](skills/shortform-strategy/) · [shortform-ideation](skills/shortform-ideation/) · [shortform-packaging](skills/shortform-packaging/) · [shortform-editing](skills/shortform-editing/) · [viral-score](skills/viral-score/) · [linkedin-api](skills/linkedin-api/) · [linkedin-strategy](skills/linkedin-strategy/) · [linkedin-content](skills/linkedin-content/) · [linkedin-carousels](skills/linkedin-carousels/) · [linkedin-outreach](skills/linkedin-outreach/) · [medium-writing](skills/medium-writing/) · [medium-publishing](skills/medium-publishing/) · [medium-strategy](skills/medium-strategy/)

### 🔌 Connect & automate

[connect-tool](skills/connect-tool/) · [stripe](skills/stripe/) · [email-connector](skills/email-connector/) · [google-workspace](skills/google-workspace/) · [notion-connector](skills/notion-connector/) · [whatsapp-telegram](skills/whatsapp-telegram/) · [automation-flows](skills/automation-flows/) · [api-connector-builder](skills/api-connector-builder/) · [webhooks](skills/webhooks/) · [data-scraper](skills/data-scraper/) · [spreadsheet-ops](skills/spreadsheet-ops/) · [calendar-scheduling](skills/calendar-scheduling/) · [document-processing](skills/document-processing/) · [e-signature](skills/e-signature/)

### ⚙️ Automation

Drive the big automation platforms through their REST API or MCP server. `automation-strategy` decides
whether, what and which platform.

[automation-strategy](skills/automation-strategy/) · [n8n](skills/n8n/) · [make](skills/make/) · [zapier](skills/zapier/) · [power-automate](skills/power-automate/)

### 📊 Data & analytics

[analytics](skills/analytics/) · [dashboard](skills/dashboard/) · [kpi-framework](skills/kpi-framework/) · [reporting](skills/reporting/) · [ab-testing](skills/ab-testing/) · [forecasting](skills/forecasting/) · [data-cleaning](skills/data-cleaning/) · [business-intelligence](skills/business-intelligence/)

### 🤖 AI: build it in

[building-agents](skills/building-agents/) · [rag](skills/rag/) · [embeddings-search](skills/embeddings-search/) · [prompt-engineering](skills/prompt-engineering/) · [llm-pipeline](skills/llm-pipeline/) · [agent-eval](skills/agent-eval/) · [chatbot](skills/chatbot/) · [ai-media](skills/ai-media/) · [replicate-images](skills/replicate-images/) · [structured-extraction](skills/structured-extraction/) · [agent-safety](skills/agent-safety/) · [cost-tracking](skills/cost-tracking/)

### 🛰️ AI: run it on

[replicate](skills/replicate/) · [runpod](skills/runpod/) · [modal](skills/modal/) · [huggingface](skills/huggingface/) · [ollama](skills/ollama/) · [together-fireworks](skills/together-fireworks/) · [fal](skills/fal/)

### 🎓 AI: train it

[machine-learning](skills/machine-learning/) · [deep-learning](skills/deep-learning/) · [nlp](skills/nlp/) · [finetuning](skills/finetuning/) · [training-data](skills/training-data/) · [unsloth](skills/unsloth/) · [open-weights](skills/open-weights/) · [vllm](skills/vllm/)

### 🗣️ Languages

[typescript](skills/typescript/) · [python](skills/python/) · [java](skills/java/) · [csharp-dotnet](skills/csharp-dotnet/) · [php](skills/php/) · [ruby](skills/ruby/) · [cpp](skills/cpp/) · [elixir](skills/elixir/) · [bash-scripting](skills/bash-scripting/) · [sql](skills/sql/) · [go](skills/go/)

### 🏗️ Frameworks & app stacks

[fastapi](skills/fastapi/) · [nextjs](skills/nextjs/) · [react](skills/react/) · [react-native](skills/react-native/) · [vue-nuxt](skills/vue-nuxt/) · [angular](skills/angular/) · [svelte](skills/svelte/) · [astro](skills/astro/) · [solid-js](skills/solid-js/) · [htmx](skills/htmx/) · [nodejs](skills/nodejs/) · [nestjs](skills/nestjs/) · [django](skills/django/) · [laravel](skills/laravel/) · [rails](skills/rails/) · [spring-boot](skills/spring-boot/) · [phoenix](skills/phoenix/) · [flutter](skills/flutter/) · [swift-ios](skills/swift-ios/) · [kotlin-android](skills/kotlin-android/) · [compose-multiplatform](skills/compose-multiplatform/) · [expo](skills/expo/) · [tauri](skills/tauri/) · [electron](skills/electron/) · [rust](skills/rust/) · [wordpress](skills/wordpress/) · [shopify](skills/shopify/) · [no-code-app](skills/no-code-app/) · [chrome-extension](skills/chrome-extension/) · [api-design](skills/api-design/)

### 🎮 Game development

[godot](skills/godot/) · [unity](skills/unity/) · [unreal](skills/unreal/) · [game-design](skills/game-design/) · [game-storytelling](skills/game-storytelling/) · [level-design](skills/level-design/) · [gamedev-shaders](skills/gamedev-shaders/) · [gamedev-multiplayer](skills/gamedev-multiplayer/) · [gamedev-physics](skills/gamedev-physics/) · [gamedev-pathing](skills/gamedev-pathing/) · [gamedev-shipping](skills/gamedev-shipping/)

### 🗄️ Databases & data layer

[postgresdb](skills/postgresdb/) · [mysql](skills/mysql/) · [mongodb](skills/mongodb/) · [redis](skills/redis/) · [supabase](skills/supabase/) · [neon](skills/neon/) · [planetscale](skills/planetscale/) · [sqlite-turso](skills/sqlite-turso/) · [prisma-orm](skills/prisma-orm/) · [drizzle-orm](skills/drizzle-orm/) · [firebase](skills/firebase/) · [dynamodb](skills/dynamodb/) · [vector-db](skills/vector-db/) · [clickhouse-analytics](skills/clickhouse-analytics/) · [duckdb](skills/duckdb/) · [db-migrations](skills/db-migrations/) · [backups](skills/backups/)

### ☁️ Ship & operate: platforms

[vercel](skills/vercel/) · [netlify](skills/netlify/) · [cloudflare](skills/cloudflare/) · [railway](skills/railway/) · [render](skills/render/) · [fly-io](skills/fly-io/) · [coolify](skills/coolify/) · [hetzner](skills/hetzner/) · [digitalocean](skills/digitalocean/) · [aws-essentials](skills/aws-essentials/) · [gcp-essentials](skills/gcp-essentials/)

### 🛠️ Ship & operate: devops

[docker](skills/docker/) · [github-actions](skills/github-actions/) · [git-workflow](skills/git-workflow/) · [domains-dns](skills/domains-dns/) · [monitoring](skills/monitoring/) · [email-deliverability](skills/email-deliverability/) · [scaling](skills/scaling/) · [deployment](skills/deployment/) · [deprecation](skills/deprecation/)

### 🔒 Ship & operate: quality & security

[code-review](skills/code-review/) · [security-scan](skills/security-scan/) · [rea](skills/rea/) · [secure-coding](skills/secure-coding/) · [testing-py](skills/testing-py/) · [testing-web](skills/testing-web/) · [testing-go](skills/testing-go/) · [e2e-testing](skills/e2e-testing/) · [accessibility](skills/accessibility/) · [performance](skills/performance/) · [error-handling](skills/error-handling/) · [observability](skills/observability/)

### 🌀 Motion & interface craft

[motion-craft](skills/motion-craft/) · [ui-engineering](skills/ui-engineering/) · [variant-explorer](skills/variant-explorer/)

### 🎨 Design & content craft

[design-loop](skills/design-loop/) · [design](skills/design/) · [design-dna](skills/design-dna/) · [presentations](skills/presentations/) · [course-storytelling](skills/course-storytelling/) · [course-builder](skills/course-builder/) · [technical-writing](skills/technical-writing/) · [translation-l10n](skills/translation-l10n/)

### 🧠 Knowledge & meta

[knowledge-ops](skills/knowledge-ops/) · [codebase-onboarding](skills/codebase-onboarding/) · [research-ops](skills/research-ops/) · [decision-records](skills/decision-records/) · [continuous-learning](skills/continuous-learning/) · [skill-scout](skills/skill-scout/) · [context-budget](skills/context-budget/) · [roast-me](skills/roast-me/) · [fable-operator](skills/fable-operator/)

### 🧬 Reverse engineering & artifacts

[rea](skills/rea/) — evidencia de artefactos con REA: ASAR/Electron, binarios nativos, APK, firmware, navegador, capturas y comportamiento en ejecución. Se instala solo con `--with-rea`.


## Contribuir

Este es un repositorio privado. Antes de cambiar el motor, lee `AGENTS.md` del upstream y ejecuta:

```bash
npm run validate
npm run manifest:check
npm test
npm run drift:check
```

Las pruebas nuevas de la capa REA viven en `tests/rea-*.test.js`. No publiques el paquete en npm:
`private: true` es deliberado.
