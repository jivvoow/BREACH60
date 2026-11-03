// Every level of the campaign, as data. To add a playable level, add an entry to
// PLAYABLE_LEVELS; the map, unlocking and saving all read from here. No code changes.
//
//   name         shown on the map, per language
//   difficulty   1-5, map display only
//   penaltyMs    time pressure: seconds lost per mistake
//   stages       puzzle types, number of steps and complexity (see below)
//
// A stage's tier is its complexity; each puzzle keeps its own tier table. For
// recall it is the memory length; for audit, which rules can be broken. Unlocked, completed and best score are saved
// progress, so they come from GameManager.levelState, not from this file.

export const TOTAL_LEVELS = 100;
export const SECTOR_SIZE = 10;

const decrypt = (tier) => ({ id: 'perimeter', puzzle: 'password', tier });
const route = (tier) => ({ id: 'gateway', puzzle: 'network', tier });
const decode = (tier) => ({ id: 'coreLock', puzzle: 'pattern', tier });
const recall = (tier) => ({ id: 'buffer', puzzle: 'memory', tier });
const audit = (tier) => ({ id: 'auditLog', puzzle: 'log', tier });
const rootKey = (tier) => ({ id: 'rootKey', puzzle: 'password', tier }); // Tiers 4-5.

export const PLAYABLE_LEVELS = [
  {
    id: 1,
    name: { en: 'OUTER FIREWALL', ko: '외곽 방화벽' },
    difficulty: 1,
    penaltyMs: 5_000,
    stages: [decrypt(1), route(1), decode(1)],
  },
  {
    id: 2,
    name: { en: 'GUEST SUBNET', ko: '게스트 서브넷' },
    difficulty: 1,
    penaltyMs: 5_000,
    stages: [recall(1), route(1), decode(1)],
  },
  {
    id: 3,
    name: { en: 'MAIL RELAY', ko: '메일 릴레이' },
    difficulty: 2,
    penaltyMs: 5_000,
    stages: [decrypt(2), route(1), decode(1), rootKey(4)],
  },
  {
    id: 4,
    name: { en: 'BACKUP ARCHIVE', ko: '백업 저장소' },
    difficulty: 2,
    penaltyMs: 5_000,
    stages: [audit(1), route(2), decode(2), rootKey(4)],
  },
  {
    id: 5,
    name: { en: 'ACCESS CONTROL', ko: '접근 제어 서버' },
    difficulty: 3,
    penaltyMs: 5_000,
    stages: [decrypt(2), route(2), recall(2), decode(2)],
  },
  {
    id: 6,
    name: { en: 'AUTH CLUSTER', ko: '인증 클러스터' },
    difficulty: 3,
    penaltyMs: 5_000,
    stages: [decrypt(2), route(2), decode(3), rootKey(5)],
  },
  {
    id: 7,
    name: { en: 'SIGNAL TOWER', ko: '신호 타워' },
    difficulty: 3,
    penaltyMs: 6_000,
    stages: [recall(2), audit(2), route(3), decode(3)],
  },
  {
    id: 8,
    name: { en: 'DATA VAULT', ko: '데이터 금고' },
    difficulty: 4,
    penaltyMs: 6_000,
    stages: [decrypt(3), route(3), recall(2), decode(3), rootKey(5)],
  },
  {
    id: 9,
    name: { en: 'WATCHDOG CORE', ko: '감시 코어' },
    difficulty: 4,
    penaltyMs: 7_000,
    stages: [recall(3), route(3), audit(2), decode(3), rootKey(5)],
  },
  {
    id: 10,
    name: { en: 'SECTOR GATE', ko: '섹터 관문' },
    difficulty: 5,
    penaltyMs: 8_000,
    stages: [decrypt(3), recall(3), route(4), decode(4), rootKey(5)],
  },
  {
    id: 11,
    name: { en: 'INNER FIREWALL', ko: '내부 방화벽' },
    difficulty: 4,
    penaltyMs: 8_000,
    stages: [recall(3), decrypt(3), route(3), decode(3), rootKey(5)],
  },
  {
    id: 12,
    name: { en: 'STAFF DIRECTORY', ko: '직원 디렉터리' },
    difficulty: 4,
    penaltyMs: 8_000,
    stages: [decrypt(3), route(4), decode(3), recall(3), rootKey(5)],
  },
  {
    id: 13,
    name: { en: 'PAYROLL SERVER', ko: '급여 서버' },
    difficulty: 4,
    penaltyMs: 8_000,
    stages: [recall(4), route(3), decode(3), decrypt(3), rootKey(5)],
  },
  {
    id: 14,
    name: { en: 'TRAFFIC MONITOR', ko: '트래픽 감시기' },
    difficulty: 4,
    penaltyMs: 8_000,
    stages: [audit(3), route(4), decode(4), recall(3), rootKey(5)],
  },
  {
    id: 15,
    name: { en: 'CRYPTO BRIDGE', ko: '암호화 브리지' },
    difficulty: 5,
    penaltyMs: 8_000,
    stages: [recall(4), decrypt(3), route(4), decode(4), rootKey(5)],
  },
  {
    id: 16,
    name: { en: 'SHADOW DATABASE', ko: '그림자 데이터베이스' },
    difficulty: 5,
    penaltyMs: 9_000,
    stages: [decrypt(3), recall(3), route(3), decode(3), audit(3), rootKey(5)],
  },
  {
    id: 17,
    name: { en: 'SENTRY ARRAY', ko: '경비 어레이' },
    difficulty: 5,
    penaltyMs: 9_000,
    stages: [recall(4), route(4), decrypt(3), decode(3), recall(3), rootKey(5)],
  },
  {
    id: 18,
    name: { en: 'BLACK SITE LINK', ko: '비밀 시설 회선' },
    difficulty: 5,
    penaltyMs: 9_000,
    stages: [decrypt(3), route(5), decode(4), recall(4), decrypt(3), rootKey(5)],
  },
  {
    id: 19,
    name: { en: 'WARDEN AI', ko: '감시자 AI' },
    difficulty: 5,
    penaltyMs: 9_000,
    stages: [recall(4), decrypt(3), route(5), decode(4), audit(3), rootKey(5)],
  },
  {
    id: 20,
    name: { en: 'CORE MAINFRAME', ko: '중앙 메인프레임' },
    difficulty: 5,
    penaltyMs: 10_000,
    stages: [decrypt(3), recall(4), route(5), decode(4), audit(3), rootKey(5)],
  },
];

// The whole map. Levels without stages are shown locked until they are built.
export const LEVEL_CATALOG = Array.from({ length: TOTAL_LEVELS }, (_, i) =>
  PLAYABLE_LEVELS[i] ?? { id: i + 1, name: null, difficulty: null, penaltyMs: null, stages: [] });

export const sectorOf = (levelId) => Math.ceil(levelId / SECTOR_SIZE);
