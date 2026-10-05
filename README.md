# Arc Code

Analisador de arquitetura para projetos TypeScript/JavaScript. Lê o código-fonte real e gera diagramas Mermaid descrevendo a arquitetura **que existe**, não uma arquitetura ideal inventada.

```bash
npx arc-code generate-diagrams
```

## O que é — e o que não é

- **Não usa IA.** Nenhuma chamada de rede, nenhuma API key, nenhum modelo.
- **Análise 100% estática**, via TypeScript Compiler API. O código do projeto analisado nunca é executado.
- **Determinístico**: rodar duas vezes no mesmo código produz o mesmo resultado (ignorando o timestamp do manifest).
- Quando uma informação não pode ser determinada estaticamente, o Arc Code mostra `unknown` ou omite — nunca inventa.

A IA é uma consumidora futura do Arc Code, não uma dependência dele. O formato `.arch/` é pensado para ser lido por ferramentas como Claude Code, Cursor etc., não para substituir o julgamento humano sobre arquitetura.

## Uso

```bash
cd seu-projeto
npx arc-code generate-diagrams
```

Gera uma pasta `.arch/` na raiz do projeto analisado:

```
.arch/
  architecture.mmd    # camadas detectadas (ou o grafo real de diretórios, se não houver camadas conhecidas)
  routes.mmd           # rotas HTTP (Express) -> handler -> chamadas diretas -> retorno (flowchart)
  sequence.mmd         # as mesmas rotas, como sequenceDiagram (quem chama quem, em ordem)
  classes.mmd          # classes/interfaces, membros, e relações extends/implements/uses
  dependencies.mmd     # grafo de imports, com ciclos e violações de camada marcados
  functions.mmd        # toda função/método, com complexidade Big-O estimada e grafo de chamadas
  manifest.json        # versão, linguagem, arquivos analisados, timestamp, e um ÍNDICE (ver abaixo)
  domains/             # uma subpasta por recurso detectado (ver "Sub-fluxos por recurso" abaixo)
    <recurso>/         # ex: customer/, deal/ — os mesmos 6 .mmd, recortados pra esse recurso
      architecture.mmd
      routes.mmd
      classes.mmd
      dependencies.mmd
      functions.mmd
      sequence.mmd
  routes/              # um .mmd por rota, flowchart (ver "Mini-fluxos" abaixo)
  sequence/            # a mesma rota, sequenceDiagram
  functions/           # um .mmd por função/método
  classes/             # um .mmd por classe/interface
  dependencies/        # um .mmd por módulo
```

**`manifest.json` tem um `index`** mapeando cada rota/função/classe/módulo direto pro seu arquivo de mini-fluxo (ex: `index.routes["POST /customers"] -> "routes/00_POST__customers.mmd"`) — pra responder "me mostra o fluxo de X" sem precisar listar a pasta e adivinhar o nome do arquivo primeiro.

Outros comandos:

```bash
npx arc-code --help
npx arc-code --version
```

