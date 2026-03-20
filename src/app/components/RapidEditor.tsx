import { Terminal, X, GripVertical, Maximize2, Minimize2, Play, Save, FileCode, Loader2, Square, Upload, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useDraggable } from '../hooks/useDraggable';
import Editor, { Monaco } from '@monaco-editor/react';
import axios from 'axios';
import websocketService from '../../services/websocketService';

interface RapidEditorProps {
  onClose: () => void;
  onExpand?: (expanded: boolean) => void;
  onExecuteMovement?: (joints: number[]) => void;
  externalCode?: string;
  robotType?: 'ABB IRB 140' | 'IRB 910SC SCARA';
}

interface Movement {
  step: number;
  type: string;
  target: string;
  joints?: number[];
  position?: { x: number; y: number; z: number };
  speed: string;
  zone: string;
}

const RAPID_TEMPLATE = `MODULE Module1
  CONST jointtarget ZERO:=[[0,0,0,0,0,0],[9E+9,9E+9,9E+9,9E+9,9E+9,9E+9]];
  CONST robtarget P10:=[[450,0,450],[4.14816E-8,6.1133E-9,-1,-2.53589E-16],[0,0,-1,0],[9E+9,9E+9,9E+9,9E+9,9E+9,9E+9]];
  CONST robtarget P20:=[[450,0,400],[4.14816E-8,6.1133E-9,-1,-2.53589E-16],[0,0,-1,0],[9E+9,9E+9,9E+9,9E+9,9E+9,9E+9]];
  CONST robtarget P30:=[[550,0,400],[4.14816E-8,6.1133E-9,-1,-2.53589E-16],[0,0,-1,0],[9E+9,9E+9,9E+9,9E+9,9E+9,9E+9]];
  
  PROC main()
    MoveAbsJ ZERO\\NoEOffs, v1000, fine, tool0;
    MoveJ P10, v1000, fine, tool0;
    MoveL P20, v1000, fine, tool0;
    MoveL P30, v1000, fine, tool0;
    MoveL P20, v1000, fine, tool0;
    MoveAbsJ ZERO\\NoEOffs, v1000, fine, tool0;
  ENDPROC
ENDMODULE`;

