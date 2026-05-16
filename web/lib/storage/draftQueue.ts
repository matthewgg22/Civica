const QUEUE_KEY = "civica_draft_queue";

export type QueuedAnswer = {
  packetId: string;
  questionId: string;
  value: unknown;
  queuedAt: number;
};

function readQueue(): QueuedAnswer[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedAnswer[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function enqueue(item: Omit<QueuedAnswer, "queuedAt">): void {
  const queue = readQueue();
  // Replace existing entry for same packetId+questionId (keep latest value)
  const filtered = queue.filter(
    (q) => !(q.packetId === item.packetId && q.questionId === item.questionId)
  );
  writeQueue([...filtered, { ...item, queuedAt: Date.now() }]);
}

export function dequeueAll(): QueuedAnswer[] {
  const items = readQueue();
  writeQueue([]);
  return items;
}

export function queueSize(): number {
  return readQueue().length;
}

export function hasQueued(): boolean {
  return queueSize() > 0;
}
