# Contexto del Proyecto: Simulador Web de Robot ABB IRB 140

## Descripción General

Este es un simulador web para el robot industrial ABB IRB 140, desarrollado como proyecto escolar de Robótica Básica. Permite visualizar el robot en 3D y controlar sus movimientos en tiempo real.

## Stack Tecnológico

- **Frontend**: React 18.3.1 + TypeScript + Vite
- **3D**: Three.js + React Three Fiber + @react-three/drei
- **UI**: Tailwind CSS + shadcn/ui
- **Comunicación**: Axios (REST API) + Socket.io (WebSocket)
- **Backend**: Python Flask (repositorio separado)

## Arquitectura del Proyecto

```
frontend-simulador/
├── src/
│   ├── app/
│   │   ├── components/          # Componentes React
│   │   │   ├── RobotViewer3D.tsx    # Visualización 3D del robot
│   │   │   ├── ControlPanel.tsx     # Panel de control de articulaciones
│   │   │   ├── DHParametersPanel.tsx # Parámetros DH
│   │   │   ├── TelemetryPanel.tsx   # Telemetría en tiempo real
│   │   │   └── ui/                  # Componentes shadcn/ui
│   │   ├── hooks/               # Custom hooks
│   │   │   ├── useRobotState.ts     # Estado del robot
│   │   │   ├── useWebSocket.ts      # Conexión WebSocket
│   │   │   └── useRobotKinematics.ts # Cinemática
│   │   └── App.tsx              # Componente principal
│   ├── services/                # Servicios de comunicación
│   │   ├── api.ts               # Cliente Axios
│   │   ├── robotService.ts      # API del robot
│   │   └── websocketService.ts  # Cliente WebSocket
│   ├── types/                   # Definiciones TypeScript
│   └── styles/                  # Estilos globales
├── public/
│   └── models/
│       └── ABB_IRB_140/         # Archivos STL del robot
└── .env                         # Variables de entorno

```

## Características Implementadas

### 1. Visualización 3D
- Carga de modelos STL del robot
- Jerarquía correcta de eslabones según parámetros DH
- Rotaciones en cascada (cinemática directa)
- Controles de cámara orbital
- Grid y ejes de referencia

### 2. Comunicación Backend
- REST API para obtener configuración y estado
- WebSocket para actualizaciones en tiempo real
- Fallback a polling si WebSocket falla
- Manejo de reconexión automática

### 3. Interfaz de Usuario
- Panel de control de articulaciones (sliders)
- Visualización de parámetros DH
- Telemetría en tiempo real
- Terminal de comandos (placeholder)
- Alertas y notificaciones

## Parámetros Denavit-Hartenberg (ABB IRB 140)

| Eslabón | θ (theta) | d (mm) | a (mm) | α (alpha) | Eje Rotación |
|---------|-----------|--------|--------|-----------|--------------|
| 1       | q1        | 352    | 0      | 0°        | Z            |
| 2       | q2        | 0      | 280    | 0°        | Y            |
| 3       | q3        | 0      | 70     | -90°      | Y            |
| 4       | q4        | 380    | 0      | 90°       | X            |
| 5       | q5        | 0      | 0      | -90°      | Y            |
| 6       | q6        | 65     | 0      | 0°        | X            |

## Implementación de la Jerarquía 3D

El robot se implementa usando una jerarquía recursiva de componentes donde cada eslabón es hijo del anterior:

```typescript
Base (J1) → Link1 (J2) → Link2 (J3) → Link3 (J4) → Link4 (J5) → Link5 (J6) → Link6
```

**Puntos clave:**
- Las posiciones del backend están en **milímetros** y se escalan a metros (×0.001)
- Cada eslabón tiene su `posicion_relativa` y `eje_rotacion`
- Los STL NO se centran (ya tienen origen correcto)
- Las rotaciones se resetean antes de aplicar nuevos ángulos
- Se aplica una **rotación inicial de -90° en X** para orientar el robot verticalmente

## API del Backend

### Endpoints REST

```
GET /api/robot/info          # Configuración del robot
GET /api/robot/estado        # Estado actual (ángulos, posición)
POST /api/robot/mover        # Mover articulaciones
POST /api/robot/home         # Posición home
```

### WebSocket Events

```
connect                      # Conexión establecida
respuesta_conexion          # Estado inicial
actualizacion_robot         # Actualizaciones en tiempo real
mover_robot                 # Enviar movimiento
```

## Variables de Entorno

```env
VITE_API_URL=http://127.0.0.1:5000
VITE_WS_URL=http://127.0.0.1:5000
```

## Comandos Útiles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run preview  # Preview del build
```

## Próximos Pasos Sugeridos

1. **Cinemática Inversa**: Implementar IK para mover el robot por posición cartesiana
2. **Trayectorias**: Planificación y ejecución de trayectorias
3. **Límites de Articulaciones**: Validar rangos de movimiento
4. **Detección de Colisiones**: Workspace y auto-colisión
5. **Guardar/Cargar Posiciones**: Sistema de presets
6. **Exportar Trayectorias**: Generar código RAPID (ABB)
7. **Múltiples Robots**: Soporte para UR5, SCARA, etc.

## Problemas Conocidos

- Los archivos STL deben copiarse manualmente a `public/models/ABB_IRB_140/`
- El WebSocket puede fallar en algunos navegadores (fallback a REST funciona)
- La cámara puede necesitar ajustes según el tamaño de pantalla

## Recursos

- **Documentación Three.js**: https://threejs.org/docs/
- **React Three Fiber**: https://docs.pmnd.rs/react-three-fiber
- **ABB IRB 140 Manual**: Consultar especificaciones técnicas
- **Parámetros DH**: Ver `GUIA_INTEGRACION_THREEJS.md`
