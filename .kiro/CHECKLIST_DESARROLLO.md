# Checklist para Desarrollo

## Antes de Empezar

- [ ] Leer `INICIO_RAPIDO.md` para setup inicial
- [ ] Leer `README.md` para overview del proyecto
- [ ] Leer `PROYECTO.md` para entender el estado actual
- [ ] Revisar `.kiro/skills/proyecto-contexto.md` para contexto completo
- [ ] Verificar que el backend esté corriendo
- [ ] Verificar que los archivos STL existan en `public/models/ABB_IRB_140/`

## Al Agregar Nueva Funcionalidad

- [ ] Verificar si el backend necesita cambios
- [ ] Actualizar interfaces TypeScript en `src/services/robotService.ts`
- [ ] Seguir la arquitectura existente (componentes, hooks, servicios)
- [ ] Agregar logs de debug apropiados
- [ ] Probar con y sin WebSocket (fallback debe funcionar)
- [ ] Verificar que no rompa funcionalidad existente
- [ ] Actualizar documentación si es necesario

## Al Modificar Visualización 3D

- [ ] Leer `GUIA_INTEGRACION_THREEJS.md`
- [ ] Revisar `.kiro/skills/threejs-robot.md`
- [ ] Mantener jerarquía recursiva de eslabones
- [ ] Escalar posiciones correctamente (mm a metros)
- [ ] NO centrar geometrías STL
- [ ] Resetear rotaciones antes de aplicar nuevas
- [ ] Verificar que las rotaciones se propaguen en cascada

## Al Modificar Comunicación Backend

- [ ] Leer `API_DOCUMENTACION.md`
- [ ] Revisar `.kiro/skills/backend-integration.md`
- [ ] Actualizar interfaces TypeScript
- [ ] Mantener fallback a REST si WebSocket falla
- [ ] Manejar errores de red gracefully
- [ ] Validar datos recibidos del backend
- [ ] Agregar logs de debug

## Al Agregar Nuevo Robot

- [ ] Copiar archivos STL a `public/models/[ROBOT_ID]/`
- [ ] Configurar en el backend con eslabones y parámetros DH
- [ ] Verificar que el frontend cargue automáticamente
- [ ] Ajustar cámara y workspace si es necesario
- [ ] Probar movimientos de todas las articulaciones

## Antes de Commit

- [ ] Código sin errores de TypeScript
- [ ] Código sin errores en consola del navegador
- [ ] Funcionalidad probada con backend
- [ ] Logs de debug apropiados (no excesivos)
- [ ] Código limpio y bien estructurado
- [ ] Comentarios en español, nombres en inglés
- [ ] Sin valores hardcodeados (usar configuración del backend)

## Testing Manual

- [ ] Robot se visualiza correctamente
- [ ] Movimientos de articulaciones funcionan
- [ ] Telemetría se actualiza en tiempo real
- [ ] WebSocket conecta (o fallback funciona)
- [ ] Sin errores en consola
- [ ] UI responsiva en diferentes tamaños de pantalla

## Documentación

- [ ] Actualizar `CHANGELOG.md` si es un cambio importante
- [ ] Actualizar `README.md` si cambia el setup
- [ ] Actualizar `API_DOCUMENTACION.md` si cambia el backend
- [ ] Actualizar skills de Kiro si cambia la arquitectura

## Reglas de Oro

### ✅ SIEMPRE

- Usar jerarquía recursiva para eslabones
- Escalar posiciones del backend (mm → metros)
- Resetear rotaciones antes de aplicar nuevas
- Usar interfaces TypeScript
- Implementar fallback a REST
- Manejar errores gracefully
- Limpiar efectos y timers en cleanup
- Seguir la arquitectura existente

### ❌ NUNCA

- Centrar geometrías STL
- Acumular rotaciones sin resetear
- Hardcodear valores de configuración
- Asumir que WebSocket siempre funciona
- Ignorar errores de red
- Crear múltiples conexiones WebSocket
- Mutar estado directamente
- Olvidar cleanup en useEffect

## Recursos Rápidos

- **Documentación**: Ver `DOCUMENTACION.md` para índice completo
- **Skills**: `.kiro/skills/` para guías específicas
- **Steering**: `.kiro/steering/desarrollo-robot.md` para reglas de desarrollo
- **API**: `API_DOCUMENTACION.md` para endpoints
- **Three.js**: `GUIA_INTEGRACION_THREEJS.md` para implementación DH

## Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Preview
npm run preview

# Verificar tipos
npx tsc --noEmit
```

## Debugging

### Three.js
```javascript
// En consola del navegador
scene.traverse((obj) => console.log(obj.name, obj.position));
```

### WebSocket
```javascript
socket.onAny((event, ...args) => console.log(event, args));
```

### Estado
```javascript
console.log('[Estado]', robotState);
```

## Próximas Funcionalidades Sugeridas

### Corto Plazo
- [ ] Límites de articulaciones
- [ ] Velocidad de movimiento
- [ ] Guardar/cargar posiciones

### Mediano Plazo
- [ ] Cinemática inversa
- [ ] Trayectorias
- [ ] Detección de colisiones

### Largo Plazo
- [ ] Exportar código RAPID
- [ ] Múltiples robots
- [ ] Simulación de herramientas

---

**Tip**: Usa Kiro para desarrollo más eficiente. Los skills y steering files proporcionan contexto automático.
