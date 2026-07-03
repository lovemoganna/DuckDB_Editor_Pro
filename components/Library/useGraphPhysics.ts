/**
 * useGraphPhysics — physics simulation state and update logic
 *
 * Manages D3 force simulation parameters:
 *   chargeStrength (repulsion), linkDistance, collisionRadius
 */

import { useState, useCallback } from 'react';

export interface PhysicsConfig {
  chargeStrength: number;
  linkDistance: number;
  collisionRadius: number;
}

export const DEFAULT_PHYSICS: PhysicsConfig = {
  chargeStrength: -450,
  linkDistance: 90,
  collisionRadius: 18,
};

export const PHYSICS_RANGES = {
  chargeStrength: { min: -1000, max: -10 },
  linkDistance: { min: 20, max: 300 },
  collisionRadius: { min: 0, max: 80 },
} as const;

export interface UseGraphPhysicsResult {
  chargeStrength: number;
  linkDistance: number;
  collisionRadius: number;
  setChargeStrength: (v: number) => void;
  setLinkDistance: (v: number) => void;
  setCollisionRadius: (v: number) => void;
  resetPhysics: () => void;
  getPhysicsConfig: () => PhysicsConfig;
}

export function useGraphPhysics(): UseGraphPhysicsResult {
  const [chargeStrength, setChargeStrengthRaw] = useState(DEFAULT_PHYSICS.chargeStrength);
  const [linkDistance, setLinkDistanceRaw] = useState(DEFAULT_PHYSICS.linkDistance);
  const [collisionRadius, setCollisionRadiusRaw] = useState(DEFAULT_PHYSICS.collisionRadius);

  const setChargeStrength = useCallback((v: number) => {
    setChargeStrengthRaw(v);
  }, []);

  const setLinkDistance = useCallback((v: number) => {
    setLinkDistanceRaw(v);
  }, []);

  const setCollisionRadius = useCallback((v: number) => {
    setCollisionRadiusRaw(v);
  }, []);

  const resetPhysics = useCallback(() => {
    setChargeStrengthRaw(DEFAULT_PHYSICS.chargeStrength);
    setLinkDistanceRaw(DEFAULT_PHYSICS.linkDistance);
    setCollisionRadiusRaw(DEFAULT_PHYSICS.collisionRadius);
  }, []);

  const getPhysicsConfig = useCallback((): PhysicsConfig => ({
    chargeStrength,
    linkDistance,
    collisionRadius,
  }), [chargeStrength, linkDistance, collisionRadius]);

  return {
    chargeStrength,
    linkDistance,
    collisionRadius,
    setChargeStrength,
    setLinkDistance,
    setCollisionRadius,
    resetPhysics,
    getPhysicsConfig,
  };
}
