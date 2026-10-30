import React, { useState } from 'react';
import {
  FileCode,
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  Trash2,
  Edit2,
  RefreshCw,
  FileText,
  ChevronRight,
  ChevronDown,
  X
} from 'lucide-react';
import { WorkspaceFile } from '../../../services/pythonIdeService';

interface FileExplorerProps {
  files: WorkspaceFile[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => Promise<void>;
  onCreateDirectory: (path: string) => Promise<void>;
  onRenameItem: (oldPath: string, newPath: string) => Promise<void>;
  onDeleteItem: (path: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onClose?: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  selectedFile,
  onSelectFile,
  onCreateFile,
  onCreateDirectory,
  onRenameItem,
  onDeleteItem,
  onRefresh,
  onClose,
}) => {
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingDir, setIsCreatingDir] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(['python', 'rapid', 'capturas']));
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    if (isCreatingFile) {
      const fileName = newItemName.endsWith('.py') || newItemName.includes('.')
        ? newItemName
        : `${newItemName}.py`;
      await onCreateFile(fileName);
      setIsCreatingFile(false);
    } else if (isCreatingDir) {
      await onCreateDirectory(newItemName);
      setIsCreatingDir(false);
    }
    setNewItemName('');
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingPath || !renameValue.trim()) return;
    await onRenameItem(renamingPath, renameValue.trim());
    setRenamingPath(null);
    setRenameValue('');
  };

  const handleDragStart = (e: React.DragEvent, filePath: string) => {
    e.dataTransfer.setData('text/plain', filePath);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);

    const sourcePath = e.dataTransfer.getData('text/plain');
    if (!sourcePath || sourcePath === targetFolder) return;

    const fileName = sourcePath.split('/').pop()!;
    const newPath = `${targetFolder}/${fileName}`;
    if (sourcePath !== newPath) {
      await onRenameItem(sourcePath, newPath);
      setExpandedFolders((prev) => new Set([...prev, targetFolder]));
    }
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPath(null);

    const sourcePath = e.dataTransfer.getData('text/plain');
    if (!sourcePath || !sourcePath.includes('/')) return;

    const fileName = sourcePath.split('/').pop()!;
    if (sourcePath !== fileName) {
      await onRenameItem(sourcePath, fileName);
    }
  };

  const renderItemRow = (file: WorkspaceFile, depth = 0) => {
    const isSelected = selectedFile === file.path;
    const isRenaming = renamingPath === file.path;
    const isDirectory = file.type === 'directory';
    const isExpanded = expandedFolders.has(file.path);
    const isDropTarget = dragOverPath === file.path;

    if (isRenaming) {
      return (
        <form
          key={file.path}
          onSubmit={handleRenameSubmit}
          className="flex items-center gap-1 px-1 py-0.5 bg-cyan-950/30 rounded"
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
        >
          <input
            type="text"
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="w-full px-1.5 py-0.5 bg-black/60 border border-cyan-500/40 rounded text-xs text-white focus:outline-none"
          />
          <button type="submit" className="text-cyan-400 hover:text-cyan-300 px-1 text-[11px]">✓</button>
          <button
            type="button"
            onClick={() => setRenamingPath(null)}
            className="text-gray-400 hover:text-white px-1 text-[11px]"
          >
            ✕
          </button>
        </form>
      );
    }

    if (isDirectory) {
      const childFiles = files.filter(
        (f) => f.path.startsWith(`${file.path}/`) && f.path.split('/').length === file.path.split('/').length + 1
      );

      return (
        <div key={file.path} className="space-y-0.5">
          <div
            onClick={() => toggleFolder(file.path)}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverPath !== file.path) setDragOverPath(file.path);
            }}
            onDragLeave={() => {
              if (dragOverPath === file.path) setDragOverPath(null);
            }}
            onDrop={(e) => handleFolderDrop(e, file.path)}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
            className={`group flex items-center justify-between py-1.5 pr-2 rounded cursor-pointer transition-all ${
              isDropTarget
                ? 'bg-cyan-500/30 ring-1 ring-cyan-400 text-cyan-200'
                : 'hover:bg-white/5 text-gray-300'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-gray-500 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              )}
              <span className="font-medium text-gray-200 truncate">{file.name}</span>
            </div>

            <div className="hidden group-hover:flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingPath(file.path);
                  setRenameValue(file.path);
                }}
                title="Renombrar carpeta"
                className="p-0.5 hover:text-cyan-300 rounded"
              >
                <Edit2 className="w-3 h-3 text-gray-400 hover:text-cyan-300" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`¿Eliminar la carpeta ${file.name} y su contenido?`)) {
                    onDeleteItem(file.path);
                  }
                }}
                title="Eliminar carpeta"
                className="p-0.5 hover:text-red-400 rounded"
              >
                <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-400" />
              </button>
            </div>
          </div>

          {isExpanded && (
            <div className="space-y-0.5">
              {childFiles.length === 0 ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverPath !== file.path) setDragOverPath(file.path);
                  }}
                  onDrop={(e) => handleFolderDrop(e, file.path)}
                  style={{ paddingLeft: `${(depth + 1) * 14 + 16}px` }}
                  className="text-[10px] text-gray-500 py-1 italic border border-dashed border-white/5 rounded mx-1.5"
                >
                  Arrastra archivos aquí para agrupar
                </div>
              ) : (
                childFiles.map((child) => renderItemRow(child, depth + 1))
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={file.path}
        draggable={true}
        onDragStart={(e) => handleDragStart(e, file.path)}
        onClick={() => onSelectFile(file.path)}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={`group flex items-center justify-between py-1.5 pr-2 rounded cursor-pointer transition-all ${
          isSelected
            ? 'bg-cyan-500/20 text-cyan-300 font-medium border border-cyan-500/30'
            : 'hover:bg-white/5 text-gray-300'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {file.name.endsWith('.py') ? (
            <FileCode className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          ) : file.name.endsWith('.mod') || file.name.endsWith('.prg') || file.name.endsWith('.sys') ? (
            <FileCode className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          ) : (
            <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          )}
          <span className="truncate">{file.name}</span>
        </div>

        <div className="hidden group-hover:flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRenamingPath(file.path);
              setRenameValue(file.path);
            }}
            title="Renombrar o mover"
            className="p-0.5 hover:text-cyan-300 rounded"
          >
            <Edit2 className="w-3 h-3 text-gray-400 hover:text-cyan-300" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`¿Eliminar ${file.name}?`)) {
                onDeleteItem(file.path);
              }
            }}
            title="Eliminar archivo"
            className="p-0.5 hover:text-red-400 rounded"
          >
            <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-400" />
          </button>
        </div>
      </div>
    );
  };

  const rootItems = files.filter((f) => !f.path.includes('/'));

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={handleRootDrop}
      className="flex flex-col h-full bg-[#0b1017]/90 border-r border-white/10 text-gray-300 select-none text-xs"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/20">
        <span className="font-semibold text-gray-200 tracking-wider uppercase text-[11px]">
          Archivos del Proyecto
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setIsCreatingFile(true);
              setIsCreatingDir(false);
            }}
            title="Nuevo archivo .py"
            className="p-1 hover:text-cyan-400 hover:bg-white/5 rounded transition-colors"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setIsCreatingDir(true);
              setIsCreatingFile(false);
            }}
            title="Nueva carpeta"
            className="p-1 hover:text-cyan-400 hover:bg-white/5 rounded transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRefresh}
            title="Refrescar explorador"
            className="p-1 hover:text-cyan-400 hover:bg-white/5 rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <>
              <div className="w-px h-3 bg-white/10 mx-0.5" />
              <button
                onClick={onClose}
                title="Cerrar panel lateral"
                className="p-1 hover:text-white hover:bg-white/10 rounded transition-colors text-gray-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {(isCreatingFile || isCreatingDir) && (
        <form onSubmit={handleCreateSubmit} className="p-2 bg-cyan-950/20 border-b border-cyan-800/30">
          <div className="text-[10px] text-cyan-400 font-semibold mb-1">
            {isCreatingFile ? 'Crear archivo Python' : 'Crear carpeta'}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={isCreatingFile ? 'ejemplo.py' : 'nombre_carpeta'}
              className="w-full px-2 py-1 bg-black/50 border border-cyan-500/40 rounded text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-cyan-500 text-black font-semibold rounded text-[11px] hover:bg-cyan-400"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreatingFile(false);
                setIsCreatingDir(false);
                setNewItemName('');
              }}
              className="px-2 py-1 bg-white/10 text-gray-300 rounded text-[11px] hover:bg-white/20"
            >
              ✕
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 font-mono">
        {rootItems.length === 0 ? (
          <div className="text-gray-500 text-center py-6 text-[11px]">
            Workspace vacío. Crea un archivo .py para comenzar.
          </div>
        ) : (
          rootItems.map((item) => renderItemRow(item, 0))
        )}
      </div>
    </div>
  );
};