Os arquivos `.mmd` são [Mermaid](https://mermaid.js.org/) puro — abra com a extensão de preview do VSCode, cole em [mermaid.live](https://mermaid.live), ou renderize com `@mermaid-js/mermaid-cli`.

## Os 6 diagramas

### architecture.mmd
Procura nomes de pasta conhecidos (`controllers`, `services`, `domain`, `repositories`, `database`, ...) em qualquer profundidade do projeto. Se encontrar 2 ou mais, desenha a cadeia na ordem canônica (ex: `Controller → Service → Domain → Repository`). Se não encontrar, mostra o grafo real de dependências entre diretórios — nunca inventa uma camada que não existe.

### routes.mmd
Detecta rotas estilo Express (`app.get/post/put/delete/patch`). Para cada rota: method, path, handler resolvido, chamadas feitas diretamente dentro do handler (profundidade 1, incluindo dentro de `async`/`await`), e tipo de retorno quando anotado.

**Limitação conhecida:** só Express. Decorators do NestJS (`@Get`, `@Controller`) não são suportados nesta versão.

### sequence.mmd
As mesmas rotas de `routes.mmd`, como `sequenceDiagram` em vez de `flowchart` — `Client->>Handler: POST /customers`, `Handler->>customerService: create()`, `Handler-->>Client: returns void`. É o formato nativo do Mermaid pra "quem chama quem, em que ordem", então fica mais denso/legível que o flowchart equivalente pra esse tipo de informação.

**Nota técnica:** mensagens de sequence diagram usam texto crú (`Promise<void>` sem escapar), ao contrário de `routes.mmd`/`architecture.mmd`/`dependencies.mmd` que escapam `<`/`>` como entidade HTML. Isso não é inconsistência — o parser do Mermaid pra `sequenceDiagram` decodifica entidades de volta pra caractere literal antes de re-tokenizar, então `&lt;` quebra o parser pior do que um `<` crú quebraria (verificado contra o parser real, não é suposição).

### classes.mmd
Classes e interfaces, com métodos, propriedades, visibilidade e tipos. Três tipos de relação:
- `--|> : extends`
- `..|> : implements`
- `--> : uses` — derivada de qualquer classe/interface conhecida referenciada em parâmetro de construtor, propriedade ou assinatura de método (ex: `CustomerService --> CustomerRepository` porque é injetada no construtor).

### dependencies.mmd
Grafo de imports entre arquivos do projeto, mais pacotes externos. Marca:
- **ciclos** (`A --> B` rotulado `cycle`)
- **violações de camada** (`A --> B` rotulado `violation`) — só quando `architecture.mmd` detectou camadas conhecidas, e só na direção errada (ex: `Service` importando `Controller`). Camadas fundacionais (`domain`/`model`/`entity`) podem ser importadas por qualquer camada sem gerar violação — é o padrão esperado, não um erro.

### functions.mmd
Toda função, método e handler de objeto literal, com:
- assinatura simplificada (Mermaid não aceita tipos TypeScript arbitrários em `classDiagram`, então parâmetros mostram só o nome, e o tipo de retorno passa por uma sanitização: genéricos `Promise<T>` → `Promise~T~`, uniões `A | B` → `A or B`, tipos de objeto literal → `object`);
- **complexidade Big-O estimada** (heurística — ver abaixo);
- **grafo de chamadas** (`--> : calls`), resolvido via type-checker (não por nome de variável), restrito a chamadas para outras funções que o próprio Arc Code analisou.

## Sub-fluxos por recurso

Além dos 5 arquivos na raiz de `.arch/` (visão do projeto inteiro), o Arc Code detecta **recursos** pelo nome dos arquivos e gera uma subpasta com os mesmos 5 diagramas, só com aquele recorte — útil quando o projeto tem várias features e o diagrama geral fica difícil de ler.

Um recurso é um grupo de 2+ arquivos que compartilham o mesmo prefixo de nome, ignorando o sufixo de papel (`Controller`, `Service`, `Repository`, `Repo`, `Dao`, `Model`, `Entity`):

```
customerController.ts + customerService.ts + customerRepository.ts + domain/customer.ts
  -> recurso "customer" -> .arch/domains/customer/*.mmd
```

Arquivos de infraestrutura (`app.ts`, `index.ts`, `main.ts`, `server.ts`, `cli.ts`) e recursos com um único arquivo são ignorados — não representam um fluxo cruzando camadas.

**O sub-fluxo não fica isolado só nos arquivos do próprio recurso.** Se um arquivo do recurso importa algo de outro recurso (ex: `historyService.ts` usa `DealRepository` e `PaymentRepository`), esse vizinho direto (1 salto, sem recursão) entra no recorte também — senão o diagrama de `history` pareceria não depender de nada, o que seria falso. Rotas são atribuídas ao recurso que implementa o handler (resolvido via o mesmo type-checker), não ao arquivo onde a rota é registrada — então rotas centralizadas em `app.ts` ainda aparecem no `routes.mmd` do recurso certo.

**Limitação conhecida:** é uma convenção de nomenclatura (`recursoController.ts`, `recursoService.ts`, ...). Projetos que não prefixam arquivos pelo nome do recurso (ex: `controller.ts` genérico, ou convenção `recurso.controller.ts` do NestJS) não vão agrupar — só os 6 arquivos da raiz são gerados.

## Mini-fluxos

Dentro de `routes/`, `sequence/`, `functions/`, `classes/` e `dependencies/`, cada arquivo é a menor unidade "navegável" daquele diagrama — a ideia é poder abrir uma rota, uma função ou uma classe isoladamente sem carregar o diagrama gigante do projeto inteiro:

- **`routes/<n>_<METHOD>_<path>.mmd`** — uma rota isolada: `request → handler → calls → return`, como flowchart. O índice numérico garante nome único mesmo se duas rotas tiverem paths parecidos.
- **`sequence/<n>_<METHOD>_<path>.mmd`** — a mesma rota isolada, como `sequenceDiagram`.
- **`functions/<Nome>.mmd`** — uma função/método mais seus vizinhos diretos **nas duas direções**: quem ela chama e quem a chama. Sem isso, olhar uma função isolada não diria nada sobre seu papel no fluxo.
- **`classes/<Nome>.mmd`** — uma classe/interface mais suas relações diretas (extends/implements/uses), também nas duas direções — inclui quem usa essa classe, não só o que ela usa.
- **`dependencies/<modulo>.mmd`** — um arquivo mais seus imports diretos (o que ele importa e quem o importa), com ciclos/violações já filtrados pra só os que tocam aquele módulo.

Essas pastas **não substituem** os 6 arquivos da raiz — são uma visão complementar, granular, pra quando o arquivo único vira grande demais pra ler de uma vez. Pra achar o arquivo certo sem listar a pasta, use o `index` do `manifest.json`.

## Sobre a complexidade Big-O

É uma **heurística de reconhecimento de padrões no AST**, não uma prova matemática nem uma medição real (o Arc Code nunca executa o código para medir tempo). Ela reconhece:

- profundidade de aninhamento de loops (`for`/`while`/`do`, e métodos de array como `.map`/`.forEach`/`.filter`/`.sort`) → `O(1)`, `O(n)`, `O(n²)`, ...
- loops com contador geométrico (`i *= 2`, `n = n >> 1`) e o idioma clássico de busca binária (`low`/`high`/`mid`) → `O(log n)`
- recursão simples vs. recursão com múltiplas chamadas (ex: Fibonacci ingênuo) → `(recursive)` / `O(2^n) (recursive, multiple self-calls)`
- recursão divide-and-conquer com as chamadas sobre a metade do input (ex: merge sort) → `O(n log n) (recursive, divide-and-conquer)`

**Isso não prova nada.** Um algoritmo escrito de forma não-convencional, ou uma divisão por uma constante diferente de 2, pode escapar da detecção e aparecer como `O(n)`/`O(1)` por padrão. Trate como um primeiro sinal para revisão humana, não como verdade absoluta.

## Limitações de análise estática

- Rotas: só padrão Express (`app.method(path, handler)`); sem suporte a decorators (NestJS) nesta versão.
- Cadeia de chamadas em `routes.mmd`: profundidade 1 (só o que o handler chama diretamente).
- `functions.mmd`: grafo de chamadas só conecta funções que o próprio Arc Code analisou — chamadas para bibliotecas externas (Stripe, Express, etc.) são omitidas do grafo, não inventadas.
- Genéricos TypeScript: só um nível (`Promise<Array<T>>` perde os brackets internos ao virar Mermaid-safe).
- Camadas de arquitetura: reconhece uma lista fixa de nomes de pasta em inglês (`controller`, `service`, `domain`, `repository`, `model`, `entity`, `route`, `middleware`, `dao`, `database`, `db`). Projetos com nomenclatura diferente caem no grafo real de diretórios.

## Desenvolvimento

```bash
npm install
npm test     # build + testes (node:test embutido)
npm run build
```

`examples/sample-project/` é uma API de CRM (Customer/Deal/Payment com Stripe + histórico agregado) usada para validar manualmente os diagramas gerados.
