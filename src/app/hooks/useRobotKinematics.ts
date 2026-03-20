import { useMemo } from 'react';

interface DHParameter {
  a: number;      // Longitud del eslabón
  alpha: number;  // Ángulo de torsión
  d: number;      // Offset del eslabón
  theta: number;  // Ángulo de la articulación
}

export function useRobotKinematics(jointAngles: number[]) {

  const dhParameters = useMemo((): DHParameter[] => {
    const deg2rad = Math.PI / 180;
    
    return [
      { a: 0.070, alpha: -90 * deg2rad, d: 0.352, theta: jointAngles[0] * deg2rad },
      { a: 0.360, alpha: 0, d: 0, theta: jointAngles[1] * deg2rad },
      { a: 0, alpha: -90 * deg2rad, d: 0, theta: jointAngles[2] * deg2rad },
      { a: 0, alpha: 90 * deg2rad, d: 0.380, theta: jointAngles[3] * deg2rad },
      { a: 0, alpha: -90 * deg2rad, d: 0, theta: jointAngles[4] * deg2rad },
      { a: 0, alpha: 0, d: 0.065, theta: jointAngles[5] * deg2rad },
    ];
  }, [jointAngles]);

  const getTransformMatrix = (dh: DHParameter) => {
    const ct = Math.cos(dh.theta);
    const st = Math.sin(dh.theta);
    const ca = Math.cos(dh.alpha);
    const sa = Math.sin(dh.alpha);

    return [
      [ct, -st * ca, st * sa, dh.a * ct],
      [st, ct * ca, -ct * sa, dh.a * st],
      [0, sa, ca, dh.d],
      [0, 0, 0, 1],
    ];
  };

  const endEffectorPosition = useMemo(() => {
    let T = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];

    dhParameters.forEach((dh) => {
      const Ti = getTransformMatrix(dh);
      const newT = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];

      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          for (let k = 0; k < 4; k++) {
            newT[i][j] += T[i][k] * Ti[k][j];
          }
        }
      }
      T = newT;
    });

    return {
      x: T[0][3],
      y: T[1][3],
      z: T[2][3],
    };
  }, [dhParameters]);

  const detectSingularity = useMemo(() => {

    const j2j3Aligned = Math.abs(jointAngles[1] + jointAngles[2]) < 5;

    const j5NearZero = Math.abs(jointAngles[4]) < 5;

    return j2j3Aligned || j5NearZero;
  }, [jointAngles]);

  return {
    dhParameters,
    endEffectorPosition,
    singularityDetected: detectSingularity,
  };
}
