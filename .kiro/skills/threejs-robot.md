# Skill: Trabajar con Three.js y Robot 3D

## Cuándo usar este skill

- Al modificar la visualización 3D del robot
- Al agregar nuevos modelos STL
- Al ajustar la jerarquía de eslabones
- Al implementar nuevas funcionalidades de cinemática

## Conceptos Clave

### Jerarquía de Eslabones

El robot usa una estructura recursiva donde cada eslabón es hijo del anterior. Esto permite que las rotaciones se propaguen automáticamente:

```typescript
function Eslabon({ eslabon, angulo, robotFolder, escala, children }) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Aplicar rotación según el eje
  useEffect(() => {
    if (groupRef.current) {
      const radianes = (angulo * Math.PI) / 180;
      groupRef.current.rotation.set(0, 0, 0); // Resetear primero
      
      switch (eslabon.eje_rotacion) {
        case 'x': groupRef.current.rotation.x = radianes; break;
        case 'y': groupRef.current.rotation.y = radianes; break;
        case 'z': groupRef.current.rotation.z = radianes; break;
      }
    }
  }, [angulo, eslabon.eje_rotacion]);
  
  // Escalar posiciones (mm a metros)
  const [x, y, z] = eslabon.posicion_relativa;
  const posicionEscalada = [x * escala, y * escala, z * escala];
  
  return (
    <group ref={groupRef} position={posicionEscalada}>
      <STLModel url={...} scale={escala} />
      {children}  {/* Siguiente eslabón */}
    </group>
  );
}
```

### Construcción Recursiva

```typescript
const construirJerarquia = (index: number): React.ReactNode => {
  if (index >= eslabones.length) return null;
  
  return (
    <Eslabon eslabon={eslabones[index]} angulo={jointAngles[index]} escala={scale}>
      {construirJerarquia(index + 1)}  {/* Recursión */}
    </Eslabon>
  );
};
```

## Reglas Importantes

### 1. Escalado
- Las posiciones del backend están en **milímetros**
- Multiplicar por `escala` (0.001) para convertir a metros
- Aplicar escala tanto a posiciones como a meshes

```typescript
// ✅ CORRECTO
const posicionEscalada = [x * escala, y * escala, z * escala];
<group position={posicionEscalada}>
  <STLModel scale={escala} />
</group>

// ❌ INCORRECTO (doble escalado)
<group scale={[escala, escala, escala]}>
  <group position={[x, y, z]}>
    <STLModel scale={escala} />
  </group>
</group>
```

### 2. Origen de STL
- Los archivos STL ya tienen su origen correcto
- **NO** centrar la geometría

```typescript
// ✅ CORRECTO
loader.load(url, (geometry) => {
  setGeometry(geometry);  // Sin centrar
});

// ❌ INCORRECTO
loader.load(url, (geometry) => {
  geometry.center();  // Esto mueve el origen
  setGeometry(geometry);
});
```

### 3. Rotaciones
- Siempre resetear rotaciones antes de aplicar nuevas
- Evita acumulación de rotaciones

```typescript
// ✅ CORRECTO
groupRef.current.rotation.set(0, 0, 0);  // Resetear
groupRef.current.rotation.x = radianes;   // Aplicar

// ❌ INCORRECTO
groupRef.current.rotation.x += radianes;  // Acumula
```

### 4. Ejes de Rotación
- Cada eslabón rota en su eje específico (x, y, o z)
- El eje viene del backend en `eslabon.eje_rotacion`

```typescript
switch (eslabon.eje_rotacion.toLowerCase()) {
  case 'x': groupRef.current.rotation.x = radianes; break;
  case 'y': groupRef.current.rotation.y = radianes; break;
  case 'z': groupRef.current.rotation.z = radianes; break;
}
```

### 5. Rotación Inicial
- El robot requiere una rotación inicial para orientarse correctamente
- Por defecto: -90° en X para ABB IRB 140
- Se configura en el backend: `rotacion_inicial: [-90, 0, 0]`

```typescript
// Obtener rotación inicial del backend o usar -90° en X por defecto
const rotacionInicial = robotInfo.visualizacion?.rotacion_inicial || [-90, 0, 0];
const [rx, ry, rz] = rotacionInicial;

// Aplicar al grupo del robot
<group rotation={[rx * Math.PI / 180, ry * Math.PI / 180, rz * Math.PI / 180]}>
  {construirJerarquia(0)}
</group>
```

## Estructura de Datos del Backend

```typescript
interface Eslabon {
  id: number;
  nombre: string;
  archivo_stl: string;
  posicion_relativa: [number, number, number];  // En mm
  rotacion_relativa: [number, number, number];
  eje_rotacion: 'x' | 'y' | 'z';
  color: string;
}

interface RobotInfo {
  eslabones: Eslabon[];
  visualizacion: {
    escala: number;  // 0.001 para mm a m
    rotacion_inicial?: [number, number, number];  // Rotación inicial en grados
    camara: {
      posicion: [number, number, number];
      fov: number;
      min_distancia: number;
      max_distancia: number;
    };
  };
  workspace: {
    alcance_maximo: number;
    grid: {
      tamaño: number;
      division: number;
    };
  };
}
```

## Debugging

### Verificar Jerarquía
```typescript
// En la consola del navegador
scene.traverse((obj) => {
  console.log(obj.name, obj.position, obj.rotation);
});
```

### Logs Útiles
```typescript
console.log('[Robot] Cargando:', robotFolder);
console.log('[Robot] Escala:', scale);
console.log('[Eslabon]', eslabon.nombre, 'posición:', posicionEscalada);
console.log('[STL] Cargado:', url);
```

## Archivos Relevantes

- `src/app/components/RobotViewer3D.tsx` - Componente principal de visualización
- `src/services/robotService.ts` - Interfaces TypeScript y API
- `GUIA_INTEGRACION_THREEJS.md` - Guía detallada de implementación
- `API_DOCUMENTACION.md` - Documentación del backend

## Ejemplo: Agregar Nuevo Robot

1. Copiar archivos STL a `public/models/NOMBRE_ROBOT/`
2. Backend debe proveer configuración con eslabones y DH
3. El frontend cargará automáticamente usando la misma lógica
4. Ajustar cámara y workspace si es necesario

## Troubleshooting

**Robot desarmado**: Verificar que posiciones estén escaladas correctamente

**Rotaciones incorrectas**: Verificar que se reseteen antes de aplicar

**STL no carga**: Verificar ruta en `public/models/` y consola del navegador

**Movimientos no se propagan**: Verificar jerarquía recursiva de componentes
