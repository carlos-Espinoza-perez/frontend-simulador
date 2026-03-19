# Skill: Integración con Backend

## Cuándo usar este skill

- Al agregar nuevos endpoints de API
- Al modificar la comunicación WebSocket
- Al actualizar interfaces TypeScript
- Al debuggear problemas de conexión

## Arquitectura de Comunicación

### REST API (Axios)
- Usado para operaciones puntuales (obtener info, mover robot)
- Cliente configurado en `src/services/api.ts`
- Servicios específicos en `src/services/robotService.ts`

### WebSocket (Socket.io)
- Usado para actualizaciones en tiempo real
- Cliente configurado en `src/services/websocketService.ts`
- Hook personalizado en `src/app/hooks/useWebSocket.ts`
- **Fallback automático a REST si falla**

## Configuración

### Variables de Entorno (.env)
```env
VITE_API_URL=http://127.0.0.1:5000
VITE_WS_URL=http://127.0.0.1:5000
```

### Cliente Axios
```typescript
// src/services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptores para logging y manejo de errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error);
    return Promise.reject(error);
  }
);
```

## Endpoints Disponibles

### GET /api/robot/info
Obtiene la configuración completa del robot.

**Response:**
```typescript
{
  robot: {
    nombre: string;
    modelo: string;
    fabricante: string;
    archivos_stl: string[];
    ruta_stl: string;
    eslabones: Eslabon[];
    visualizacion: {
      escala: number;
      camara: {...};
    };
    workspace: {...};
    materiales: {...};
    metadatos: {...};
  }
}
```

### GET /api/robot/estado
Obtiene el estado actual del robot.

**Response:**
```typescript
{
  angulos: number[];           // Ángulos de articulaciones en grados
  posicion: [number, number, number];  // Posición cartesiana
  orientacion: [number, number, number];  // Orientación (roll, pitch, yaw)
  transformaciones: number[][][];  // Matrices 4x4 de cada eslabón
}
```

### POST /api/robot/mover
Mueve el robot a nuevos ángulos.

**Request:**
```typescript
{
  angulos: number[];  // Array de 6 ángulos en grados
}
```

**Response:**
```typescript
{
  success: boolean;
  angulos: number[];
  posicion: [number, number, number];
  orientacion: [number, number, number];
}
```

### POST /api/robot/home
Mueve el robot a posición home (todos los ángulos en 0).

**Response:**
```typescript
{
  success: boolean;
  angulos: number[];
}
```

## WebSocket Events

### Cliente → Servidor

**mover_robot**
```typescript
socket.emit('mover_robot', {
  angulos: [0, 0, 0, 0, 0, 0]
});
```

### Servidor → Cliente

**respuesta_conexion**
```typescript
socket.on('respuesta_conexion', (data) => {
  console.log('Conectado:', data.mensaje);
  console.log('Estado inicial:', data.estado_actual);
});
```

**actualizacion_robot**
```typescript
socket.on('actualizacion_robot', (data) => {
  console.log('Actualización:', data.angulos);
  // Actualizar estado del robot
});
```

## Hooks Personalizados

### useRobotState
Maneja el estado del robot y sincronización con backend.

```typescript
const {
  robotInfo,      // Configuración del robot
  robotState,     // Estado actual (ángulos, posición)
  isLoading,      // Cargando datos
  error,          // Error si existe
  moveRobot,      // Función para mover
  goHome,         // Función para home
} = useRobotState();
```

**Características:**
- Carga inicial de configuración
- Polling cada 100ms si WebSocket no está disponible
- Manejo de errores automático
- Caché de configuración

### useWebSocket
Maneja la conexión WebSocket.

```typescript
const {
  isConnected,    // Estado de conexión
  lastMessage,    // Último mensaje recibido
  sendMessage,    // Función para enviar
  error,          // Error de conexión
} = useWebSocket(url);
```

**Características:**
- Reconexión automática
- Manejo de desconexión
- Buffer de mensajes
- Fallback a REST si falla

## Manejo de Errores

### Estrategia de Fallback
```typescript
// 1. Intentar WebSocket
const ws = useWebSocket(wsUrl);

// 2. Si falla, usar polling
useEffect(() => {
  if (!ws.isConnected) {
    const interval = setInterval(async () => {
      const estado = await robotService.getEstado();
      setRobotState(estado);
    }, 100);
    
    return () => clearInterval(interval);
  }
}, [ws.isConnected]);
```

### Manejo de Errores de Red
```typescript
try {
  const response = await robotService.moverRobot(angulos);
  setRobotState(response);
} catch (error) {
  console.error('Error moviendo robot:', error);
  // Mostrar notificación al usuario
  toast.error('Error al mover el robot');
}
```

## Interfaces TypeScript

### Actualizar Interfaces
Cuando el backend cambie, actualizar en `src/services/robotService.ts`:

```typescript
export interface RobotInfo {
  // Agregar nuevos campos aquí
}

export interface RobotState {
  // Agregar nuevos campos aquí
}
```

### Validación de Tipos
```typescript
// Usar type guards para validar datos del backend
function isValidRobotState(data: any): data is RobotState {
  return (
    Array.isArray(data.angulos) &&
    data.angulos.length === 6 &&
    Array.isArray(data.posicion) &&
    data.posicion.length === 3
  );
}
```

## Debugging

### Logs de Red
```typescript
// En api.ts
api.interceptors.request.use((config) => {
  console.log('[API Request]', config.method?.toUpperCase(), config.url);
  return config;
});

api.interceptors.response.use((response) => {
  console.log('[API Response]', response.status, response.config.url);
  return response;
});
```

### Logs de WebSocket
```typescript
// En websocketService.ts
socket.on('connect', () => {
  console.log('[WS] Conectado');
});

socket.on('disconnect', () => {
  console.log('[WS] Desconectado');
});

socket.onAny((event, ...args) => {
  console.log('[WS Event]', event, args);
});
```

## Testing

### Probar Endpoints
```bash
# GET info
curl http://127.0.0.1:5000/api/robot/info

# GET estado
curl http://127.0.0.1:5000/api/robot/estado

# POST mover
curl -X POST http://127.0.0.1:5000/api/robot/mover \
  -H "Content-Type: application/json" \
  -d '{"angulos": [0, 0, 0, 0, 0, 0]}'
```

### Probar WebSocket
```javascript
// En consola del navegador
const socket = io('http://127.0.0.1:5000');
socket.on('connect', () => console.log('Conectado'));
socket.emit('mover_robot', { angulos: [0, 0, 0, 0, 0, 0] });
```

## Archivos Relevantes

- `src/services/api.ts` - Cliente Axios
- `src/services/robotService.ts` - API del robot
- `src/services/websocketService.ts` - Cliente WebSocket
- `src/app/hooks/useRobotState.ts` - Hook de estado
- `src/app/hooks/useWebSocket.ts` - Hook de WebSocket
- `API_DOCUMENTACION.md` - Documentación completa del backend

## Troubleshooting

**CORS errors**: Verificar que el backend tenga CORS habilitado

**WebSocket no conecta**: Verificar URL y que el backend esté corriendo

**Datos no se actualizan**: Verificar que el polling esté activo si WebSocket falla

**Tipos incorrectos**: Actualizar interfaces en `robotService.ts`
