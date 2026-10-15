import type { Tool } from '../tool-types'
import { num, ok, round } from './helpers'

const HTTP: Record<number, string> = {
  100: 'Continue - the server received the request headers; keep sending the body.',
  101: 'Switching Protocols - for example upgrading to WebSocket.',
  200: 'OK - the request succeeded.',
  201: 'Created - a new resource was created (typical for POST).',
  202: 'Accepted - received, but processing is not finished.',
  204: 'No Content - success, nothing to return.',
  301: 'Moved Permanently - the URL has a new permanent address.',
  302: 'Found - temporary redirect.',
  304: 'Not Modified - use your cached copy.',
  307: 'Temporary Redirect - same method must be reused.',
  308: 'Permanent Redirect - same method must be reused.',
  400: 'Bad Request - the request is malformed or invalid.',
  401: 'Unauthorized - authentication is missing or invalid.',
  403: 'Forbidden - authenticated, but not allowed.',
  404: 'Not Found - no resource at that URL.',
  405: 'Method Not Allowed - the HTTP method is not supported here.',
  408: 'Request Timeout - the server gave up waiting.',
  409: 'Conflict - clashes with the current state (e.g. duplicate or edit conflict).',
  410: 'Gone - permanently removed.',
  413: 'Payload Too Large - the body is bigger than the server accepts.',
  415: 'Unsupported Media Type - the content type is not accepted.',
  422: 'Unprocessable Content - well-formed but failed validation.',
  429: 'Too Many Requests - you are being rate limited.',
  500: 'Internal Server Error - a bug or crash on the server.',
  501: 'Not Implemented - the server does not support this feature.',
  502: 'Bad Gateway - a proxy got an invalid reply from the upstream server.',
  503: 'Service Unavailable - overloaded or down for maintenance.',
  504: 'Gateway Timeout - a proxy timed out waiting for the upstream server.',
}

const PORTS: [number, string, string][] = [
  [20, 'FTP data', 'TCP'], [21, 'FTP control', 'TCP'], [22, 'SSH / SFTP', 'TCP'], [23, 'Telnet (insecure)', 'TCP'],
  [25, 'SMTP (mail sending)', 'TCP'], [53, 'DNS', 'UDP/TCP'], [67, 'DHCP server', 'UDP'], [68, 'DHCP client', 'UDP'],
  [69, 'TFTP', 'UDP'], [80, 'HTTP', 'TCP'], [110, 'POP3 (mail)', 'TCP'], [123, 'NTP (time)', 'UDP'],
  [135, 'Microsoft RPC', 'TCP'], [137, 'NetBIOS name', 'UDP'], [139, 'NetBIOS session', 'TCP'], [143, 'IMAP (mail)', 'TCP'],
  [161, 'SNMP', 'UDP'], [389, 'LDAP', 'TCP'], [443, 'HTTPS', 'TCP'], [445, 'SMB file sharing', 'TCP'],
  [465, 'SMTPS (mail)', 'TCP'], [514, 'Syslog', 'UDP'], [587, 'SMTP submission', 'TCP'], [636, 'LDAPS', 'TCP'],
  [993, 'IMAPS', 'TCP'], [995, 'POP3S', 'TCP'], [1433, 'Microsoft SQL Server', 'TCP'], [1521, 'Oracle DB', 'TCP'],
  [3306, 'MySQL / MariaDB', 'TCP'], [3389, 'RDP (Remote Desktop)', 'TCP'], [5432, 'PostgreSQL', 'TCP'], [5900, 'VNC', 'TCP'],
  [6379, 'Redis', 'TCP'], [8080, 'HTTP alternate / proxy', 'TCP'], [8443, 'HTTPS alternate', 'TCP'], [27017, 'MongoDB', 'TCP'],
]

const b64urlDecode = (s: string) => {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)))
}

