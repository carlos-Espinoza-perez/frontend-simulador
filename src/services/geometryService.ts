import websocketService from './websocketService';
export type GeometryType = 'box' | 'cylinder' | 'sphere' | 'table' | 'cad_stl';

export interface GeometryItem {
  id: string;
  nombre: string;
  tipo: GeometryType;
  posicion: [number, number, number]; // [X, Y, Z] en mm (marco mundo de celda)
  rotacion: [number, number, number]; // [Rx, Ry, Rz] en grados
  dimensiones: [number, number, number]; // [ancho/X, largo/Y, alto/Z] en mm
  color: string;
  opacidad: number;
  visible: boolean;
  wireframe?: boolean;
  stlBuffer?: ArrayBuffer;
  stlUrl?: string;
  esBaseRobot?: boolean;
}

export interface RobotBasePose {
  x: number; // mm
  y: number; // mm
  z: number; // mm
  rz: number; // grados rotación en torno a Z
}

export interface ColisionActiva {
  linkIndex: number;
  linkNombre: string;
  geomId: string;
  geomNombre: string;
}

export interface AlertaColision {
  activa: boolean;
  tipo: 'predictiva' | 'fisica';
  titulo: string;
  mensaje: string;
  detalle: string;
  obstaculo: string;
  link: string;
  timestamp: number;
}

export interface PiezaOpenCV3D {
  id: number;
  posicion_mm: [number, number];
  altura_mm?: number;
  area_px?: number;
  clase?: string;
}

export interface HistorialTransform {
  id: string | 'robot_base';
  posicionAnterior?: [number, number, number];
  rotacionAnterior?: [number, number, number];
  baseAnterior?: RobotBasePose;
  posicionNueva?: [number, number, number];
  rotacionNueva?: [number, number, number];
  baseNueva?: RobotBasePose;
}

const STORAGE_KEY = 'robot_cell_geometries_v6';
const BASE_STORAGE_KEY = 'robot_base_pose_v6';

const DEFAULT_GEOMETRIES: GeometryItem[] = [
  {
    id: 'geom_base_pedestal',
    nombre: 'Base Pedestal Robot',
    tipo: 'cad_stl',
    stlUrl: '/models/cell/base_robot.stl?v=4',
    posicion: [0, 0, 0],
    rotacion: [0, 0, 0],
    dimensiones: [450, 450, 650],
    color: '#475569',
    opacidad: 1,
    visible: true,
    esBaseRobot: true,
  },
  {
    id: 'geom_mesa_trabajo',
    nombre: 'Mesa Robótica',
    tipo: 'cad_stl',
    stlUrl: '/models/cell/mesa_robotica.stl?v=4',
    posicion: [650, 0, 0],
    rotacion: [0, 0, 0],
    dimensiones: [700, 1500, 772],
    color: '#334155',
    opacidad: 1,
    visible: true,
  },
  {
    id: 'geom_caja_muestra',
    nombre: 'Contenedor Piezas',
    tipo: 'box',
    posicion: [650, 200, 772],
    rotacion: [0, 0, 0],
    dimensiones: [120, 150, 60],
    color: '#0284c7',
    opacidad: 0.85,
    visible: true,
    wireframe: false,
  }
];

class GeometryService {
  private geometries: GeometryItem[] = [];
  private robotBasePose: RobotBasePose = { x: 0, y: 0, z: 650, rz: 0 };
  private selectedId: string | 'robot_base' | null = null;
  private transformMode: 'translate' | 'rotate' | 'none' = 'none';
  private isDraggingGizmo: boolean = false;
  private lastDragEndTime: number = 0;
  private colisiones: ColisionActiva[] = [];
  private alertaActual: AlertaColision | null = null;
  private alertaDisparada: boolean = false;
  private alertaListeners: Array<(alerta: AlertaColision | null) => void> = [];

  private listeners: Array<(items: GeometryItem[]) => void> = [];
  private baseListeners: Array<(pose: RobotBasePose) => void> = [];
  private selectListeners: Array<(id: string | 'robot_base' | null) => void> = [];
  private modeListeners: Array<(mode: 'translate' | 'rotate' | 'none') => void> = [];
  private dragListeners: Array<(dragging: boolean) => void> = [];
  private colisionListeners: Array<(colisiones: ColisionActiva[]) => void> = [];