export function RapidEditor({ onClose, onExpand, onExecuteMovement, externalCode, robotType }: RapidEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [code, setCode] = useState(RAPID_TEMPLATE);
  const [output, setOutput] = useState<string[]>([
    '> Editor RAPID inicializado',
    '> Listo para programar',
  ]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [useWebSocket, setUseWebSocket] = useState(true); // Preferir WebSocket
  const editorRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { position, isDragging, dragRef, handleMouseDown } = useDraggable({
    initialPosition: { x: window.innerWidth / 2 - 400, y: window.innerHeight - 280 },
  });

  useEffect(() => {
    if (externalCode) {
      setCode(externalCode);
      addOutput('> Código importado desde Grabador de Trayectoria');
    }
  }, [externalCode]);

  const handleEditorWillMount = (monaco: Monaco) => {

    const isRegistered = monaco.languages.getLanguages().some((lang: any) => lang.id === 'rapid');
    if (isRegistered) return;

    monaco.languages.register({ id: 'rapid' });

    monaco.languages.setMonarchTokensProvider('rapid', {
      keywords: [
        'MODULE', 'ENDMODULE', 'PROC', 'ENDPROC', 'CONST', 'VAR', 'PERS',
        'MoveJ', 'MoveL', 'MoveAbsJ', 'MoveC', 'fine', 'z10', 'z50', 'v1000', 'v500', 'tool0'
      ],
      tokenizer: {
        root: [
          [/[a-zA-Z_]\w*/, {
            cases: {
              '@keywords': 'keyword',
              '@default': 'identifier'
            }
          }],
          [/[0-9]+(\.[0-9]+)?([eE][\-+]?[0-9]+)?/, 'number'],
          [/!.*$/, 'comment'], // Comentarios en RAPID inician con !
          [/[\[\](){}]/, 'delimiter.bracket'],
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string'],
        ],
        string: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape.invalid'],
          [/"/, 'string', '@pop']
        ]
      }
    });

    monaco.languages.registerCompletionItemProvider('rapid', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const suggestions = [
          {
            label: 'MoveJ',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'MoveJ ${1:P10}, ${2:v1000}, ${3:fine}, ${4:tool0};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Movimiento articular',
            range
          },
          {
            label: 'MoveL',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'MoveL ${1:P10}, ${2:v1000}, ${3:fine}, ${4:tool0};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Movimiento lineal',
            range
          },
          {
            label: 'MoveAbsJ',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'MoveAbsJ ${1:ZERO\\NoEOffs}, ${2:v1000}, ${3:fine}, ${4:tool0};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Movimiento a coordenadas articulares',
            range
          },
          {
            label: 'MODULE',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'MODULE ${1:Module1}\n\t$0\nENDMODULE',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range
          },
          {
            label: 'PROC',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'PROC ${1:main}()\n\t$0\nENDPROC',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range
          },
          {
            label: 'CONST robtarget',
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: 'CONST robtarget ${1:P10}:=[[${2:0},${3:0},${4:0}],[1,0,0,0],[0,0,0,0],[9E+9,9E+9,9E+9,9E+9,9E+9,9E+9]];',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range
          }
        ];
        return { suggestions };
      }
    });
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;

    editor.updateOptions({
      fontSize: 13,
      minimap: { enabled: isExpanded },
      scrollBeyondLastLine: false,
      lineNumbers: 'on',
      renderLineHighlight: 'all',
      automaticLayout: true,
      quickSuggestions: true,
      parameterHints: { enabled: true },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      tabCompletion: 'on',
    });

    editor.onDidFocusEditorText(() => {
      window.dispatchEvent(new CustomEvent('monacoFocus', { detail: true }));
    });
    editor.onDidBlurEditorText(() => {
      window.dispatchEvent(new CustomEvent('monacoFocus', { detail: false }));
    });
  };

  const handleExpand = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    if (onExpand) {
      onExpand(newExpandedState);
    }
  };

  const handleStop = () => {
    setIsExecuting(false);
    setCurrentStep(0);
    addOutput('> ⚠ Ejecución detenida por el usuario');
    websocketService.abortRapidExecution();
  };

  const handleRun = async () => {

    setMovements([]);
    setCurrentStep(0);
    setIsExecuting(true);
    addOutput('> Parseando código RAPID...');

    const wsConnected = websocketService.isConnected();

    if (useWebSocket && wsConnected) {

      addOutput('> Usando WebSocket streaming (modo rápido)');
      executeViaWebSocket();
    } else {

      if (useWebSocket && !wsConnected) {
        addOutput('> WebSocket no disponible, usando API REST');
      } else {
        addOutput('> Usando API REST');
      }
      executeViaREST();
    }
  };

  const executeViaWebSocket = () => {
    let pointCount = 0;
    let lastMovementIndex = -1;

    websocketService.executeRapidStreaming(
      code,

      (point: any) => {
        console.log('[RAPID] Punto recibido:', point.step);
        pointCount++;
        setCurrentStep(pointCount);

        if (point.movement_index !== lastMovementIndex) {
          addOutput(`> Movimiento ${point.movement_index + 1}: ${point.type} ${point.target}`);
          lastMovementIndex = point.movement_index;
        }

        if (point.joints && onExecuteMovement) {
          onExecuteMovement(point.joints);

          if (!point.is_intermediate && point.position) {
            addOutput(`  → Posición: [${point.position.x.toFixed(1)}, ${point.position.y.toFixed(1)}, ${point.position.z.toFixed(1)}]mm`);
          }
        }
      },

      () => {
        console.log('[RAPID] Ejecución completada exitosamente');
        addOutput(`> ✓ Programa ejecutado exitosamente (${pointCount} puntos)`);
        setIsExecuting(false);
        setCurrentStep(0);
      },

      (error: string) => {
        console.error('[RAPID] Error en ejecución:', error);
        addOutput(`> ✗ Error de ejecución: ${error}`);
        setIsExecuting(false);
        setCurrentStep(0);
      },

      (message: string, type: string) => {
        console.log('[RAPID] Mensaje de consola:', message);
        addOutput(`> ${message}`);
      }
    );
  };

  const executeViaREST = async () => {

    setMovements([]);
    setCurrentStep(0);

    try {
      console.log('[RAPID] Enviando código al backend para interpolación...');
      console.log('[RAPID] URL:', 'https://simuladorbackend.azurewebsites.net/api/rapid/interpolate');

      const response = await axios.post('https://simuladorbackend.azurewebsites.net/api/rapid/interpolate', {
        code: code
      }, {
        timeout: 120000
      });

      console.log('[RAPID] Respuesta recibida:', response.data);

      if (response.data.success) {
        const { trajectory, total_movements, total_steps, module } = response.data;

        if (!trajectory || trajectory.length === 0) {
          addOutput('> ✗ Error: No se generaron puntos de trayectoria');
          setIsExecuting(false);
          return;
        }

        setMovements(trajectory);

        addOutput(`> Módulo: ${module}`);
        addOutput(`> Movimientos: ${total_movements}`);
        addOutput(`> Puntos interpolados: ${total_steps}`);
        addOutput('> Iniciando ejecución suave...');

        await executeInterpolatedTrajectory(trajectory);

        addOutput('> ✓ Programa ejecutado exitosamente');
      } else {
        addOutput(`> ✗ Error: ${response.data.error}`);
      }
    } catch (error: any) {
      console.error('[RAPID] Error completo:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Error desconocido';
      addOutput(`> ✗ Error al ejecutar: ${errorMsg}`);

      if (error.response) {
        addOutput(`  → Status: ${error.response.status}`);
      } else if (error.request) {
        addOutput(`  → No se recibió respuesta del servidor`);
        addOutput(`  → ¿Está el backend corriendo en https://simuladorbackend.azurewebsites.net?`);
      } else {
        addOutput(`  → ${error.message}`);
      }
    } finally {
      setIsExecuting(false);
      setCurrentStep(0);
      setMovements([]); // Limpiar movimientos al finalizar
    }
  };

  const executeMovementsSequentially = async (movementsList: Movement[]) => {
    for (let i = 0; i < movementsList.length; i++) {
      const movement = movementsList[i];
      setCurrentStep(i + 1);

      addOutput(`> Paso ${i + 1}/${movementsList.length}: ${movement.type} ${movement.target}`);

      if ((movement as any).warning) {
        addOutput(`  ⚠ ${(movement as any).warning}`);
      }

      if ((movement as any).ik_error) {
        addOutput(`  ✗ ${(movement as any).ik_error}`);
        continue; // Saltar este movimiento
      }

      if ((movement as any).ik_message) {
        addOutput(`  ✓ ${(movement as any).ik_message}`);
      }

      if (movement.joints && onExecuteMovement) {
        onExecuteMovement(movement.joints);

        if (movement.position) {
          addOutput(`  → Posición: [${movement.position.x.toFixed(1)}, ${movement.position.y.toFixed(1)}, ${movement.position.z.toFixed(1)}]mm`);
        }

        const delay = getDelayFromSpeed(movement.speed);
        await sleep(delay);
      } else if (movement.position) {

        addOutput(`  → Posición objetivo: [${movement.position.x}, ${movement.position.y}, ${movement.position.z}]`);
        await sleep(500);
      }
    }
  };

  const executeInterpolatedTrajectory = async (trajectory: any[]) => {
    let lastMovementIndex = -1;

    for (let i = 0; i < trajectory.length; i++) {
      const point = trajectory[i];
      setCurrentStep(i + 1);

      if (point.movement_index !== lastMovementIndex) {
        addOutput(`> Movimiento ${point.movement_index + 1}: ${point.type} ${point.target}`);
        lastMovementIndex = point.movement_index;
      }

      if (point.ik_error) {
        addOutput(`  ✗ ${point.ik_error}`);
        continue;
      }

      if (point.joints && onExecuteMovement) {
        onExecuteMovement(point.joints);

        if (!point.is_intermediate && point.position) {
          addOutput(`  → Posición: [${point.position.x.toFixed(1)}, ${point.position.y.toFixed(1)}, ${point.position.z.toFixed(1)}]mm`);
        }

        const delay = calculateRealisticDelay(point, trajectory, i);
        await sleep(delay);
      }
    }
  };

  const calculateRealisticDelay = (point: any, trajectory: any[], currentIndex: number): number => {

    const velocityMap: { [key: string]: number } = {
      'v5': 5,       // 5 mm/s
      'v10': 10,     // 10 mm/s
      'v20': 20,     // 20 mm/s
      'v30': 30,     // 30 mm/s
      'v40': 40,     // 40 mm/s
      'v50': 50,     // 50 mm/s
      'v60': 60,     // 60 mm/s
      'v80': 80,     // 80 mm/s
      'v100': 100,   // 100 mm/s
      'v150': 150,   // 150 mm/s
      'v200': 200,   // 200 mm/s
      'v300': 300,   // 300 mm/s
      'v400': 400,   // 400 mm/s
      'v500': 500,   // 500 mm/s
      'v600': 600,   // 600 mm/s
      'v800': 800,   // 800 mm/s
      'v1000': 1000, // 1000 mm/s
      'v1500': 1500, // 1500 mm/s
      'v2000': 2000, // 2000 mm/s
      'v2500': 2500, // 2500 mm/s
      'v3000': 3000, // 3000 mm/s
      'v4000': 4000, // 4000 mm/s
      'v5000': 5000, // 5000 mm/s
      'v6000': 6000, // 6000 mm/s
      'v7000': 7000, // 7000 mm/s (velocidad máxima TCP IRB 140)
    };

    const speedStr = point.speed || 'v1000';
    const velocity = velocityMap[speedStr] || 1000;

    if (currentIndex < trajectory.length - 1) {
      const nextPoint = trajectory[currentIndex + 1];

      if (nextPoint.movement_index === point.movement_index && point.position && nextPoint.position) {
        const dx = nextPoint.position.x - point.position.x;
        const dy = nextPoint.position.y - point.position.y;
        const dz = nextPoint.position.z - point.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz); // en mm

        const timeMs = (distance / velocity) * 1000;

        return Math.max(1, timeMs);
      }
    }

    const baseDelay = 1000 / velocity;
    return Math.max(1, baseDelay);
  };

  const getDelayFromSpeed = (speed: string): number => {

    const match = speed.match(/v(\d+)/);
    if (match) {
      const speedValue = parseInt(match[1]);

      return Math.max(500, 2000 - speedValue);
    }
    return 1000;
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const addOutput = (message: string) => {
    setOutput(prev => [...prev, message]);
  };

  const handleDownload = async () => {
    const ROBOT_ID_MAP: Record<string, string> = {
      'ABB IRB 140': 'ABB_IRB_140',
      'IRB 910SC SCARA': 'ABB_IRB_910SC',
    };
    const robotId = robotType ? ROBOT_ID_MAP[robotType] ?? 'ABB_IRB_140' : 'ABB_IRB_140';
    const folderName = robotId === 'ABB_IRB_140' ? 'IRB_140' : 'IRB_910SC';
    try {
      addOutput(`> Descargando proyecto RobotStudio para ${robotType ?? 'robot'}...`);
      const response = await axios.post(
        `https://simuladorbackend.azurewebsites.net/api/rapid/download/${robotId}`,
        { code },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `RobotStudio_${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      addOutput('> ✓ Proyecto descargado correctamente');
    } catch (err) {
      addOutput('> ✗ Error al descargar el proyecto RAPID');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCode(content);
      addOutput(`> Archivo cargado: ${file.name} (${content.split('\n').length} líneas)`);
    };
    reader.onerror = () => {
      addOutput(`> ✗ Error al leer el archivo`);
    };
    reader.readAsText(file);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const containerStyle = isExpanded
    ? {
      position: 'fixed' as const,
      left: 0,
      bottom: 0,
      width: '100%',
      height: '40vh',
      zIndex: 50,
    }
    : {
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: '800px',
      height: '320px',
      zIndex: 30,
    };

  return (
    <div
      ref={!isExpanded ? dragRef : null}
      onMouseDown={!isExpanded ? handleMouseDown : undefined}
      className={`${isExpanded ? 'fixed' : 'fixed'} bg-gradient-to-br from-[#1e1e1e] to-[#252526] backdrop-blur-xl rounded-t-xl border border-white/10 shadow-2xl overflow-hidden ${isDragging && !isExpanded ? 'cursor-grabbing' : ''
        }`}
      style={containerStyle}
    >
      {}
      <div
        data-drag-handle={!isExpanded}
        className={`bg-[#2d2d30] px-4 py-2 border-b border-white/10 flex items-center justify-between ${!isExpanded ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
      >
        <div className="flex items-center gap-3">
          {!isExpanded && <GripVertical className="w-4 h-4 text-gray-500" />}
          <FileCode className="w-4 h-4 text-cyan-400" />
          <span className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">
            Editor RAPID
          </span>
          <span className="text-xs text-gray-500">MainModule.mod</span>
        </div>

        <div className="flex items-center gap-2">
          {}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.mod,.prg"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={handleUploadClick}
            className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded flex items-center gap-1.5 text-xs"
            title="Cargar archivo RAPID"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cargar</span>
          </button>
          <button
            onClick={handleDownload}
            className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded flex items-center gap-1.5 text-xs"
            title="Descargar proyecto RobotStudio"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Descargar</span>
          </button>

          {isExecuting && (
            <button
              onClick={handleStop}
              className="bg-red-600 hover:bg-red-500 text-white transition-colors px-3 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium"
              title="Detener ejecución"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Detener</span>
            </button>
          )}

          <button
            onClick={handleRun}
            disabled={isExecuting}
            className={`${isExecuting
                ? 'bg-gray-600 cursor-not-allowed opacity-50'
                : 'bg-green-600 hover:bg-green-500'
              } text-white transition-colors px-3 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium`}
            title="Ejecutar (F5)"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Ejecutando...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Ejecutar</span>
              </>
            )}
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <button
            onClick={handleExpand}
            className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded"
            title={isExpanded ? 'Minimizar' : 'Expandir'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {}
      <div className="flex h-[calc(100%-40px-28px)] mb-7">
        {}
        <div className={`${isExpanded ? 'w-2/3' : 'w-full'} border-r border-white/10 overflow-hidden`}>
          <Editor
            height="100%"
            language="rapid"
            value={code}
            onChange={(value) => setCode(value || '')}
            beforeMount={handleEditorWillMount}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
              fontSize: 13,
              minimap: { enabled: isExpanded },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              renderLineHighlight: 'all',
              automaticLayout: true,
              wordWrap: 'on',
              tabSize: 2,
              insertSpaces: true,
              formatOnPaste: false, // Desactivar para archivos grandes
              formatOnType: false,  // Desactivar para archivos grandes

              largeFileOptimizations: true,
              maxTokenizationLineLength: 20000,
              quickSuggestions: false,
              parameterHints: { enabled: false },
              suggestOnTriggerCharacters: false,
            }}
          />
        </div>

        {}
        {isExpanded && (
          <div className="w-1/3 bg-[#1e1e1e] flex flex-col">
            <div className="bg-[#2d2d30] px-4 py-2 border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs uppercase tracking-wider text-gray-400">Salida</span>
              </div>
              <button 
                onClick={() => setOutput(['> Consola limpiada.'])}
                className="text-gray-400 hover:text-red-400 transition-colors p-1 hover:bg-white/10 rounded"
                title="Limpiar consola"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-xs pb-10">
              {output.map((line, index) => {
                const isError = line.includes('✗') || line.includes('Error');
                const isSuccess = line.includes('✓');
                const isWarning = line.includes('⚠');
                const isStep = line.includes('Paso');

                return (
                  <div
                    key={index}
                    className={`${isError ? 'text-red-400' :
                        isSuccess ? 'text-green-400' :
                          isWarning ? 'text-yellow-400' :
                            isStep ? 'text-cyan-400 font-semibold' :
                              'text-green-400/80'
                      }`}
                  >
                    {line}
                  </div>
                );
              })}
              {isExecuting && currentStep > 0 && (
                <div className="text-cyan-400 animate-pulse">
                  ⟳ Ejecutando paso {currentStep}/{movements.length}...
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {}
      <div className="absolute bottom-0 left-0 right-0 bg-[#007acc] px-4 py-1 flex items-center justify-between text-xs text-white">
        <div className="flex items-center gap-4">
          <span>Ln {code.split('\n').length}, Col 1</span>
          <span>RAPID</span>
          <span>UTF-8</span>
          {isExecuting && (
            <span className="flex items-center gap-1 text-yellow-300 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              Ejecutando {currentStep}/{movements.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={isExecuting ? "text-yellow-300" : "text-green-300"}>
            ● {isExecuting ? 'Ejecutando' : 'Listo'}
          </span>
        </div>
      </div>
    </div>
  );
}