function describeCronField(field: string, unit: string, names?: string[]): string {
  const name = (v: string) => (names ? (names[Number(v)] ?? v) : v)
  if (field === '*') return `every ${unit}`
  const step = /^\*\/(\d+)$/.exec(field)
  if (step) return `every ${step[1]} ${unit}s`
  return field
    .split(',')
    .map((part) => {
      const range = /^(\w+)-(\w+)(?:\/(\d+))?$/.exec(part)
      if (range) return `${name(range[1])} to ${name(range[2])}${range[3] ? ` every ${range[3]}` : ''}`
      return name(part)
    })
    .join(', ')
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const COMMON_PASSWORDS = ['password', '123456', '12345678', 'qwerty', 'letmein', 'admin', 'welcome', 'iloveyou', 'abc123', 'monkey', 'dragon', 'football', 'login', 'passw0rd']

const MATRIX: Record<string, Record<string, string>> = {
  high: { high: 'P1 - Critical: respond in 15 min, resolve in ~4 h', medium: 'P2 - High: respond in 30 min, resolve in ~8 h', low: 'P3 - Medium: respond in 4 h, resolve in ~3 days' },
  medium: { high: 'P2 - High: respond in 30 min, resolve in ~8 h', medium: 'P3 - Medium: respond in 4 h, resolve in ~3 days', low: 'P4 - Low: respond in 1 day, resolve in ~5 days' },
  low: { high: 'P3 - Medium: respond in 4 h, resolve in ~3 days', medium: 'P4 - Low: respond in 1 day, resolve in ~5 days', low: 'P4 - Low: respond in 1 day, resolve when scheduled' },
}

export const itTools: Tool[] = [
  {
    name: 'password_strength',
    category: 'IT',
    description: 'Estimate how strong a password is (entropy and common weaknesses). Never paste a real password you use.',
    keywords: 'password strength entropy secure weak strong check security passphrase crack complexity',
    parameters: { password: { type: 'string', description: 'A sample password to evaluate (not a real one)' } },
    run: ({ password = '' }) => {
      if (!password) return 'Provide a password to evaluate.'
      const pool = (/[a-z]/.test(password) ? 26 : 0) + (/[A-Z]/.test(password) ? 26 : 0) + (/\d/.test(password) ? 10 : 0) + (/[^a-zA-Z0-9]/.test(password) ? 32 : 0)
      let bits = password.length * Math.log2(pool || 1)
      const issues: string[] = []
      if (password.length < 12) issues.push('shorter than 12 characters')
      if (COMMON_PASSWORDS.some((c) => password.toLowerCase().includes(c))) {
        issues.push('contains a very common password')
        bits = Math.min(bits, 20)
      }
      if (/^[A-Za-z]{3,}[0-9]{1,6}[^a-zA-Z0-9]?$/.test(password) || /^[A-Za-z]+[^a-zA-Z0-9]?[0-9]{2,6}$/.test(password)) {
        issues.push('a word followed by numbers/symbols, one of the most guessed patterns')
        bits = Math.min(bits, 30)
      }
      if (/(.)\1{2,}/.test(password)) issues.push('repeated characters')
      if (/(0123|1234|2345|3456|abcd|bcde|qwer|asdf)/i.test(password)) issues.push('keyboard or number sequence')
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) issues.push('mixes fewer than 3 character types (long passphrases can still be fine)')
      const rating = bits < 28 ? 'very weak' : bits < 36 ? 'weak' : bits < 60 ? 'fair' : bits < 80 ? 'strong' : 'very strong'
      return `Estimated ${round(bits, 0)} bits of entropy: ${rating}. ${issues.length ? `Issues: ${issues.join('; ')}.` : 'No obvious patterns found.'} Prefer long passphrases and a password manager, and never share real passwords in a chat.`
    },
  },
  {
    name: 'cron_explain',
    category: 'IT',
    description: 'Explain a cron schedule expression (5 fields: minute hour day-of-month month day-of-week) in plain English.',
    keywords: 'cron crontab schedule job scheduler expression every minute hourly daily weekly explain linux task automation',
    parameters: { expression: { type: 'string', description: 'Cron expression, e.g. "*/15 9-17 * * 1-5"' } },
    run: ({ expression = '' }) => {
      const e = expression.trim()
      const special: Record<string, string> = { '@hourly': 'every hour', '@daily': 'every day at midnight', '@weekly': 'every Sunday at midnight', '@monthly': 'on the 1st of every month at midnight', '@yearly': 'every January 1st at midnight', '@reboot': 'once, at system startup' }
      if (special[e]) return `${e}: runs ${special[e]}.`
      const f = e.split(/\s+/)
      if (f.length !== 5) return 'A cron expression has 5 fields: minute hour day-of-month month day-of-week.'
      return `Runs when: minute = ${describeCronField(f[0], 'minute')}; hour = ${describeCronField(f[1], 'hour')}; day of month = ${describeCronField(f[2], 'day')}; month = ${describeCronField(f[3], 'month', MONTHS)}; weekday = ${describeCronField(f[4], 'day', DAYS)}.`
    },
  },
  {
    name: 'http_status',
    category: 'IT',
    description: 'Explain an HTTP status code (404, 500, 301, ...) or list the codes in a class (4xx, 5xx).',
    keywords: 'http status code error 404 500 403 401 301 302 502 503 504 429 web server response meaning not found forbidden',
    parameters: { code: { type: 'string', description: 'A code like 404, or a class like 4xx' } },
    run: ({ code = '' }) => {
      const cls = /^([1-5])xx$/i.exec(code.trim())
      if (cls) {
        const group = { 1: 'informational', 2: 'success', 3: 'redirection', 4: 'client error', 5: 'server error' }[Number(cls[1]) as 1]
        return `${cls[1]}xx = ${group}:\n${Object.entries(HTTP).filter(([c]) => c.startsWith(cls[1])).map(([c, d]) => `${c} ${d}`).join('\n')}`
      }
      const n = Number(code.trim())
      return HTTP[n] ? `${n}: ${HTTP[n]}` : `No entry for "${code}". Known codes: ${Object.keys(HTTP).join(', ')}.`
    },
  },
  {
    name: 'port_lookup',
    category: 'IT',
    description: 'Look up what a network port number is used for, or find the port of a service (SSH, HTTPS, RDP, MySQL, ...).',
    keywords: 'port number service ssh https http rdp mysql postgres smtp dns ftp smb firewall tcp udp well known ports lookup',
    parameters: { query: { type: 'string', description: 'A port number (443) or service name (ssh)' } },
    run: ({ query = '' }) => {
      const q = query.trim().toLowerCase()
      const hits = /^\d+$/.test(q) ? PORTS.filter(([p]) => p === Number(q)) : PORTS.filter(([, s]) => s.toLowerCase().includes(q))
      return hits.length ? hits.map(([p, s, proto]) => `${p}/${proto}: ${s}`).join('\n') : `No common service listed for "${query}".`
    },
  },
  {
    name: 'jwt_decode',
    category: 'IT',
    description: 'Decode the header and payload of a JSON Web Token (does NOT verify the signature).',
    keywords: 'jwt json web token decode bearer authentication claims expiry exp iat oauth api token inspect',
    parameters: { token: { type: 'string', description: 'The JWT (three parts separated by dots)' } },
    run: ({ token = '' }) => {
      const parts = token.trim().split('.')
      if (parts.length < 2) return 'That does not look like a JWT (header.payload.signature).'
      try {
        const header = JSON.parse(b64urlDecode(parts[0])) as Record<string, unknown>
        const payload = JSON.parse(b64urlDecode(parts[1])) as Record<string, unknown>
        const when = (k: string) => (typeof payload[k] === 'number' ? `\n${k}: ${new Date((payload[k] as number) * 1000).toISOString()}` : '')
        const exp = typeof payload.exp === 'number' ? (payload.exp * 1000 < Date.now() ? ' (EXPIRED)' : ' (still valid)') : ''
        return `Header: ${JSON.stringify(header)}\nPayload: ${JSON.stringify(payload)}${when('iat')}${when('nbf')}${when('exp')}${exp}\nSignature NOT verified - decoding does not prove the token is genuine.`
      } catch {
        return 'Could not decode that token; it may be malformed.'
      }
    },
  },
  {
    name: 'sla_downtime',
    category: 'IT',
    description: 'Convert an availability / uptime percentage (99.9%) into allowed downtime per day, month and year.',
    keywords: 'sla uptime availability nines downtime 99.9 99.99 allowed outage service level agreement reliability',
    parameters: { availability_percent: { type: 'string', description: 'Availability like 99.9' } },
    run: ({ availability_percent }) => {
      const a = num(availability_percent)
      if (!ok(a) || a <= 0 || a > 100) return 'Provide an availability between 0 and 100, e.g. 99.9.'
      const down = 1 - a / 100
      const fmt = (seconds: number) => {
        if (seconds >= 3600) return `${round(seconds / 3600, 2)} h`
        if (seconds >= 60) return `${round(seconds / 60, 1)} min`
        return `${round(seconds, 1)} s`
      }
      return `${a}% availability allows: ${fmt(down * 86400)} per day, ${fmt(down * 86400 * 7)} per week, ${fmt(down * 86400 * 30.44)} per month, ${fmt(down * 86400 * 365.25)} per year.`
    },
  },
  {
    name: 'chmod_calc',
    category: 'IT',
    description: 'Convert Linux file permissions between numeric (755) and symbolic (rwxr-xr-x) form and explain them.',
    keywords: 'chmod permissions linux unix file mode rwx 755 644 777 owner group others octal symbolic access rights',
    parameters: { permissions: { type: 'string', description: 'Numeric like 755 or symbolic like rwxr-xr-x' } },
    run: ({ permissions = '' }) => {
      const p = permissions.trim().replace(/^-/, '')
      const bits = ['r', 'w', 'x']
      let digits: number[]
      if (/^[0-7]{3}$/.test(p)) digits = [...p].map(Number)
      else if (/^[rwx-]{9}$/.test(p)) digits = [0, 3, 6].map((i) => [...p.slice(i, i + 3)].reduce((a, ch, j) => a + (ch === bits[j] ? 4 >> j : 0), 0))
      else return 'Give 3 octal digits (e.g. 755) or 9 symbols (e.g. rwxr-xr-x).'
      const sym = digits.map((d) => bits.map((b, j) => (d & (4 >> j) ? b : '-')).join('')).join('')
      const who = ['owner', 'group', 'others']
      const words = digits.map((d, i) => `${who[i]}: ${[d & 4 ? 'read' : '', d & 2 ? 'write' : '', d & 1 ? 'execute' : ''].filter(Boolean).join(', ') || 'no access'}`)
      return `${digits.join('')} = ${sym}\n${words.join('\n')}`
    },
  },
  {
    name: 'ticket_priority',
    category: 'IT',
    description: 'Help-desk priority (P1-P4) from impact and urgency, with typical response targets (ITIL-style matrix).',
    keywords: 'ticket priority p1 p2 p3 p4 impact urgency itil service desk help desk incident severity response time triage',
    parameters: {
      impact: { type: 'string', description: 'high, medium or low: how many people or how much business is affected' },
      urgency: { type: 'string', description: 'high, medium or low: how quickly it must be fixed' },
    },
    run: ({ impact = '', urgency = '' }) => {
      const i = impact.trim().toLowerCase()
      const u = urgency.trim().toLowerCase()
      const hit = MATRIX[i]?.[u]
      return hit ? `${hit} (typical targets; adjust to your own SLA).` : 'Give impact and urgency as high, medium or low.'
    },
  },
  {
    name: 'log_summary',
    category: 'IT',
    description: 'Summarise pasted log lines: counts of errors, warnings and info, the most repeated messages, and IP addresses.',
    keywords: 'log logs analyze summary errors warnings stack trace troubleshooting syslog application server output repeated messages ip addresses',
    parameters: { text: { type: 'string', description: 'The log text' } },
    run: ({ text = '' }) => {
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
      if (!lines.length) return 'Paste some log lines.'
      const count = (re: RegExp) => lines.filter((l) => re.test(l)).length
      const normalise = (l: string) => l.replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '').replace(/\d+/g, '#').trim()
      const freq = new Map<string, number>()
      for (const l of lines) if (/\b(error|fatal|critical|warn(ing)?)\b/i.test(l)) freq.set(normalise(l), (freq.get(normalise(l)) ?? 0) + 1)
      const top = [...freq].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, n]) => `${n}x ${m.slice(0, 100)}`)
      const ips = new Map<string, number>()
      for (const ip of text.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) ?? []) ips.set(ip, (ips.get(ip) ?? 0) + 1)
      const topIps = [...ips].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([ip, n]) => `${ip} (${n})`)
      return `${lines.length} lines: ${count(/\b(error|fatal|critical)\b/i)} errors, ${count(/\bwarn(ing)?\b/i)} warnings, ${count(/\binfo\b/i)} info.${top.length ? `\nMost repeated problems: ${top.join(' | ')}` : ''}${topIps.length ? `\nTop IPs: ${topIps.join(', ')}` : ''}`
    },
  },
]
