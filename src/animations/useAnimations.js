import { useContext } from 'react';
import { AnimationsContext } from './AnimationLayer';

export default function useAnimations() {
  const ctx = useContext(AnimationsContext);
  if (!ctx) {
    throw new Error('useAnimations must be used within <AnimationLayer />');
  }
  return ctx;
}
