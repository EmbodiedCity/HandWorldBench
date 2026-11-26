const metricGroups = [
  { name: 'Visual quality', metrics: ['MUSIQ', 'Visual Plausibility', 'JEPA Similarity'] },
  { name: 'Hand fidelity', metrics: ['Pose Control', 'Keypoint Coverage', 'Hand Morphology'] },
  { name: 'Appearance consistency', metrics: ['Entity Consistency', 'Background Consistency', 'Photometric Consistency'] },
  { name: 'Instruction following', metrics: ['Action Adherence', 'Event Adherence'] },
  { name: 'Physical consistency', metrics: ['Trajectory Accuracy', 'Causal Plausibility', 'Evolution Correctness', 'State Regulation'] },
  { name: 'Temporal coherence', metrics: ['State Progression', 'Memory Consistency'] },
];
