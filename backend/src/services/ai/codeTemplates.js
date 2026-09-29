/**
 * Verified code template library for the grounded engine.
 *
 * These are canonical, hand-checked examples used when the user asks for
 * code and no LLM provider is configured. Matchers are keyword-based; the
 * engine picks the best-scoring template(s) and always shows the language.
 *
 * Every snippet is intentionally standard-library-only so it runs as-is.
 */

export const CODE_TEMPLATES = [
  {
    id: 'js-promise',
    title: 'JavaScript: Promises and async/await',
    languages: ['javascript', 'promise', 'async'],
    patterns: [/promise/i, /async\s*\/\s*await/i, /\bawait\b/i, /\basync\b.*\bfunction\b/i, /then\s*\(/],
    code: `// 1. Create a promise
function fetchUserName(userId) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (userId > 0) resolve({ id: userId, name: 'Ada' });
      else reject(new Error('Invalid user id'));
    }, 500);
  });
}

// 2. Consume with .then() / .catch()
fetchUserName(1)
  .then((user) => console.log(user.name))   // "Ada"
  .catch((error) => console.error(error.message))
  .finally(() => console.log('done'));

// 3. Same logic with async/await
async function main() {
  try {
    const user = await fetchUserName(1);
    console.log(user.name);
  } catch (error) {
    console.error(error.message);
  }
}

// 4. Run several promises in parallel
const results = await Promise.all([
  fetchUserName(1),
  fetchUserName(2),
]);

// 5. Race / timeout pattern
const timeout = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('timed out')), 3000)
);
const value = await Promise.race([fetchUserName(1), timeout]);`,
    notes: [
      'A promise is pending until it resolves or rejects; .then() runs on resolve, .catch() on rejection.',
      'async/await is syntactic sugar over promises — errors surface as exceptions, so use try/catch.',
      'Promise.all() rejects as soon as any input rejects; use Promise.allSettled() to tolerate failures.',
    ],
  },
  {
    id: 'js-fetch',
    title: 'JavaScript: fetch() with async/await and error handling',
    languages: ['javascript', 'fetch', 'http', 'api'],
    patterns: [/fetch\s*\(/i, /\bhttp requests?\b/i, /\brest api\b/i, /axios/i, /\bget data\b.*\bapi\b/i],
    code: `async function getJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!response.ok) {
    // HTTP 4xx/5xx do NOT throw — you must check response.ok
    const error = new Error(\`HTTP \${response.status}\`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

// Usage
try {
  const data = await getJSON('https://api.example.com/users?page=1');
  console.log(data);
} catch (error) {
  console.error('Request failed:', error.message);
}

// POST example
await getJSON('https://api.example.com/users', {
  method: 'POST',
  body: JSON.stringify({ name: 'Ada' }),
});`,
    notes: [
      'fetch() only rejects on network failures — always check response.ok for HTTP errors.',
      'Send JSON with the Content-Type header and JSON.stringify() the body.',
      'Wrap calls in try/catch (or .catch()) so failures produce one clear error path.',
    ],
  },
  {
    id: 'js-quickstart-array',
    title: 'JavaScript: useful array methods (map, filter, reduce)',
    languages: ['javascript', 'array', 'map', 'filter'],
    patterns: [/\bmap\s*\(/i, /\bfilter\s*\(/i, /\breduce\s*\(/i, /array methods/i],
    code: `const users = [
  { name: 'Ada', age: 36, active: true },
  { name: 'Linus', age: 54, active: false },
  { name: 'Grace', age: 45, active: true },
];

const activeNames = users
  .filter((user) => user.active)          // keep matching items
  .map((user) => user.name);              // project to a new array
// ["Ada", "Grace"]

const totalAge = users.reduce(
  (sum, user) => sum + user.age,
  0
); // 135

const byName = Object.fromEntries(users.map((u) => [u.name, u]));
const adults = users.filter((u) => u.age >= 18);`,
    notes: [
      'map/filter/reduce never mutate the original array.',
      'Chain them left to right: filter narrows, map transforms, reduce folds into one value.',
    ],
  },
  {
    id: 'python-quickstart',
    title: 'Python: everyday starter patterns',
    languages: ['python'],
    patterns: [/\bpython\b/i, /\bdef \w+\(/i, /print\s*\(/i],
    code: `from pathlib import Path

# Functions with type hints
def greet(name: str) -> str:
    return f"Hello, {name}!"

print(greet("Ada"))

# Lists: comprehension, filtering, sorting
numbers = [5, 2, 9, 1, 7]
squares = [n ** 2 for n in numbers]          # [25, 4, 81, 1, 49]
evens = [n for n in numbers if n % 2 == 0]   # [2]
ordered = sorted(numbers, reverse=True)      # [9, 7, 5, 2, 1]

# Dictionaries
person = {"name": "Ada", "age": 36}
for key, value in person.items():
    print(f"{key}: {value}")

# Safe file reading
path = Path("data.txt")
text = path.read_text(encoding="utf-8") if path.exists() else ""`,
    notes: [
      'Python uses indentation for blocks — 4 spaces per level is the convention.',
      'Comprehensions are the idiomatic way to transform or filter sequences.',
      'Use pathlib instead of os.path for new code.',
    ],
  },
  {
    id: 'python-fibonacci-sort',
    title: 'Python: fibonacci, sorting and binary search',
    languages: ['python', 'algorithm'],
    patterns: [/fibonacci/i, /binary search/i, /quicksort/i, /bubble sort/i, /big o/i, /sort an? array/i],
    code: `from typing import List

# Iterative fibonacci — O(n) time, O(1) memory
def fibonacci(n: int) -> List[int]:
    seq = []
    a, b = 0, 1
    while a <= n:
        seq.append(a)
        a, b = b, a + b
    return seq

print(fibonacci(50))  # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]

# Binary search on a sorted list — O(log n)
def binary_search(items: List[int], target: int) -> int:
    low, high = 0, len(items) - 1
    while low <= high:
        mid = (low + high) // 2
        if items[mid] == target:
            return mid
        if items[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1

data = [1, 3, 5, 7, 9, 11]
print(binary_search(data, 7))  # 3`,
    notes: [
      'The iterative fibonacci avoids recursion’s exponential blow-up.',
      'Binary search requires sorted input and halves the range each step.',
      'Python’s built-in sort (Timsort) is O(n log n) — prefer sorted() in real code.',
    ],
  },
  {
    id: 'js-sort-search',
    title: 'JavaScript: sorting and binary search',
    languages: ['javascript', 'algorithm'],
    patterns: [/\bsort\b/i, /binary search/i, /quicksort/i, /search an? array/i],
    code: `// Sorting numbers correctly (default sort is lexicographic!)
const numbers = [40, 1, 5, 200];
numbers.sort((a, b) => a - b);          // [1, 5, 40, 200]

// Objects by a key
const users = [{ name: 'Ada', age: 36 }, { name: 'Grace', age: 45 }];
users.sort((a, b) => a.age - b.age);

// Binary search — array must be sorted first
function binarySearch(items, target) {
  let low = 0;
  let high = items.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (items[mid] === target) return mid;
    if (items[mid] < target) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}

console.log(binarySearch([1, 3, 5, 7, 9], 7)); // 3`,
    notes: [
      'Without a comparator, Array#sort converts to strings — always pass (a, b) => a - b for numbers.',
      'Binary search is O(log n) but the array must already be sorted.',
    ],
  },
  {
    id: 'react-component',
    title: 'React: functional component with state and effects',
    languages: ['react', 'jsx', 'component'],
    patterns: [/\breact\b/i, /usestate/i, /useeffect/i, /\bjsx\b/i, /component/i],
    code: `import { useState, useEffect } from 'react';

export default function UserCard({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Abort stale requests when userId changes or the component unmounts
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(\`/api/users/\${userId}\`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
        setUser(await response.json());
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [userId]);

  if (loading) return <p>Loading…</p>;
  if (error) return <p role="alert">Error: {error}</p>;
  if (!user) return null;

  return (
    <article className="card">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </article>
  );
}`,
    notes: [
      'Function components + hooks replace class lifecycles in modern React.',
      'Always clean up side effects (abort/fetch clear) inside useEffect’s return.',
      'Keys, loading and error states make UIs feel complete.',
    ],
  },
  {
    id: 'vue-component',
    title: 'Vue 3: Composition API component',
    languages: ['vue', 'composition api'],
    patterns: [/\bvue\b/i, /composition api/i, /ref\s*\(/i, /setup\s*\(/i],
    code: `<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({ endpoint: { type: String, required: true } });

const items = ref([]);
const loading = ref(false);
const error = ref(null);

const count = computed(() => items.value.length);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(props.endpoint);
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    items.value = await response.json();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section>
    <p v-if="loading">Loading…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <ul v-else>
      <li v-for="item in items" :key="item.id">{{ item.title }}</li>
    </ul>
    <footer>{{ count }} items</footer>
  </section>
</template>`,
    notes: [
      '<script setup> is the standard Vue 3 SFC style — bindings are exposed automatically.',
      'ref() holds reactive state; computed() derives values lazily.',
      'v-if / v-else-if / v-else keeps conditional rendering declarative.',
    ],
  },
  {
    id: 'node-server',
    title: 'Node.js: HTTP server and Express API',
    languages: ['node', 'express', 'server', 'api'],
    patterns: [/node\.?js/i, /\bexpress\b/i, /http server/i, /\brest\b.*\bserver\b/i, /\bapp\.(get|post)\(/i],
    code: `// --- Plain Node (no dependencies) ---
import http from 'node:http';

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/api/health') {
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
  }
});

server.listen(3000, () => console.log('listening on http://localhost:3000'));

// --- Express ---
import express from 'express';

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/users', (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  res.status(201).json({ id: 1, name });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
  next(err);
});

app.listen(3000, () => console.log('API on http://localhost:3000'));`,
    notes: [
      'Always parse JSON bodies before reading req.body and validate input.',
      'Express error middleware needs four arguments (err, req, res, next).',
      'Return proper status codes: 201 for created, 400 for bad input, 500 for failures.',
    ],
  },
  {
    id: 'sql-query',
    title: 'SQL: joins, aggregation and pagination',
    languages: ['sql', 'database', 'query'],
    patterns: [/\bsql\b/i, /\bjoin\b.*\btable/i, /\bselect\b.*\bfrom\b/i, /\bgroup by\b/i, /\bpostgres/i, /\bmysql\b/i],
    code: `-- Recent orders per customer (only customers with >= 1 order)
SELECT
  c.id,
  c.email,
  COUNT(o.id)          AS order_count,
  COALESCE(SUM(o.total), 0) AS lifetime_value,
  MAX(o.created_at)    AS last_order_at
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.created_at >= NOW() - INTERVAL '30 days'
GROUP BY c.id, c.email
HAVING COUNT(o.id) >= 1
ORDER BY lifetime_value DESC
LIMIT 20 OFFSET 0;

-- Left join to include customers without orders
SELECT c.email, o.id AS order_id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;

-- Prevent SQL injection: always use parameters
-- node-postgres:  db.query('SELECT * FROM users WHERE id = $1', [userId])`,
    notes: [
      'JOIN keeps only matching rows; LEFT JOIN keeps everything from the left table.',
      'WHERE filters rows before aggregation, HAVING filters after GROUP BY.',
      'Use parameterised queries ($1, ?) — never concatenate user input into SQL.',
    ],
  },
  {
    id: 'css-center',
    title: 'CSS: perfect centering and responsive layouts',
    languages: ['css', 'layout', 'flexbox', 'grid'],
    patterns: [/center (a|the) (div|element|box)/i, /flexbox/i, /\bcss grid\b/i, /responsive (layout|design)/i, /horizontal(ly)? cent(er|re)/i],
    code: `/* 1. Flexbox centering (any child) */
.parent {
  display: flex;
  align-items: center;      /* vertical */
  justify-content: center;  /* horizontal */
  min-height: 100vh;
}

/* 2. Grid centering */
.parent {
  display: grid;
  place-items: center;
  min-height: 100vh;
}

/* 3. Absolute positioning fallback */
.child {
  position: absolute;
  inset: 0;                 /* top/right/bottom/left: 0 */
  margin: auto;
  width: max-content;
  height: max-content;
}

/* 4. Fluid type + responsive grid */
.container {
  width: min(1100px, 100% - 2rem);
  margin-inline: auto;
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}`,
    notes: [
      'place-items: center is the shortest modern centering solution.',
      'min(100% - 2rem, 1100px) gives a fluid container without media queries.',
      'auto-fit + minmax() builds responsive grids with zero JS.',
    ],
  },
  {
    id: 'regex-email',
    title: 'Regex: validate email and common patterns',
    languages: ['regex', 'validation'],
    patterns: [/regex/i, /regular expression/i, /validate.*email/i, /\bmatch\b.*\bstring\b/i],
    code: `// Pragmatic email check (HTML input type="email" is stricter than regex alone)
const EMAIL = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/;

console.log(EMAIL.test('ada@example.com'));  // true
console.log(EMAIL.test('ada@example'));      // false

// Extract all numbers from a string
"Order 123, qty 4".match(/\\d+/g);           // ["123", "4"]

// Replace multiple spaces with one
'too    much    space'.replace(/\\s+/g, ' ');

// Named capture groups
const date = /(\\d{4})-(\\d{2})-(\\d{2})/.exec('2026-09-29');
const [ , year, month, day ] = date;`,
    notes: [
      'No single regex validates RFC 5322 email; combine a simple pattern with an HTML/JS input check.',
      'Escape backslashes in JS strings: write \\\\d to match a digit.',
      'Prefer non-greedy quantifiers (.*?) when extracting with groups.',
    ],
  },
  {
    id: 'python-class',
    title: 'Python: classes and dataclasses',
    languages: ['python', 'oop', 'class'],
    patterns: [/python.*class/i, /\bclass\b.*\bpython\b/i, /dataclass/i, /object oriented/i],
    code: `from dataclasses import dataclass, field

@dataclass
class Account:
    owner: str
    balance: float = 0.0
    tags: list = field(default_factory=list)

    def deposit(self, amount: float) -> None:
        if amount <= 0:
            raise ValueError("amount must be positive")
        self.balance += amount

    def withdraw(self, amount: float) -> None:
        if amount > self.balance:
            raise ValueError("insufficient funds")
        self.balance -= amount

    @property
    def is_empty(self) -> bool:
        return self.balance == 0

acc = Account(owner="Ada", balance=100)
acc.deposit(50)
print(acc.balance)      # 150
print(acc.is_empty)     # False`,
    notes: [
      '@dataclass removes boilerplate __init__ / __repr__ / __eq__.',
      '@property exposes computed values like method-call-free attributes.',
      'Validate invariants inside methods so objects can’t enter an invalid state.',
    ],
  },
  {
    id: 'debounce',
    title: 'JavaScript: debounce & throttle',
    languages: ['javascript', 'performance', 'events'],
    patterns: [/debounce/i, /throttle/i, /resize handler/i, /search input.*delay/i],
    code: `// Debounce: run once AFTER the user stops acting (search boxes)
function debounce(fn, wait = 300) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

// Throttle: run at most once per interval (scroll/resize)
function throttle(fn, interval = 200) {
  let last = 0;
  return function throttled(...args) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
}

const onSearch = debounce((value) => console.log('query:', value), 300);
document.querySelector('#q').addEventListener('input', (e) => onSearch(e.target.value));

window.addEventListener('resize', throttle(() => console.log(window.innerWidth)));`,
    notes: [
      'Debounce delays until inactivity; throttle enforces a minimum interval.',
      'Both avoid firing expensive handlers on every keystroke/frame.',
    ],
  },
  {
    id: 'react-state-array',
    title: 'React: updating state safely (immutably)',
    languages: ['react', 'state', 'hooks'],
    patterns: [/react.*state/i, /setstate/i, /immutable/i, /update.*array.*react/i],
    code: `const [items, setItems] = useState([]);

// Add
setItems((prev) => [...prev, newItem]);

// Update by id (never mutate!)
setItems((prev) =>
  prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
);

// Remove
setItems((prev) => prev.filter((item) => item.id !== id));

// Sort a copy
const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title));

// Derive values during render (no extra state)
const doneCount = items.filter((item) => item.done).length;`,
    notes: [
      'React skips re-rendering when the state reference is unchanged — always return new arrays/objects.',
      'Use the functional form (prev => ...) when the next value depends on the previous one.',
      'Derive values with computed variables instead of mirroring state.',
    ],
  },
  {
    id: 'js-error-handling',
    title: 'JavaScript: robust error handling patterns',
    languages: ['javascript', 'errors', 'try-catch'],
    patterns: [/try\s*\/?\s*catch/i, /error handling/i, /throw new error/i],
    code: `class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function loadUser(id) {
  try {
    const res = await fetch(\`/api/users/\${id}\`);
    if (!res.ok) throw new ApiError(\`User \${id} not found\`, res.status);
    return await res.json();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    console.error('loadUser failed:', error);
    throw error;               // rethrow unexpected errors
  } finally {
    console.log('request finished');
  }
}

// Central handler for promises without explicit catch
process.on('unhandledRejection', (reason) => {
  console.error('unhandled rejection:', reason);
});`,
    notes: [
      'Custom error classes carry structured fields (status codes) through the stack.',
      'Catch only what you can handle; rethrow or report the rest.',
      'finally() runs on success and failure — ideal for cleanup.',
    ],
  },
  {
    id: 'git-workflow',
    title: 'Git: everyday workflow commands',
    languages: ['git', 'workflow'],
    patterns: [/\bgit\b/i, /merge conflict/i, /branch/i, /\bcommit\b/i],
    code: `# Start a feature branch from an up-to-date main
git switch main && git pull
git switch -c feature/answer-engine

# Stage selectively, then commit with a clear message
git add backend/src/services/ai/groundedEngine.js
git commit -m "Add grounded answer engine"

# Keep the branch current with main
git fetch origin
git rebase origin/main          # or: git merge origin/main

# Recover from a mistake
git status                      # what changed?
git restore <file>              # discard unstaged changes
git commit --amend              # fix the last commit message/stage

# Publish
git push -u origin feature/answer-engine`,
    notes: [
      'Pull (or fetch + rebase) before starting work to avoid needless conflicts.',
      'Commit small, descriptive units — future-you will thank you.',
      'git restore cancels unstaged work; reflog recovers almost anything else.',
    ],
  },
  {
    id: 'python-data-json',
    title: 'Python: read/write JSON and CSV',
    languages: ['python', 'json', 'csv', 'file'],
    patterns: [/python.*json/i, /read.*json.*python/i, /csv.*python/i, /parse.*json/i],
    code: `import json
import csv
from pathlib import Path

# JSON — read
data = json.loads('{"name": "Ada", "age": 36}')      # from a string
data = json.loads(Path("user.json").read_text(encoding="utf-8"))

# JSON — write (pretty printed, UTF-8 safe)
Path("out.json").write_text(
    json.dumps(data, indent=2, ensure_ascii=False),
    encoding="utf-8",
)

# CSV — read into dicts
with open("rows.csv", newline="", encoding="utf-8") as fh:
    rows = list(csv.DictReader(fh))

# CSV — write
with open("report.csv", "w", newline="", encoding="utf-8") as fh:
    writer = csv.DictWriter(fh, fieldnames=["name", "score"])
    writer.writeheader()
    writer.writerows([{"name": "Ada", "score": 98}])`,
    notes: [
      'Always pass encoding="utf-8" to avoid platform-dependent decoding.',
      'json.loads() parses strings; json.load() reads from a file object.',
      'csv.DictReader gives you dictionaries keyed by the header row.',
    ],
  },
  {
    id: 'ts-types',
    title: 'TypeScript: useful type patterns',
    languages: ['typescript', 'types'],
    patterns: [/typescript/i, /\binterface\b/i, /\btype\b.*=.*\|/i, /generic/i],
    code: `interface User {
  id: number;
  name: string;
  email?: string;                 // optional
  readonly createdAt: Date;       // immutable
}

type Status = 'idle' | 'loading' | 'error';   // union

function first<T>(items: T[]): T | undefined {
  return items[0];
}

const user: User = { id: 1, name: 'Ada', createdAt: new Date() };
const status: Status = 'loading';

// Narrowing with a type guard
function assertDefined<T>(value: T | undefined, msg = 'missing'): T {
  if (value === undefined) throw new Error(msg);
  return value;
}`,
    notes: [
      'Interfaces are open for extension; type unions model finite states.',
      'Generics (<T>) keep helpers type-safe instead of falling back to any.',
      'Prefer narrowing (typeof/in checks) over type assertions.',
    ],
  },
  {
    id: 'docker-basics',
    title: 'Docker: Dockerfile and compose basics',
    languages: ['docker', 'deployment'],
    patterns: [/\bdocker\b/i, /dockerfile/i, /\bcontainer\b/i, /docker compose/i],
    code: `# Dockerfile (Node.js example)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]

# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://postgres:postgres@db:5432/app
    depends_on:
      - db
  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:`,
    notes: [
      'Multi-stage builds keep runtime images small (dev toolchain stays in the build stage).',
      'COPY package*.json before source files so dependency layers cache.',
      'Always run as a non-root user in the final stage.',
    ],
  },
];

/** Score templates against a query; best matches first. */
export function matchCodeTemplates (query, { limit = 2 } = {}) {
  const text = String(query || '');
  const scored = CODE_TEMPLATES.map((template) => {
    let score = 0;
    for (const pattern of template.patterns) {
      if (pattern.test(text)) score += 1;
    }
    // Language words are strong signals
    for (const language of template.languages) {
      if (new RegExp(`\\b${language}\\b`, 'i').test(text)) score += 1;
    }
    return { template, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((entry) => entry.template);
}

export default { CODE_TEMPLATES, matchCodeTemplates };
