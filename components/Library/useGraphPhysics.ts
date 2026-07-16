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
  velocityDecay: number;
  gravityStrength: number;
  linkStrength: number;
}

export const DEFAULT_PHYSICS: PhysicsConfig = {
  chargeStrength: -450,
  linkDistance: 90,
  collisionRadius: 18,
  velocityDecay: 0.4,
  gravityStrength: 0.15,
  linkStrength: 0.4,
};

export const PHYSICS_RANGES = {
  chargeStrength: { min: -1000, max: -10 },
  linkDistance: { min: 20, max: 300 },
  collisionRadius: { min: 0, max: 80 },
  velocityDecay: { min: 0.1, max: 0.9, step: 0.05 },
  gravityStrength: { min: 0.0, max: 0.5, step: 0.05 },
  linkStrength: { min: 0.05, max: 1.0, step: 0.05 },
} as const;

export interface UseGraphPhysicsResult {
  chargeStrength: number;
  linkDistance: number;
  collisionRadius: number;
  velocityDecay: number;
  gravityStrength: number;
  linkStrength: number;
  setChargeStrength: (v: number) => void;
  setLinkDistance: (v: number) => void;
  setCollisionRadius: (v: number) => void;
  setVelocityDecay: (v: number) => void;
  setGravityStrength: (v: number) => void;
  setLinkStrength: (v: number) => void;
  resetPhysics: () => void;
  getPhysicsConfig: () => PhysicsConfig;
}

export function useGraphPhysics(): UseGraphPhysicsResult {
  const [chargeStrength, setChargeStrengthRaw] = useState(DEFAULT_PHYSICS.chargeStrength);
  const [linkDistance, setLinkDistanceRaw] = useState(DEFAULT_PHYSICS.linkDistance);
  const [collisionRadius, setCollisionRadiusRaw] = useState(DEFAULT_PHYSICS.collisionRadius);
  const [velocityDecay, setVelocityDecayRaw] = useState(DEFAULT_PHYSICS.velocityDecay);
  const [gravityStrength, setGravityStrengthRaw] = useState(DEFAULT_PHYSICS.gravityStrength);
  const [linkStrength, setLinkStrengthRaw] = useState(DEFAULT_PHYSICS.linkStrength);

  const setChargeStrength = useCallback((v: number) => {
    setChargeStrengthRaw(v);
  }, []);

  const setLinkDistance = useCallback((v: number) => {
    setLinkDistanceRaw(v);
  }, []);

  const setCollisionRadius = useCallback((v: number) => {
    setCollisionRadiusRaw(v);
  }, []);

  const setVelocityDecay = useCallback((v: number) => {
    setVelocityDecayRaw(v);
  }, []);

  const setGravityStrength = useCallback((v: number) => {
    setGravityStrengthRaw(v);
  }, []);

  const setLinkStrength = useCallback((v: number) => {
    setLinkStrengthRaw(v);
  }, []);

  const resetPhysics = useCallback(() => {
    setChargeStrengthRaw(DEFAULT_PHYSICS.chargeStrength);
    setLinkDistanceRaw(DEFAULT_PHYSICS.linkDistance);
    setCollisionRadiusRaw(DEFAULT_PHYSICS.collisionRadius);
    setVelocityDecayRaw(DEFAULT_PHYSICS.velocityDecay);
    setGravityStrengthRaw(DEFAULT_PHYSICS.gravityStrength);
    setLinkStrengthRaw(DEFAULT_PHYSICS.linkStrength);
  }, []);

  const getPhysicsConfig = useCallback((): PhysicsConfig => ({
    chargeStrength,
    linkDistance,
    collisionRadius,
    velocityDecay,
    gravityStrength,
    linkStrength,
  }), [chargeStrength, linkDistance, collisionRadius, velocityDecay, gravityStrength, linkStrength]);

  return {
    chargeStrength,
    linkDistance,
    collisionRadius,
    velocityDecay,
    gravityStrength,
    linkStrength,
    setChargeStrength,
    setLinkDistance,
    setCollisionRadius,
    setVelocityDecay,
    setGravityStrength,
    setLinkStrength,
    resetPhysics,
    getPhysicsConfig,
  };
}
