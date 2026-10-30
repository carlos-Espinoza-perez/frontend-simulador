import React, { useState, useEffect, useRef } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import {
  FolderTree,
  Radio,
  Play,
  Square,
  Save,
  Check,
  Terminal,
  PanelLeft,
  PanelRight,
  PanelBottom,
  FileCode,
  AlertTriangle,
  Cpu,
  X,
} from 'lucide-react';
import { FileExplorer } from './FileExplorer';
import { ConsoleTerminal, ConsoleLogEntry } from './ConsoleTerminal';
import { RobotConnectionPanel } from './RobotConnectionPanel';
import { VirtualIOManagerPanel } from './VirtualIOManagerPanel';
import { setupPythonAutocomplete } from './pythonCompletionProvider';
import pythonIdeService, {
  WorkspaceFile,
  ScriptStatus,
  ConnectionStatus
} from '../../../services/pythonIdeService';
import websocketService from '../../../services/websocketService';
import geometryService from '../../../services/geometryService';
import { getBrowserClientId } from '../../../services/api';

export const PythonIDEView: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'files' | 'io' | 'connection'>('files');

  const [showTerminal, setShowTerminal] = useState(true);
  const [terminalDock, setTerminalDock] = useState<'bottom' | 'right'>('bottom');
  const [terminalHeight, setTerminalHeight] = useState(240);
  const [terminalWidth, setTerminalWidth] = useState(450);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);

  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [openTabs, setOpenTabs] = useState<{ path: string; code: string; isDirty: boolean }[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecutingRapid, setIsExecutingRapid] = useState(false);

  useEffect(() => {
    const unsub = geometryService.suscribirAlerta((alerta) => {
      if (alerta?.activa) {
        setIsExecutingRapid(false);
      }
    });
    return unsub;
  }, []);

  const activeTab = openTabs.find((t) => t.path === activeTabPath) || null;
  const selectedFile = activeTab?.path || null;
  const code = activeTab?.code || '';
  const isDirty = activeTab?.isDirty || false;

  const isRapid = selectedFile ? (selectedFile.endsWith('.mod') || selectedFile.endsWith('.prg') || selectedFile.endsWith('.sys')) : false;
  const isPython = selectedFile ? selectedFile.endsWith('.py') : false;
  const canExecute = isPython || isRapid;

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const [logs, setLogs] = useState<ConsoleLogEntry[]>([
    {
      type: 'system',
      text: 'Entorno de desarrollo inicializado. Soporte para scripts Python y programas RAPID (ABB IRC5).',
      timestamp: Date.now(),
    },
  ]);

  const [scriptStatus, setScriptStatus] = useState<ScriptStatus>({
    is_running: false,
    pid: null,
    current_script: null,
    elapsed_seconds: 0,
  });

  const editorRef = useRef<any>(null);

  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(600, startWidth + (moveEvent.clientX - startX)));
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleTerminalHeightMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = terminalHeight;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newHeight = Math.max(100, Math.min(window.innerHeight - 180, startHeight - (moveEvent.clientY - startY)));
      setTerminalHeight(newHeight);
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleTerminalWidthMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = terminalWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(260, Math.min(window.innerWidth - 400, startWidth - (moveEvent.clientX - startX)));
      setTerminalWidth(newWidth);
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const refreshFiles = async () => {
    try {
      const fileList = await pythonIdeService.listFiles();
      setFiles(fileList);
      if (!selectedFile && fileList.length > 0) {
        const firstPy = fileList.find((f) => f.name.endsWith('.py')) || fileList[0];
        if (firstPy && firstPy.type === 'file') {
          handleSelectFile(firstPy.path);
        }
      }
    } catch (err) {
      console.error('Error al listar archivos:', err);
    }
  };

  useEffect(() => {
    refreshFiles();
  }, []);

  useEffect(() => {
    const cleanupOutput = websocketService.on('python_output', (data: any) => {
      if (data.client_id && data.client_id !== getBrowserClientId()) return;
      setLogs((prev) => [
        ...prev,
        {
          type: data.type || 'stdout',
          text: data.text,
          timestamp: data.timestamp || Date.now(),
        },
      ]);
    });

    const cleanupStatus = websocketService.on('python_status', (data: any) => {
      if (data.client_id && data.client_id !== getBrowserClientId()) return;
      setScriptStatus(data);
    });

    return () => {
      cleanupOutput();
      cleanupStatus();
    };
  }, []);

  const handleSelectFile = async (path: string) => {
    const norm = path.replace(/\\/g, '/');
    const existing = openTabs.find((t) => t.path === norm || t.path.endsWith('/' + norm) || norm.endsWith('/' + t.path));
    if (existing) {
      setActiveTabPath(existing.path);
      return;
    }
    try {
      const content = await pythonIdeService.readFile(norm);
      setOpenTabs((prev) => {
        if (prev.some((t) => t.path === norm)) return prev;
        return [...prev, { path: norm, code: content, isDirty: false }];
      });
      setActiveTabPath(norm);
    } catch (err) {
      alert(`Error al abrir archivo ${norm}: ${err}`);
    }
  };

  const handleCloseTab = (e: React.MouseEvent, tabPath: string) => {
    e.stopPropagation();
    const tabToClose = openTabs.find((t) => t.path === tabPath);
    if (tabToClose?.isDirty) {
      const confirmClose = window.confirm(`El archivo '${tabPath}' tiene cambios sin guardar. ¿Deseas cerrarlo?`);
      if (!confirmClose) return;
    }

    const nextTabs = openTabs.filter((t) => t.path !== tabPath && t.path !== tabPath.split('/').pop());
    setOpenTabs(nextTabs);

    if (activeTabPath === tabPath || !nextTabs.some((t) => t.path === activeTabPath)) {
      const closedIndex = openTabs.findIndex((t) => t.path === tabPath);
      const nextActive = nextTabs[closedIndex] || nextTabs[closedIndex - 1] || null;
      setActiveTabPath(nextActive ? nextActive.path : null);
    }
  };

  const handleSaveFile = async () => {
    const target = activeTabRef.current;
    if (!target) return;
    setIsSaving(true);
    try {
      await pythonIdeService.writeFile(target.path, target.code);
      setOpenTabs((prev) =>
        prev.map((t) => (t.path === target.path ? { ...t, isDirty: false } : t))
      );
      setLogs((prev) => [
        ...prev,
        { type: 'system', text: `Archivo '${target.path}' guardado.`, timestamp: Date.now() },
      ]);
    } catch (err) {
      alert(`Error al guardar archivo: ${err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    if (!selectedFile) return;
    if (isDirty) {
      await handleSaveFile();
    }

    if (isRapid) {
      geometryService.reiniciarCicloAlerta();
      setShowTerminal(true);
      setIsExecutingRapid(true);
      setLogs((prev) => [
        ...prev,
        { type: 'system', text: `--- Ejecutando ${selectedFile} en simulador 3D ---`, timestamp: Date.now() },
      ]);

      let lastMovement = -1;
      websocketService.executeRapidStreaming(
        code,
        (point: any) => {
          if (point.joints) {
            const coords = point.position
              ? ([point.position.x, point.position.y, point.position.z] as [number, number, number])
              : undefined;
            const pred = geometryService.predecirColision(point.joints, coords);
            if (pred.hayColision) {
              websocketService.abortRapidExecution();
              setIsExecutingRapid(false);
              geometryService.dispararAlerta({
                activa: true,
                tipo: 'predictiva',
                titulo: 'PARADA PREDICTIVA DE SEGURIDAD',
                mensaje: 'Riesgo inminente de colisión',
                detalle: pred.detalle || `Posible colisión de ${pred.link} con "${pred.obstaculo}".`,
                obstaculo: pred.obstaculo || 'Obstáculo en celda',
                link: pred.link || 'Manipulador',
                timestamp: Date.now(),
              });
              setLogs((prev) => [
                ...prev,
                {
                  type: 'stderr',
                  text: `🛑 [SEGURIDAD] Ejecución detenida: Riesgo de colisión con ${pred.obstaculo}`,
                  timestamp: Date.now(),
                },
                {
                  type: 'stderr',
                  text: `⚠️ ${pred.detalle || 'Trayectoria intercepta volumen de seguridad'}`,
                  timestamp: Date.now(),
                },
              ]);
              return;
            }
          }
          if (point.movement_index !== lastMovement) {
            lastMovement = point.movement_index;
            setLogs((prev) => [
              ...prev,
              {
                type: 'stdout',
                text: `[Movimiento ${point.movement_index + 1}] ${point.type} ${point.target || ''}`,
                timestamp: Date.now(),
              },
            ]);
          }
          if (!point.is_intermediate && point.position) {
            setLogs((prev) => [
              ...prev,
              {
                type: 'stdout',
                text: `  → Posición: [${point.position.x.toFixed(1)}, ${point.position.y.toFixed(1)}, ${point.position.z.toFixed(1)}] mm`,
                timestamp: Date.now(),
              },
            ]);
          }
        },
        () => {
          setIsExecutingRapid(false);
          setLogs((prev) => [
            ...prev,
            { type: 'system', text: '--- Programa RAPID completado con éxito ---', timestamp: Date.now() },
          ]);
        },
        (error: string) => {
          setIsExecutingRapid(false);
          setLogs((prev) => [
            ...prev,
            { type: 'stderr', text: `Error RAPID: ${error}`, timestamp: Date.now() },
          ]);
        },
        (message: string, msgType: string) => {
          setLogs((prev) => [
            ...prev,
            { type: msgType === 'warning' ? 'stderr' : 'stdout', text: `${message}`, timestamp: Date.now() },
          ]);
        }
      );
    } else if (isPython) {
      try {
        setShowTerminal(true);
        await pythonIdeService.runScript(selectedFile);

        let logIndex = 0;
        const pollInterval = setInterval(async () => {
          try {
            const res = await pythonIdeService.getScriptLogs(logIndex);
            if (res.logs && res.logs.length > 0) {
              setLogs((prev) => [...prev, ...res.logs]);
              logIndex += res.logs.length;
            }
            if (res.status) {
              setScriptStatus(res.status);
              if (!res.status.is_running && logIndex > 0) {
                clearInterval(pollInterval);
              }
            }
          } catch {
            clearInterval(pollInterval);
          }
        }, 200);
      } catch (err: any) {
        setLogs((prev) => [
          ...prev,
          { type: 'stderr', text: `Error al iniciar ejecucion: ${err.message || err}`, timestamp: Date.now() },
        ]);
      }
    }
  };

  const handleStop = async () => {
    if (isExecutingRapid) {
      websocketService.abortRapidExecution();
      setIsExecutingRapid(false);
      setLogs((prev) => [
        ...prev,
        { type: 'system', text: '--- Ejecución RAPID detenida por el usuario ---', timestamp: Date.now() },
      ]);
    } else if (scriptStatus.is_running) {
      try {
        await pythonIdeService.stopScript(true);
      } catch (err) {
        console.error('Error al detener script:', err);
      }
    }
  };

  const handleCreateFile = async (path: string) => {
    try {
      await pythonIdeService.createFile(path);
      await refreshFiles();
      await handleSelectFile(path);
    } catch (err: any) {
      alert(`Error al crear archivo: ${err.message || err}`);
    }
  };

  const handleCreateDirectory = async (path: string) => {
    try {
      await pythonIdeService.createDirectory(path);
      await refreshFiles();
    } catch (err: any) {
      alert(`Error al crear carpeta: ${err.message || err}`);
    }
  };

  const handleRenameItem = async (oldPath: string, newPath: string) => {
    try {
      await pythonIdeService.renameItem(oldPath, newPath);
      await refreshFiles();
      setOpenTabs((prev) =>
        prev.map((t) => (t.path === oldPath ? { ...t, path: newPath } : t))
      );
      if (activeTabPath === oldPath) {
        setActiveTabPath(newPath);
      }
    } catch (err: any) {
      alert(`Error al renombrar: ${err.message || err}`);
    }
  };

  const handleDeleteItem = async (path: string) => {
    try {
      await pythonIdeService.deleteItem(path);
      setOpenTabs((prev) => prev.filter((t) => t.path !== path));
      if (activeTabPath === path) {
        const remaining = openTabs.filter((t) => t.path !== path);
        setActiveTabPath(remaining.length > 0 ? remaining[0].path : null);
      }
      await refreshFiles();
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message || err}`);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile, code]);

  return (
    <div className="flex h-full w-full bg-[#0a0e14] text-white overflow-hidden font-mono select-none">
      <div className="w-12 bg-[#080c10] border-r border-white/10 flex flex-col items-center py-3 gap-3 z-30 flex-shrink-0">
        <button
          onClick={() => {
            if (activeSidebarTab === 'files' && isSidebarOpen) {
              setIsSidebarOpen(false);
            } else {
              setActiveSidebarTab('files');
              setIsSidebarOpen(true);
            }
          }}
          title={isSidebarOpen && activeSidebarTab === 'files' ? 'Ocultar Explorador' : 'Explorador de Archivos'}
          className={`p-2.5 rounded-xl transition-all ${
            isSidebarOpen && activeSidebarTab === 'files'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/40 shadow-sm shadow-cyan-500/20'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FolderTree className="w-5 h-5" />
        </button>

        <button
          onClick={() => {
            if (activeSidebarTab === 'io' && isSidebarOpen) {
              setIsSidebarOpen(false);
            } else {
              setActiveSidebarTab('io');
              setIsSidebarOpen(true);
            }
          }}
          title={isSidebarOpen && activeSidebarTab === 'io' ? 'Ocultar Gestor E/S' : 'Gestor E/S Virtuales (Gemelo Digital)'}
          className={`p-2.5 rounded-xl transition-all ${
            isSidebarOpen && activeSidebarTab === 'io'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/40 shadow-sm shadow-cyan-500/20'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Cpu className="w-5 h-5" />
        </button>

        <button
          onClick={() => {
            if (activeSidebarTab === 'connection' && isSidebarOpen) {
              setIsSidebarOpen(false);
            } else {
              setActiveSidebarTab('connection');
              setIsSidebarOpen(true);
            }
          }}
          title={isSidebarOpen && activeSidebarTab === 'connection' ? 'Ocultar Conexión' : 'Conexión ABB IRC5'}
          className={`p-2.5 rounded-xl transition-all ${
            isSidebarOpen && activeSidebarTab === 'connection'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/40 shadow-sm shadow-cyan-500/20'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Radio className="w-5 h-5" />
        </button>
      </div>

      {isSidebarOpen && (
        <div
          style={{ width: `${sidebarWidth}px` }}
          className="flex-shrink-0 h-full overflow-hidden flex flex-col relative bg-[#0b1017] border-r border-white/10"
        >
          {activeSidebarTab === 'files' ? (
            <FileExplorer
              files={files}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
              onCreateFile={handleCreateFile}
              onCreateDirectory={handleCreateDirectory}
              onRenameItem={handleRenameItem}
              onDeleteItem={handleDeleteItem}
              onRefresh={refreshFiles}
              onClose={() => setIsSidebarOpen(false)}
            />
          ) : activeSidebarTab === 'io' ? (
            <VirtualIOManagerPanel
              onClose={() => setIsSidebarOpen(false)}
            />
          ) : (
            <RobotConnectionPanel
              onClose={() => setIsSidebarOpen(false)}
            />
          )}

          <div
            onMouseDown={handleSidebarMouseDown}
            title="Arrastra para redimensionar ancho del panel"
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-cyan-400/50 active:bg-cyan-400 transition-colors z-20"
          />
        </div>
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0e14]">
        <div className="h-10 bg-[#0b1017] border-b border-white/10 flex items-center justify-between px-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                title="Mostrar panel lateral de archivos"
                className="p-1 hover:text-cyan-300 text-gray-400 hover:bg-white/5 rounded transition-colors mr-1"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center overflow-x-auto max-w-[55vw] gap-1 scrollbar-none">
              {openTabs.map((tab, idx) => {
                const isActive = tab.path === activeTabPath;
                const fileName = tab.path.split('/').pop()!;
                const isRapidTab = tab.path.endsWith('.mod') || tab.path.endsWith('.prg') || tab.path.endsWith('.sys');
                return (
                  <div
                    key={`${tab.path}-${idx}`}
                    onClick={() => setActiveTabPath(tab.path)}
                    onMouseDown={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        handleCloseTab(e, tab.path);
                      }
                    }}
                    className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs cursor-pointer border-t-2 select-none transition-all ${
                      isActive
                        ? 'bg-[#101722] border-cyan-400 text-white font-medium shadow-sm'
                        : 'bg-black/30 border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5'
                    }`}
                  >
                    <FileCode className={`w-3.5 h-3.5 ${
                      isRapidTab
                        ? 'text-amber-400'
                        : isActive ? 'text-cyan-400' : 'text-gray-500'
                    }`} />
                    <span className="truncate max-w-[130px]" title={tab.path}>
                      {fileName}
                    </span>
                    <button
                      onClick={(e) => handleCloseTab(e, tab.path)}
                      className={`p-0.5 rounded transition-colors flex items-center justify-center ml-1 ${
                        isActive
                          ? 'opacity-80 hover:opacity-100 hover:text-red-400 hover:bg-white/10'
                          : 'opacity-40 group-hover:opacity-80 hover:!opacity-100 hover:text-red-400 hover:bg-white/10'
                      }`}
                      title="Cerrar pestaña"
                    >
                      {tab.isDirty && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 group-hover:hidden" />
                      )}
                      <X className={`w-3.5 h-3.5 ${tab.isDirty ? 'hidden group-hover:block' : ''}`} />
                    </button>
                  </div>
                );
              })}

              {openTabs.length === 0 && (
                <span className="text-gray-500 text-xs italic px-2">Ningún archivo abierto</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedFile && (
              <button
                onClick={handleSaveFile}
                disabled={!isDirty || isSaving}
                className={`p-1.5 rounded transition-all ${
                  isDirty
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/30'
                    : 'bg-white/5 text-gray-500 border border-transparent cursor-default'
                }`}
                title="Guardar (Ctrl+S)"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
            )}

            {scriptStatus.is_running || isExecutingRapid ? (
              <button
                onClick={handleStop}
                className="p-1.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 transition-all cursor-pointer"
                title="Detener ejecución"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleRun}
                disabled={!canExecute}
                className={`p-1.5 rounded transition-all ${
                  canExecute
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-sm shadow-cyan-500/30 cursor-pointer'
                    : 'bg-white/5 text-gray-600 cursor-not-allowed'
                }`}
                title={
                  isRapid
                    ? 'Ejecutar programa RAPID en simulador 3D'
                    : isPython
                    ? 'Ejecutar script Python'
                    : 'Selecciona un archivo ejecutable (.py o .mod)'
                }
              >
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
            )}

            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className={`p-1.5 rounded transition-colors ${
                showTerminal ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title={showTerminal ? 'Ocultar consola' : 'Mostrar consola'}
            >
              <Terminal className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className={`flex-1 flex overflow-hidden relative ${terminalDock === 'right' ? 'flex-row' : 'flex-col'}`}>
          <div className="flex-1 relative overflow-hidden h-full">
            {selectedFile ? (
              <Editor
                height="100%"
                path={activeTab?.path}
                defaultLanguage="python"
                language={
                  selectedFile.endsWith('.json')
                    ? 'json'
                    : selectedFile.endsWith('.mod') || selectedFile.endsWith('.prg') || selectedFile.endsWith('.sys')
                    ? 'rapid'
                    : 'python'
                }
                value={code}
                theme="vs-dark"
                onChange={(value) => {
                  const nextVal = value || '';
                  setOpenTabs((prev) =>
                    prev.map((t) => (t.path === activeTabPath ? { ...t, code: nextVal, isDirty: true } : t))
                  );
                }}
                beforeMount={(monaco) => {
                  setupPythonAutocomplete(monaco);
                }}
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
                options={{
                  fontSize: 13,
                  fontFamily: 'Consolas, "Fira Code", monospace',
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  automaticLayout: true,
                  tabSize: 4,
                  renderWhitespace: 'selection',
                  quickSuggestions: { other: true, comments: false, strings: true },
                  suggestOnTriggerCharacters: true,
                  inlineSuggest: { enabled: true },
                  acceptSuggestionOnEnter: 'on',
                  tabCompletion: 'on',
                }}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2">
                <FileCode className="w-10 h-10 text-gray-600" />
                <p className="text-sm">Selecciona o crea un archivo .py en el explorador para comenzar</p>
              </div>
            )}
          </div>

          {showTerminal && (
            <>
              {terminalDock === 'bottom' ? (
                <div
                  style={{ height: isTerminalMaximized ? '85%' : `${terminalHeight}px` }}
                  className="flex-shrink-0 flex flex-col relative w-full border-t border-white/10"
                >
                  {!isTerminalMaximized && (
                    <div
                      onMouseDown={handleTerminalHeightMouseDown}
                      title="Arrastra para redimensionar alto de la consola"
                      className="absolute -top-1 left-0 w-full h-2 cursor-row-resize hover:bg-cyan-400/50 active:bg-cyan-400 transition-colors z-20"
                    />
                  )}
                  <ConsoleTerminal
                    logs={logs}
                    status={scriptStatus}
                    selectedFile={selectedFile}
                    dockPosition={terminalDock}
                    isMaximized={isTerminalMaximized}
                    onToggleDock={() => setTerminalDock('right')}
                    onToggleMaximize={() => setIsTerminalMaximized(!isTerminalMaximized)}
                    onClose={() => setShowTerminal(false)}
                    onRunScript={handleRun}
                    onStopScript={handleStop}
                    onClearLogs={() => setLogs([])}
                  />
                </div>
              ) : (
                <div
                  style={{ width: isTerminalMaximized ? '75%' : `${terminalWidth}px` }}
                  className="flex-shrink-0 flex flex-row relative h-full border-l border-white/10"
                >
                  {!isTerminalMaximized && (
                    <div
                      onMouseDown={handleTerminalWidthMouseDown}
                      title="Arrastra para redimensionar ancho de la consola"
                      className="absolute top-0 -left-1 w-2 h-full cursor-col-resize hover:bg-cyan-400/50 active:bg-cyan-400 transition-colors z-20"
                    />
                  )}
                  <div className="flex-1 h-full overflow-hidden">
                    <ConsoleTerminal
                      logs={logs}
                      status={scriptStatus}
                      selectedFile={selectedFile}
                      dockPosition={terminalDock}
                      isMaximized={isTerminalMaximized}
                      onToggleDock={() => setTerminalDock('bottom')}
                      onToggleMaximize={() => setIsTerminalMaximized(!isTerminalMaximized)}
                      onClose={() => setShowTerminal(false)}
                      onRunScript={handleRun}
                      onStopScript={handleStop}
                      onClearLogs={() => setLogs([])}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