  private showVisionPieces3D: boolean = true;
  private visionPieces: PiezaOpenCV3D[] = [];
  private visionListeners: Array<(show: boolean) => void> = [];

  constructor() {
    this.cargarDesdeStorage();
  }

  private cargarDesdeStorage(): void {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        const parsed = JSON.parse(guardado);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.geometries = parsed;
        } else {
          this.geometries = DEFAULT_GEOMETRIES.map((g) => ({ ...g }));
        }
      } else {
        this.geometries = DEFAULT_GEOMETRIES.map((g) => ({ ...g }));
      }

      const baseGuardada = localStorage.getItem(BASE_STORAGE_KEY);
      if (baseGuardada) {
        this.robotBasePose = JSON.parse(baseGuardada);
      } else {
        this.robotBasePose = { x: 0, y: 0, z: 650, rz: 0 };
      }
    } catch {
      this.geometries = DEFAULT_GEOMETRIES.map((g) => ({ ...g }));
      this.robotBasePose = { x: 0, y: 0, z: 650, rz: 0 };
    }
  }

  private guardarEnStorage(): void {
    try {
      const serializable = this.geometries.map(({ stlBuffer, ...resto }) => resto);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
      localStorage.setItem(BASE_STORAGE_KEY, JSON.stringify(this.robotBasePose));
    } catch {
    }
  }

  public suscribir(callback: (items: GeometryItem[]) => void): () => void {
    this.listeners.push(callback);
    callback([...this.geometries]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  public suscribirBase(callback: (pose: RobotBasePose) => void): () => void {
    this.baseListeners.push(callback);
    callback({ ...this.robotBasePose });
    return () => {
      this.baseListeners = this.baseListeners.filter((l) => l !== callback);
    };
  }

  public suscribirSeleccion(callback: (id: string | 'robot_base' | null) => void): () => void {
    this.selectListeners.push(callback);
    callback(this.selectedId);
    return () => {
      this.selectListeners = this.selectListeners.filter((l) => l !== callback);
    };
  }

  public suscribirModo(callback: (mode: 'translate' | 'rotate' | 'none') => void): () => void {
    this.modeListeners.push(callback);
    callback(this.transformMode);
    return () => {
      this.modeListeners = this.modeListeners.filter((l) => l !== callback);
    };
  }

  public suscribirDrag(callback: (dragging: boolean) => void): () => void {
    this.dragListeners.push(callback);
    callback(this.isDraggingGizmo);
    return () => {
      this.dragListeners = this.dragListeners.filter((l) => l !== callback);
    };
  }

  public suscribirColisiones(callback: (colisiones: ColisionActiva[]) => void): () => void {
    this.colisionListeners.push(callback);
    callback([...this.colisiones]);
    return () => {
      this.colisionListeners = this.colisionListeners.filter((l) => l !== callback);
    };
  }

  public obtenerTodas(): GeometryItem[] {
    return [...this.geometries];
  }

  public alinearRobotSobreBase(baseId?: string): void {
    const baseItem = baseId
      ? this.geometries.find((g) => g.id === baseId)
      : this.geometries.find((g) => g.esBaseRobot);

    this.despejarAlerta();
    if (baseItem) {
      const topZ = baseItem.posicion[2] + baseItem.dimensiones[2];
      this.actualizarBase({
        x: baseItem.posicion[0],
        y: baseItem.posicion[1],
        z: topZ,
        rz: baseItem.rotacion[2] || 0,
      });
    } else {
      this.actualizarBase({ x: 0, y: 0, z: 0, rz: 0 });
    }
  }

  public setEsBaseRobot(id: string, esBase: boolean): void {
    this.geometries.forEach((g) => {
      if (g.id === id) g.esBaseRobot = esBase;
      else if (esBase && g.esBaseRobot) g.esBaseRobot = false;
    });
    this.guardarEnStorage();
    this.notificar();
    if (esBase) {
      this.alinearRobotSobreBase(id);
    }
  }

  public obtenerBase(): RobotBasePose {
    return { ...this.robotBasePose };
  }

  public actualizarBase(pose: Partial<RobotBasePose>): void {
    this.robotBasePose = { ...this.robotBasePose, ...pose };
    this.guardarEnStorage();
    this.baseListeners.forEach((cb) => cb({ ...this.robotBasePose }));
  }

  public restablecerBase(): void {
    this.actualizarBase({ x: 0, y: 0, z: 0, rz: 0 });
  }

  public getSeleccionado(): string | 'robot_base' | null {
    return this.selectedId;
  }

  public seleccionar(id: string | 'robot_base' | null): void {
    if (this.selectedId !== id) {
      this.selectedId = id;
      this.transformMode = 'none';
      this.modeListeners.forEach((cb) => cb('none'));
      this.selectListeners.forEach((cb) => cb(id));
    }
  }

  public seleccionarConModo(id: string | 'robot_base' | null, mode: 'translate' | 'rotate' | 'none'): void {
    this.selectedId = id;
    this.transformMode = mode;
    this.selectListeners.forEach((cb) => cb(id));
    this.modeListeners.forEach((cb) => cb(mode));
  }

  public getModo(): 'translate' | 'rotate' | 'none' {
    return this.transformMode;
  }

  public setModo(mode: 'translate' | 'rotate' | 'none'): void {
    this.transformMode = mode;
    this.modeListeners.forEach((cb) => cb(mode));
  }

  public setDragging(dragging: boolean): void {
    this.isDraggingGizmo = dragging;
    if (!dragging) {
      this.lastDragEndTime = Date.now();
    }
    this.dragListeners.forEach((cb) => cb(dragging));
  }

  public recienArrastrado(): boolean {
    return this.isDraggingGizmo || Date.now() - this.lastDragEndTime < 450;
  }

  public actualizarColisiones(colisiones: ColisionActiva[]): void {
    const hayCambio =
      colisiones.length !== this.colisiones.length ||
      colisiones.some(
        (c, i) =>
          c.linkIndex !== this.colisiones[i]?.linkIndex ||
          c.geomId !== this.colisiones[i]?.geomId
      );

    if (hayCambio) {
      this.colisiones = colisiones;
      this.colisionListeners.forEach((cb) => cb([...this.colisiones]));

      if (colisiones.length > 0) {
        try {
          websocketService.abortRapidExecution();
        } catch {}
        if (!this.alertaDisparada) {
          const col = colisiones[0];
          this.dispararAlerta({
            activa: true,
            tipo: 'fisica',
            titulo: 'COLISIÓN DETECTADA',
            mensaje: `Contacto de ${col.linkNombre} con "${col.geomNombre}"`,
            detalle: `Se detectó colisión física entre ${col.linkNombre} y "${col.geomNombre}". Ejecución detenida de inmediato.`,
            obstaculo: col.geomNombre,
            link: col.linkNombre,
            timestamp: Date.now(),
          });
        }
      } else if (colisiones.length === 0 && this.alertaActual?.tipo === 'fisica') {
        this.despejarAlerta();
      }
    }
  }

  public agregar(geometria: Omit<GeometryItem, 'id'>): GeometryItem {
    const nuevoItem: GeometryItem = {
      ...geometria,
      id: `geom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    this.geometries.push(nuevoItem);
    this.guardarEnStorage();
    this.listeners.forEach((cb) => cb([...this.geometries]));
    this.seleccionar(nuevoItem.id);
    return nuevoItem;
  }

  public actualizar(id: string, updates: Partial<GeometryItem>): void {
    this.geometries = this.geometries.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    this.guardarEnStorage();
    this.listeners.forEach((cb) => cb([...this.geometries]));
  }

  public eliminar(id: string): void {
    this.geometries = this.geometries.filter((item) => item.id !== id);
    if (this.selectedId === id) {
      this.seleccionar(null);
    }
    this.guardarEnStorage();
    this.listeners.forEach((cb) => cb([...this.geometries]));
  }

  public toggleVisibilidad(id: string): void {
    this.geometries = this.geometries.map((item) =>
      item.id === id ? { ...item, visible: !item.visible } : item
    );
    this.guardarEnStorage();
    this.listeners.forEach((cb) => cb([...this.geometries]));
  }

  public restablecerPorDefecto(): void {
    this.geometries = DEFAULT_GEOMETRIES.map((g) => ({ ...g }));
    this.alinearRobotSobreBase();
    this.seleccionar(null);
    this.setModo('none');
    this.guardarEnStorage();
    this.listeners.forEach((cb) => cb([...this.geometries]));
  }

  private historialDeshacer: HistorialTransform[] = [];
  private historialRehacer: HistorialTransform[] = [];

  public registrarAccion(accion: HistorialTransform): void {
    this.historialDeshacer.push(accion);
    if (this.historialDeshacer.length > 50) this.historialDeshacer.shift();
    this.historialRehacer = [];
  }

  public deshacer(): boolean {
    const accion = this.historialDeshacer.pop();
    if (!accion) return false;

    if (accion.id === 'robot_base' && accion.baseAnterior) {
      const actual = this.obtenerBase();
      this.historialRehacer.push({ ...accion, baseNueva: actual });
      this.actualizarBase(accion.baseAnterior);
      return true;
    } else if (accion.id !== 'robot_base') {
      const item = this.geometries.find((g) => g.id === accion.id);
      if (item && accion.posicionAnterior && accion.rotacionAnterior) {
        this.historialRehacer.push({
          ...accion,
          posicionNueva: [...item.posicion],
          rotacionNueva: [...item.rotacion],
        });
        this.actualizar(accion.id, {
          posicion: [...accion.posicionAnterior],
          rotacion: [...accion.rotacionAnterior],
        });
        return true;
      }
    }
    return false;
  }

  public rehacer(): boolean {
    const accion = this.historialRehacer.pop();
    if (!accion) return false;

    if (accion.id === 'robot_base' && accion.baseNueva) {
      this.historialDeshacer.push(accion);
      this.actualizarBase(accion.baseNueva);
      return true;
    } else if (accion.id !== 'robot_base') {
      const item = this.geometries.find((g) => g.id === accion.id);
      if (item && accion.posicionNueva && accion.rotacionNueva) {
        this.historialDeshacer.push(accion);
        this.actualizar(accion.id, {
          posicion: [...accion.posicionNueva],
          rotacion: [...accion.rotacionNueva],
        });
        return true;
      }
    }
    return false;
  }

  public getMostrarPiezasVision(): boolean {
    return this.showVisionPieces3D;
  }

  public setVisionPieces(piezas: PiezaOpenCV3D[]): void {
    this.visionPieces = piezas;
  }

  public setMostrarPiezasVision(show: boolean): void {
    this.showVisionPieces3D = show;
    this.visionListeners.forEach((cb) => cb(show));
  }

  public suscribirVision(callback: (show: boolean) => void): () => void {
    this.visionListeners.push(callback);
    callback(this.showVisionPieces3D);
    return () => {
      this.visionListeners = this.visionListeners.filter((l) => l !== callback);
    };
  }

  public transformarMundoABase(puntoMundo: [number, number, number]): [number, number, number] {
    const dx = puntoMundo[0] - this.robotBasePose.x;
    const dy = puntoMundo[1] - this.robotBasePose.y;
    const dz = puntoMundo[2] - this.robotBasePose.z;
    const rad = (-this.robotBasePose.rz * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return [dx * cos - dy * sin, dx * sin + dy * cos, dz];
  }

  public transformarBaseAMundo(puntoBase: [number, number, number]): [number, number, number] {
    const rad = (this.robotBasePose.rz * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = puntoBase[0] * cos - puntoBase[1] * sin;
    const ry = puntoBase[0] * sin + puntoBase[1] * cos;
    return [rx + this.robotBasePose.x, ry + this.robotBasePose.y, puntoBase[2] + this.robotBasePose.z];
  }

  public suscribirAlerta(callback: (alerta: AlertaColision | null) => void): () => void {
    this.alertaListeners.push(callback);
    callback(this.alertaActual);
    return () => {
      this.alertaListeners = this.alertaListeners.filter((l) => l !== callback);
    };
  }

  public reiniciarCicloAlerta(): void {
    this.alertaDisparada = false;
    this.alertaActual = null;
    this.alertaListeners.forEach((cb) => cb(null));
  }

  public dispararAlerta(alerta: Omit<AlertaColision, 'activa' | 'timestamp'>): void {
    if (this.alertaDisparada) return;
    this.alertaDisparada = true;
    this.alertaActual = {
      ...alerta,
      activa: true,
      timestamp: Date.now(),
    };
    this.alertaListeners.forEach((cb) => cb(this.alertaActual));
  }

  public despejarAlerta(): void {
    this.alertaActual = null;
    this.alertaListeners.forEach((cb) => cb(null));
  }

  public predecirColision(
    q_deg: number[],
    posCartesiana?: { x: number; y: number; z: number } | [number, number, number]
  ): {
    hayColision: boolean;
    esAgarreValido: boolean;
    link?: string;
    obstaculo?: string;
    detalle?: string;
  } {
    if (!q_deg || q_deg.length < 6) {
      return { hayColision: false, esAgarreValido: false };
    }

    const rad = q_deg.map((deg) => (deg * Math.PI) / 180);
    const dh = [
      { a: 0.070, alpha: -Math.PI / 2, d: 0.352 },
      { a: 0.360, alpha: 0,            d: 0.000 },
      { a: 0.000, alpha: -Math.PI / 2, d: 0.000 },
      { a: 0.000, alpha:  Math.PI / 2, d: 0.380 },
      { a: 0.000, alpha: -Math.PI / 2, d: 0.000 },
      { a: 0.000, alpha: 0,            d: 0.065 },
    ];

    let T = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];

    const ptsMundo: [number, number, number][] = [[this.robotBasePose.x, this.robotBasePose.y, this.robotBasePose.z]];
    const bRad = (this.robotBasePose.rz * Math.PI) / 180;
    const cosB = Math.cos(bRad);
    const sinB = Math.sin(bRad);

    for (let i = 0; i < 6; i++) {
      let theta = rad[i] || 0;
      if (i === 1) theta -= Math.PI / 2;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      const ca = Math.cos(dh[i].alpha);
      const sa = Math.sin(dh[i].alpha);

      const A = [
        [ct, -st * ca,  st * sa, dh[i].a * ct],
        [st,  ct * ca, -ct * sa, dh[i].a * st],
        [0,   sa,       ca,      dh[i].d],
        [0,   0,        0,       1],
      ];

      const nextT = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          for (let k = 0; k < 4; k++) {
            nextT[r][c] += T[r][k] * A[k][c];
          }
        }
      }
      T = nextT;

      const px = T[0][3] * 1000;
      const py = T[1][3] * 1000;
      const pz = T[2][3] * 1000;

      const wx = px * cosB - py * sinB + this.robotBasePose.x;
      const wy = px * sinB + py * cosB + this.robotBasePose.y;
      const wz = pz + this.robotBasePose.z;
      ptsMundo.push([wx, wy, wz]);
    }

    if (posCartesiana) {
      const cx = (posCartesiana as any).x ?? (posCartesiana as any)[0];
      const cy = (posCartesiana as any).y ?? (posCartesiana as any)[1];
      const cz = (posCartesiana as any).z ?? (posCartesiana as any)[2];
      if (cx !== undefined && cy !== undefined && cz !== undefined) {
        ptsMundo[6] = [
          cx * cosB - cy * sinB + this.robotBasePose.x,
          cx * sinB + cy * cosB + this.robotBasePose.y,
          cz + this.robotBasePose.z,
        ];
      }
    }

    const linkNames = [
      'Base Robot',
      'Link 1',
      'Link 2',
      'Link 3',
      'Link 4',
      'Link 5 / Muñeca',
      'Efector Final',
    ];

    const segmentRadii = [80, 75, 65, 55, 50, 45];
    const MARGEN_SEGURIDAD = 20;

    const rPieza = 30;
    const mesaGeom = this.geometries.find((g) => g.id === 'geom_mesa_trabajo' || g.tipo === 'table');
    const zMesa = mesaGeom ? mesaGeom.posicion[2] + mesaGeom.dimensiones[2] : 772;
    const tcp = ptsMundo[6];

    if (tcp[0] >= 300 && tcp[0] <= 1000 && Math.abs(tcp[1]) <= 750) {
      if (tcp[2] <= zMesa - 2) {
        return {
          hayColision: true,
          esAgarreValido: false,
          link: 'Efector Final',
          obstaculo: 'Mesa Robótica',
          detalle: `Efector Final descendiendo a Z=${Math.round(tcp[2])} mm (bajo cota de seguridad de mesa ${zMesa} mm). Parada preventiva inmediata.`,
        };
      }
    }

    for (const g of this.geometries) {
      if (!g.visible || g.esBaseRobot || g.id === 'geom_mesa_trabajo' || g.tipo === 'table') continue;

      const [gx, gy, gz] = g.posicion;
      const [gw, gd, gh] = g.dimensiones;
      const rotZ = (-(g.rotacion[2] || 0) * Math.PI) / 180;
      const cosR = Math.cos(rotZ);
      const sinR = Math.sin(rotZ);

      let halfX = gw / 2;
      let halfY = gd / 2;
      let zMin = 0;
      let zMax = gh;

      if (g.tipo === 'cylinder') {
        halfX = gw;
        halfY = gw;
        zMax = gd || gh;
      } else if (g.tipo === 'sphere') {
        halfX = gw;
        halfY = gw;
        zMin = -gw;
        zMax = gw;
      }

      for (let s = 0; s < 6; s++) {
        const A = ptsMundo[s];
        const B = ptsMundo[s + 1];
        const rEff = segmentRadii[s] + MARGEN_SEGURIDAD;
        const rEffSq = rEff * rEff;

        const dx = B[0] - A[0];
        const dy = B[1] - A[1];
        const dz = B[2] - A[2];
        const len = Math.hypot(dx, dy, dz);
        const steps = Math.max(2, Math.ceil(len / 20));

        for (let step = 0; step <= steps; step++) {
          const t = step / steps;
          const px = A[0] + t * dx;
          const py = A[1] + t * dy;
          const pz = A[2] + t * dz;

          const relX = px - gx;
          const relY = py - gy;
          const relZ = pz - gz;

          const lx = relX * cosR - relY * sinR;
          const ly = relX * sinR + relY * cosR;
          const lz = relZ;

          const qx = Math.max(0, Math.abs(lx) - halfX);
          const qy = Math.max(0, Math.abs(ly) - halfY);
          const qz = Math.max(0, Math.max(zMin - lz, lz - zMax));
          const distSq = qx * qx + qy * qy + qz * qz;

          if (distSq <= rEffSq) {
            const nombreLink = s === 5 ? 'Efector Final / Muñeca' : linkNames[s + 1];
            return {
              hayColision: true,
              esAgarreValido: false,
              link: nombreLink,
              obstaculo: g.nombre,
              detalle: `Trayectoria de ${nombreLink} intercepta el volumen de seguridad de "${g.nombre}" en [X=${Math.round(px)}, Y=${Math.round(py)}, Z=${Math.round(pz)}] mm. Detenido preventivamente.`,
            };
          }
        }
      }
    }

    return { hayColision: false, esAgarreValido: false };
  }

  public evaluarConflictoRAPID(
    _tcpPosicionMm?: { x: number; y: number; z: number }
  ): { hayConflicto: boolean; esAgarreValido: boolean; motivo?: string } {
    if (this.colisiones.length === 0) {
      return { hayConflicto: false, esAgarreValido: false };
    }
    const c = this.colisiones[0];
    return {
      hayConflicto: true,
      esAgarreValido: false,
      motivo: `Colisión de ${c.linkNombre} con "${c.geomNombre}"`,
    };
  }
}

export const geometryService = new GeometryService();
export default geometryService;
