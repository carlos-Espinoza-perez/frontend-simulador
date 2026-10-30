import type { Monaco } from '@monaco-editor/react';
import pythonIdeService from '../../../services/pythonIdeService';

let isRegistered = false;

const DEFAULT_SIGNALS: Array<{ name: string; type: 'DI' | 'DO'; desc: string }> = [
  { name: 'di_pieza_presente', type: 'DI', desc: 'Sensor de pieza en mesa de trabajo' },
  { name: 'di_ciclo_inicio', type: 'DI', desc: 'Botonera de inicio de ciclo' },
  { name: 'di_parada_celda', type: 'DI', desc: 'Pulsador de paro de ciclo' },
  { name: 'di_robot_listo', type: 'DI', desc: 'Confirmacion de robot en posicion' },
  { name: 'di_pinza_abierta', type: 'DI', desc: 'Fin de carrera pinza abierta' },
  { name: 'di_pinza_cerrada', type: 'DI', desc: 'Fin de carrera pinza cerrada' },
  { name: 'do_valvula_aire', type: 'DO', desc: 'Valvula de alimentacion neumatica' },
  { name: 'do_pinza_actuar', type: 'DO', desc: 'Cilindro actuador de mordaza' },
  { name: 'do_indicador_verde', type: 'DO', desc: 'Luz indicadora de ejecucion' },
  { name: 'do_indicador_rojo', type: 'DO', desc: 'Luz indicadora de alarma' },
  { name: 'do_indicador_amarillo', type: 'DO', desc: 'Luz indicadora de espera' },
  { name: 'di1', type: 'DI', desc: 'Entrada digital 1' },
  { name: 'di2', type: 'DI', desc: 'Entrada digital 2' },
  { name: 'di3', type: 'DI', desc: 'Entrada digital 3' },
  { name: 'di4', type: 'DI', desc: 'Entrada digital 4' },
  { name: 'di5', type: 'DI', desc: 'Entrada digital 5' },
  { name: 'di6', type: 'DI', desc: 'Entrada digital 6' },
  { name: 'di7', type: 'DI', desc: 'Entrada digital 7' },
  { name: 'di8', type: 'DI', desc: 'Entrada digital 8' },
  { name: 'do1', type: 'DO', desc: 'Salida digital 1' },
  { name: 'do2', type: 'DO', desc: 'Salida digital 2' },
  { name: 'do3', type: 'DO', desc: 'Salida digital 3' },
  { name: 'do4', type: 'DO', desc: 'Salida digital 4' },
  { name: 'do5', type: 'DO', desc: 'Salida digital 5' },
  { name: 'do6', type: 'DO', desc: 'Salida digital 6' },
  { name: 'do7', type: 'DO', desc: 'Salida digital 7' },
  { name: 'do8', type: 'DO', desc: 'Salida digital 8' },
];

let cachedSignals = [...DEFAULT_SIGNALS];
let lastSignalFetch = 0;

async function getLiveSignals() {
  const now = Date.now();
  if (now - lastSignalFetch > 4000) {
    lastSignalFetch = now;
    try {
      const live = await pythonIdeService.listVirtualSignals();
      if (live && live.length > 0) {
        cachedSignals = live.map((s) => ({
          name: s.name,
          type: s.type,
          desc: s.description || `Señal ${s.type} (Valor: ${s.value})`,
        }));
      }
    } catch {
    }
  }
  return cachedSignals;
}

