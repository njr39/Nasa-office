// Single copy file (Katib review). English only, including the header (PRD v1.2 supersedes the Arabic header on the screens).
export const COPY = {
  wordmark: ['NASA HQ', 'NOJARA'],
  gateTitle: 'Select an agent',
  enter: 'Enter workspace', // screens S01/S14; copy deck v0.4 says "Enter HQ" (open conflict)
  enterNeedsAgent: 'Select an agent to continue.',
  enterSub: 'Choosing KAST starts voice when you press Enter. You can type instead.',
  kastGreeting: 'Welcome to HQ. Where to?',
  kastNotConnected: 'KAST · not connected',
  demo: 'DEMO', demoTitle: 'Demo data. Not real.',
  userControl: 'USER CONTROL', agentControl: 'AGENT CONTROL',
  giveControl: 'Give me control', takeControl: 'Take control',
  readOnly: 'Read only', noChanges: 'No changes made',
  syntheticNote: 'Synthetic demo data only. Do not enter real or private information.',
} as const;
