---
inclusion: auto
---

# Guía de Desarrollo: Simulador de Robot

## Contexto del Proyecto

Este es un simulador web para el robot ABB IRB 140, proyecto escolar de Robótica Básica. El frontend está en React + TypeScript + Three.js, y se comunica con un backend Python Flask.

## Principios de Desarrollo

### 1. Código Académico
- Mantener documentación mínima y profesional
- Evitar comentarios excesivos que parezcan generados por IA
- Código limpio y bien estructurado
- Nombres de variables en inglés, comentarios en español

### 2. Arquitectura
- Separación clara entre visualización (Three.js) y lógica (React)
- Servicios centralizados para comunicación con backend
- Hooks personalizados para estado compartido
- Componentes reutilizables

### 3. Performance
- Cargar STL desde frontend (public/models/)
- WebSocket para tiempo real, REST como fallback
- Evitar re-renders innecesarios
- Memoización donde sea apropiado

## Estructura de Archivos

```
src/
├── app/
│   ├── components/       # Componentes React
│   │   ├── RobotViewer3D.tsx    # ⚠️ CRÍTICO: Visualización 3D
│   │   ├── ControlPanel.tsx     # Panel de control
│   │   └── ui/                  # shadcn/ui components
│   ├── hooks/            # Custom hooks
│   │   ├── useRobotState.ts     # ⚠️ CRÍTICO: Estado del robot
│   │   └── useWebSocket.ts      # WebSocket connection
│   └── App.tsx           # Componente principal
├── services/             # ⚠️ CRÍTICO: Comunicación backend
│   ├── api.ts
│   ├── robotService.ts
│   └── websocketService.ts
└── types/                # TypeScript definitions
```

## Reglas Críticas

### Three.js y Jerarquía del Robot

**SIEMPRE:**
- Usar jerarquía recursiva de eslabones (cada uno hijo del anterior)
- Escalar posiciones del backend (mm → metros, ×0.001)
- Aplicar escala a meshes individualmente
- Resetear rotaciones antes de aplicar nuevas
- NO centrar geometrías STL (origen ya correcto)

**NUNCA:**
- Aplicar escala al grupo padre si las posiciones ya están escaladas
- Centrar geometrías STL con `geometry.center()`
- Acumular rotaciones sin resetear
- Hardcodear valores de configuración

### Comunicación Backend

**SIEMPRE:**
- Usar interfaces TypeScript para datos del backend
- Implementar fallback a REST si WebSocket falla
- Manejar errores de red gracefully
- Validar datos recibidos del backend

**NUNCA:**
- Asumir que WebSocket siempre funciona
- Ignorar errores de red
- Hardcodear URLs (usar variables de entorno)

### Estado y Hooks

**SIEMPRE:**
- Usar `useRobotState` para estado del robot
- Usar `useWebSocket` para conexión en tiempo real
- Limpiar efectos y timers en cleanup
- Memoizar callbacks costosos

**NUNCA:**
- Crear múltiples conexiones WebSocket
- Olvidar cleanup en useEffect
- Mutar estado directamente

## Parámetros DH del ABB IRB 140

```
Eslabón | d (mm) | a (mm) | α (alpha) | Eje
--------|--------|--------|-----------|-----
1       | 352    | 0      | 0°        | Z
2       | 0      | 280    | 0°        | Y
3       | 0      | 70     | -90°      | Y
4       | 380    | 0      | 90°       | X
5       | 0      | 0      | -90°      | Y
6       | 65     | 0      | 0°        | X
```

## Flujo de Datos

```
Backend → REST API → robotService → useRobotState → Components
                                         ↓
Backend → WebSocket → useWebSocket → useRobotState → Components
```

## Comandos Comunes

```bash
npm run dev      # Desarrollo (puerto 5173)
npm run build    # Build producción
npm run preview  # Preview del build
```

## Debugging

### Three.js
```javascript
// En consola del navegador
scene.traverse((obj) => console.log(obj.name, obj.position));
```

### WebSocket
```javascript
// Ver eventos en consola
socket.onAny((event, ...args) => console.log(event, args));
```

### Estado
```javascript
// En componente
console.log('[Estado]', robotState);
```

## Próximas Funcionalidades Sugeridas

1. **Cinemática Inversa** - Mover por posición cartesiana
2. **Trayectorias** - Planificación de movimientos
3. **Límites** - Validar rangos de articulaciones
4. **Colisiones** - Detección de workspace
5. **Presets** - Guardar/cargar posiciones
6. **Exportar** - Generar código RAPID

## Referencias Rápidas

- **Skills**: `.kiro/skills/` - Contexto detallado del proyecto
- **Guía Three.js**: `GUIA_INTEGRACION_THREEJS.md` - Implementación DH
- **API Backend**: `API_DOCUMENTACION.md` - Endpoints y WebSocket
- **README**: `README.md` - Setup y overview

## Notas Importantes

- Los archivos STL deben estar en `public/models/ABB_IRB_140/`
- El backend debe estar corriendo en `http://127.0.0.1:5000`
- Las posiciones del backend están en milímetros
- La escala de visualización es 0.001 (mm a metros)
- Los ejes de rotación vienen del backend por eslabón

## Cuando Agregues Nuevas Funcionalidades

1. Verificar si el backend necesita cambios
2. Actualizar interfaces TypeScript si es necesario
3. Agregar logs de debug apropiados
4. Probar con y sin WebSocket
5. Verificar que no rompa funcionalidad existente
6. Mantener código limpio y documentado mínimamente