export function setupPythonAutocomplete(monaco: Monaco) {
  if (isRegistered) return;
  isRegistered = true;

  if (!monaco.languages.getLanguages().some((l) => l.id === 'rapid')) {
    monaco.languages.register({ id: 'rapid' });
    monaco.languages.setMonarchTokensProvider('rapid', {
      ignoreCase: true,
      keywords: [
        'MODULE', 'ENDMODULE', 'PROC', 'ENDPROC', 'FUNC', 'ENDFUNC',
        'VAR', 'PERS', 'CONST', 'IF', 'THEN', 'ELSE', 'ELSEIF', 'ENDIF',
        'FOR', 'FROM', 'TO', 'STEP', 'ENDFOR', 'WHILE', 'DO', 'ENDWHILE',
        'RETURN', 'GOTO', 'TEST', 'CASE', 'DEFAULT', 'ENDTEST'
      ],
      builtins: [
        'MoveJ', 'MoveL', 'MoveC', 'WaitTime', 'WaitDI', 'WaitDO',
        'SetDO', 'Reset', 'PulseDO', 'InvertDO', 'TPWrite', 'Stop'
      ],
      types: [
        'num', 'bool', 'string', 'robtarget', 'jointtarget', 'speeddata',
        'zonedata', 'tooldata', 'wobjdata', 'clock', 'signaldi', 'signaldo'
      ],
      tokenizer: {
        root: [
          [/![^\n]*/, 'comment'],
          [/"([^"\\]|\\.)*"/, 'string'],
          [/[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/, 'number'],
          [/[a-zA-Z_][a-zA-Z0-9_]*/, {
            cases: {
              '@keywords': 'keyword',
              '@builtins': 'predefined',
              '@types': 'type',
              '@default': 'identifier'
            }
          }],
          [/:=/, 'delimiter'],
          [/[\(\)\[\],;]/, 'delimiter'],
        ]
      }
    });

    monaco.languages.registerCompletionItemProvider('rapid', {
      provideCompletionItems: () => {
        const rapidKeywords = [
          'MoveJ', 'MoveL', 'MoveC', 'WaitTime', 'WaitDI', 'SetDO', 'Reset', 'PulseDO',
          'robtarget', 'jointtarget', 'speeddata', 'zonedata', 'tooldata', 'wobjdata',
          'MODULE', 'ENDMODULE', 'PROC', 'ENDPROC', 'CONST', 'VAR', 'PERS', 'IF', 'THEN', 'ENDIF'
        ];
        return {
          suggestions: rapidKeywords.map((kw) => ({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
          })),
        };
      },
    });
  }

  const PYTHON_KEYWORDS = [
    'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
    'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for',
    'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None',
    'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try',
    'while', 'with', 'yield'
  ];

  const PYTHON_BUILTINS = [
    { name: 'print', desc: 'print(*values, sep=" ", end="\\n", file=sys.stdout)' },
    { name: 'len', desc: 'len(obj) -> Return the number of items in a container' },
    { name: 'range', desc: 'range(stop) or range(start, stop[, step])' },
    { name: 'enumerate', desc: 'enumerate(iterable, start=0) -> (0, seq[0]), (1, seq[1]), ...' },
    { name: 'zip', desc: 'zip(*iterables) -> Iterate over several iterables in parallel' },
    { name: 'isinstance', desc: 'isinstance(object, classinfo) -> bool' },
    { name: 'dict', desc: 'dict(**kwargs) or dict(mapping) -> new dictionary' },
    { name: 'list', desc: 'list(iterable) -> new list initialized from iterable' },
    { name: 'set', desc: 'set(iterable) -> new set object' },
    { name: 'int', desc: 'int(x=0) or int(x, base=10) -> integer' },
    { name: 'str', desc: 'str(object="") -> text string representation' },
    { name: 'float', desc: 'float(x=0.0) -> floating point number' },
    { name: 'type', desc: 'type(object) -> the object\'s type' },
    { name: 'open', desc: 'open(file, mode="r", encoding=None) -> file object' }
  ];

  const ROBOT_API_ITEMS = [
    {
      label: 'RobotClient',
      kind: monaco.languages.CompletionItemKind.Class,
      detail: 'abb_irc5.RobotClient(host="127.0.0.1", port=5001, timeout=3.0, mode="SIMULATED")',
      insertText: 'RobotClient(host="${1:127.0.0.1}", port=${2:5001})',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Cliente TCP nativo para comunicación con ABB IRC5 mediante RobotWare 6.'
    },
    {
      label: 'robot.connect()',
      kind: monaco.languages.CompletionItemKind.Method,
      detail: 'robot.connect(timeout=3.0) -> dict',
      insertText: 'connect(timeout=${1:3.0})',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Abre conexión TCP con el controlador IRC5.'
    },
    {
      label: 'robot.ping()',
      kind: monaco.languages.CompletionItemKind.Method,
      detail: 'robot.ping() -> dict',
      insertText: 'ping()',
      documentation: 'Envía PING al IRC5 y calcula la latencia RTT en milisegundos.'
    },
    {
      label: 'robot.get_status()',
      kind: monaco.languages.CompletionItemKind.Method,
      detail: 'robot.get_status() -> dict',
      insertText: 'get_status()',
      documentation: 'Consulta el estado de ejecución del programa y modo del controlador.'
    },
    {
      label: 'robot.get_di()',
      kind: monaco.languages.CompletionItemKind.Method,
      detail: 'robot.get_di(name: str) -> dict',
      insertText: 'get_di("${1:di_pieza_presente}")',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Lee el valor de una entrada digital (DI) autorizada.'
    },
    {
      label: 'robot.get_do()',
      kind: monaco.languages.CompletionItemKind.Method,
      detail: 'robot.get_do(name: str) -> dict',
      insertText: 'get_do("${1:do_valvula_aire}")',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Lee el estado de una salida digital (DO) autorizada.'
    },
    {
      label: 'robot.set_do()',
      kind: monaco.languages.CompletionItemKind.Method,
      detail: 'robot.set_do(name: str, value: int, physical_confirmed=False) -> dict',
      insertText: 'set_do("${1:do_valvula_aire}", ${2:1})',
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Modifica el estado (0 o 1) de una salida digital autorizada.'
    },
    {
      label: 'robot.disconnect()',
      kind: monaco.languages.CompletionItemKind.Method,
      detail: 'robot.disconnect() -> dict',
      insertText: 'disconnect()',
      documentation: 'Cierra la conexión TCP con el controlador IRC5 de forma segura.'
    }
  ];

  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.', '(', ' ', '"', "'", '_', 'd'],
    provideCompletionItems: async (model, position) => {
      const code = model.getValue();
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const lineContent = model.getLineContent(position.lineNumber);
      const prefixBeforeCursor = lineContent.substring(0, position.column - 1);

      const diCallMatch = prefixBeforeCursor.match(/(?:get_di)\s*\(\s*(['"]?)([^'",\)]*)$/i);
      const doCallMatch = prefixBeforeCursor.match(/(?:get_do|set_do)\s*\(\s*(['"]?)([^'",\)]*)$/i);
      const isDiPrefix = word.word.startsWith('di_') || word.word === 'di';
      const isDoPrefix = word.word.startsWith('do_') || word.word === 'do';

      const signals = await getLiveSignals();

      if (diCallMatch || doCallMatch || isDiPrefix || isDoPrefix) {
        const quote = diCallMatch ? diCallMatch[1] : (doCallMatch ? doCallMatch[1] : '');
        const targetType = (diCallMatch || isDiPrefix) ? 'DI' : 'DO';

        const signalCompletions = signals
          .filter((s) => {
            if (diCallMatch) return s.type === 'DI';
            if (doCallMatch) return s.type === 'DO';
            if (isDiPrefix && !isDoPrefix) return s.type === 'DI';
            if (isDoPrefix && !isDiPrefix) return s.type === 'DO';
            return true;
          })
          .map((s) => {
            const needsQuotes = (diCallMatch || doCallMatch) && !quote;
            const insertText = needsQuotes ? `"${s.name}"` : s.name;

            return {
              label: s.name,
              kind: monaco.languages.CompletionItemKind.EnumMember,
              detail: `[${s.type}] ${s.desc}`,
              documentation: `Señal ${s.type} configurada en el gemelo digital / IRC5.\nNombre: ${s.name}\nDescripción: ${s.desc}`,
              insertText,
              range,
              sortText: `0_${s.type === targetType ? '0' : '1'}_${s.name}`,
            };
          });

        if (diCallMatch || doCallMatch) {
          return { suggestions: signalCompletions };
        }
      }

      let jediSuggestions: any[] = [];
      try {
        const rawJedi = await pythonIdeService.getAutocompleteSuggestions(
          code,
          position.lineNumber,
          position.column
        );
        jediSuggestions = rawJedi.map((item) => ({
          label: item.label,
          kind: item.kind || monaco.languages.CompletionItemKind.Variable,
          detail: item.detail,
          documentation: item.documentation,
          insertText: item.insertText,
          range,
        }));
      } catch {
        jediSuggestions = [];
      }

      if (prefixBeforeCursor.trim().endsWith('.')) {
        if (jediSuggestions.length > 0) {
          return { suggestions: jediSuggestions };
        }
        if (prefixBeforeCursor.includes('robot.')) {
          return {
            suggestions: ROBOT_API_ITEMS.filter((i) => i.label.startsWith('robot.')).map((i) => ({
              ...i,
              label: i.label.replace('robot.', ''),
              range,
            })),
          };
        }
      }

      const localVariables = new Set<string>();
      const varMatches = code.matchAll(/^([a-zA-Z_]\w*)\s*=/gm);
      for (const m of varMatches) {
        if (m[1] && !PYTHON_KEYWORDS.includes(m[1])) {
          localVariables.add(m[1]);
        }
      }
      const funcMatches = code.matchAll(/^def\s+([a-zA-Z_]\w*)\s*\(/gm);
      for (const m of funcMatches) {
        if (m[1]) localVariables.add(m[1]);
      }

      const localSuggestions = Array.from(localVariables).map((name) => ({
        label: name,
        kind: monaco.languages.CompletionItemKind.Variable,
        detail: '(local variable / function)',
        insertText: name,
        range,
      }));

      const keywordSuggestions = PYTHON_KEYWORDS.map((kw) => ({
        label: kw,
        kind: monaco.languages.CompletionItemKind.Keyword,
        detail: '(keyword)',
        insertText: kw,
        range,
      }));

      const builtinSuggestions = PYTHON_BUILTINS.map((b) => ({
        label: b.name,
        kind: monaco.languages.CompletionItemKind.Function,
        detail: b.desc,
        insertText: `${b.name}($0)`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      }));

      const generalSignalSuggestions = signals.map((s) => ({
        label: s.name,
        kind: monaco.languages.CompletionItemKind.EnumMember,
        detail: `[${s.type}] ${s.desc}`,
        documentation: `Señal ${s.type} de la celda robótica.\n${s.desc}`,
        insertText: s.name,
        range,
        sortText: `1_${s.name}`,
      }));

      const seenLabels = new Set<string>();
      const combined = [
        ...generalSignalSuggestions,
        ...jediSuggestions,
        ...ROBOT_API_ITEMS.map((item) => ({ ...item, range })),
        ...localSuggestions,
        ...keywordSuggestions,
        ...builtinSuggestions,
      ].filter((item) => {
        if (seenLabels.has(item.label)) return false;
        seenLabels.add(item.label);
        return true;
      });

      return { suggestions: combined };
    },
  });

  monaco.languages.registerInlineCompletionsProvider('python', {
    provideInlineCompletions: async (model, position) => {
      const codeBeforeCursor = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const lineContent = model.getLineContent(position.lineNumber);
      const trimmed = lineContent.trim();
      if (!trimmed || trimmed.length < 3) {
        return { items: [] };
      }

      try {
        const completion = await pythonIdeService.getAiCompletion(codeBeforeCursor);
        if (!completion) return { items: [] };

        return {
          items: [
            {
              insertText: completion,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
            },
          ],
        };
      } catch {
        return { items: [] };
      }
    },
    freeInlineCompletions() {},
  });
}
