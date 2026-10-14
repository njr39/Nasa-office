// Single copy file (Katib review). Screens win over the draft copy deck where they differ;
// both variants are recorded so the conflict stays visible.
export const COPY = {
  basmala: 'بسم الله الرحمن الرحيم', // LOCKED, no translation
  wordmark: ['NASA HQ', 'NOJARA'],
  enter: 'Enter workspace', // screens S01/S14; deck v0.4 says "Enter HQ" (conflict open)
  enterSub: 'Sound on. KAST will greet you.',
  kastGreeting: 'Welcome to HQ. Where to?',
  kastNotConnected: 'KAST · not connected',
  kastNotConnectedDetail: "KAST isn't connected yet.",
  demo: 'DEMO',
  demoTitle: 'Demo data. Not real.',
  lite: 'Light view on. Same HQ, less load.',
  userControl: 'USER CONTROL', agentControl: 'AGENT CONTROL',
  giveControl: 'Give me control', takeControl: 'Take control',
} as const;
