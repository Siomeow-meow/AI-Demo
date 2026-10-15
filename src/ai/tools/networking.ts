import type { Tool } from '../tool-types'
import { num, ok, round } from './helpers'

const toInt = (ip: string): number | null => {
  const p = ip.trim().split('.')
  if (p.length !== 4 || p.some((x) => !/^\d{1,3}$/.test(x) || Number(x) > 255)) return null
  return ((Number(p[0]) << 24) | (Number(p[1]) << 16) | (Number(p[2]) << 8) | Number(p[3])) >>> 0
}
const toIp = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
const maskOf = (prefix: number) => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0)

/** Parse "192.168.1.10/24" or "192.168.1.10 255.255.255.0". */
function parseCidr(text: string): { ip: number; prefix: number } | null {
  const m = /^\s*(\d+\.\d+\.\d+\.\d+)\s*(?:\/\s*(\d{1,2})|\s+(\d+\.\d+\.\d+\.\d+))\s*$/.exec(text)
  if (!m) return null
  const ip = toInt(m[1])
  if (ip === null) return null
  if (m[2] !== undefined) return Number(m[2]) <= 32 ? { ip, prefix: Number(m[2]) } : null
  const mask = toInt(m[3])
  if (mask === null) return null
  const bits = mask.toString(2).padStart(32, '0')
  return /^1*0*$/.test(bits) ? { ip, prefix: bits.replace(/0/g, '').length } : null
}

const OSI = [
  [1, 'Physical', 'bits', 'Cables, hubs, Wi-Fi radio, fibre, repeaters'],
  [2, 'Data Link', 'frames', 'Ethernet, MAC addresses, switches, VLANs, ARP (between L2 and L3)'],
  [3, 'Network', 'packets', 'IP, ICMP, routers, routing protocols (OSPF, BGP)'],
  [4, 'Transport', 'segments', 'TCP, UDP, ports, flow control, load balancers (L4)'],
  [5, 'Session', 'data', 'Session setup, maintenance and teardown (RPC, NetBIOS)'],
  [6, 'Presentation', 'data', 'Encryption (TLS), compression, character encoding, data formats'],
  [7, 'Application', 'data', 'HTTP, DNS, SMTP, FTP, SSH, DHCP - what apps use directly'],
] as const

const DNS: Record<string, string> = {
  A: 'Maps a name to an IPv4 address (example.com -> 93.184.216.34).',
  AAAA: 'Maps a name to an IPv6 address.',
  CNAME: 'Alias: points one name to another name (www -> example.com). Cannot be used at the zone root.',
  MX: 'Mail exchanger: which servers accept email for the domain, with priorities (lower = preferred).',
  TXT: 'Free text; used for SPF, DKIM, DMARC and domain ownership verification.',
  NS: 'Name servers that are authoritative for the zone.',
  SOA: 'Start of authority: primary server, admin contact, serial number and refresh timers for a zone.',
  PTR: 'Reverse lookup: maps an IP address back to a name.',
  SRV: 'Locates a service: host, port, priority and weight (e.g. SIP, LDAP).',
  CAA: 'Restricts which certificate authorities may issue certificates for the domain.',
}

const SIZE: Record<string, number> = { b: 1, kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4 }
const SPEED: Record<string, number> = { bps: 1, kbps: 1e3, mbps: 1e6, gbps: 1e9, 'kb/s': 8e3, 'mb/s': 8e6, 'gb/s': 8e9 }

const fmtTime = (s: number) => {
  if (s < 1) return `${round(s * 1000, 0)} ms`
  if (s < 60) return `${round(s, 1)} s`
  if (s < 3600) return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`
  return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`
}

export const networkingTools: Tool[] = [
  {
    name: 'subnet_calc',
    category: 'Networking',
    description: 'Subnet calculator: network address, broadcast, mask, wildcard, host range and host count for an IPv4 CIDR like 192.168.1.10/24.',
    trigger: /\d+\.\d+\.\d+\.\d+\s*\/\s*\d{1,2}\b/,
    keywords: 'subnet calculator cidr network address broadcast netmask mask wildcard host range usable hosts ipv4 slash prefix',
    parameters: { cidr: { type: 'string', description: 'IP with prefix, e.g. 192.168.1.10/24 (or "ip mask")' } },
    run: ({ cidr = '' }) => {
      const c = parseCidr(cidr)
      if (!c) return 'Give an IPv4 address with a prefix, like 192.168.1.10/24.'
      const mask = maskOf(c.prefix)
      const net = (c.ip & mask) >>> 0
      const bcast = (net | (~mask >>> 0)) >>> 0
      const total = 2 ** (32 - c.prefix)
      const usable = c.prefix >= 31 ? total : total - 2
      const range = c.prefix >= 31 ? `${toIp(net)} - ${toIp(bcast)}` : `${toIp(net + 1)} - ${toIp(bcast - 1)}`
      return `Network ${toIp(net)}/${c.prefix}\nMask ${toIp(mask)} (wildcard ${toIp(~mask >>> 0)})\nBroadcast ${toIp(bcast)}\nHost range ${range}\nTotal addresses ${total}, usable hosts ${usable}`
    },
  },
  {
    name: 'ip_info',
    category: 'Networking',
    description: 'Classify an IPv4 address: private, public, loopback, link-local, multicast, class, and binary / decimal forms.',
    trigger: /\b\d{1,3}(?:\.\d{1,3}){3}\b/,
    keywords: 'ip address info private public rfc1918 loopback link local apipa class a b c binary decimal hex classify ipv4 internal external',
    parameters: { ip: { type: 'string', description: 'IPv4 address' } },
    run: ({ ip = '' }) => {
      const n = toInt(ip)
      if (n === null) return 'That is not a valid IPv4 address.'
      const inRange = (base: string, prefix: number) => ((n & maskOf(prefix)) >>> 0) === ((toInt(base) as number) & maskOf(prefix)) >>> 0
      const kind = inRange('10.0.0.0', 8) || inRange('172.16.0.0', 12) || inRange('192.168.0.0', 16)
        ? 'private (RFC 1918, not routable on the internet)'
        : inRange('127.0.0.0', 8) ? 'loopback (this machine)'
        : inRange('169.254.0.0', 16) ? 'link-local / APIPA (no DHCP answer was received)'
        : inRange('100.64.0.0', 10) ? 'carrier-grade NAT shared space'
        : inRange('224.0.0.0', 4) ? 'multicast'
        : inRange('240.0.0.0', 4) ? 'reserved'
        : inRange('192.0.2.0', 24) || inRange('198.51.100.0', 24) || inRange('203.0.113.0', 24) ? 'documentation / example range'
        : 'public (routable on the internet)'
      const first = n >>> 24
      const cls = first < 128 ? 'A' : first < 192 ? 'B' : first < 224 ? 'C' : first < 240 ? 'D (multicast)' : 'E (reserved)'
      const bin = [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].map((x) => x.toString(2).padStart(8, '0')).join('.')
      return `${toIp(n)}: ${kind}. Classful class ${cls}.\nBinary ${bin}\nDecimal ${n}, hex 0x${n.toString(16).padStart(8, '0')}`
    },
  },
  {
    name: 'cidr_contains',
    category: 'Networking',
    description: 'Check whether an IPv4 address belongs to a subnet (CIDR range).',
    trigger: /\d+\.\d+\.\d+\.\d+\s+(?:in|inside|within|part of|belong)\b.*\d+\.\d+\.\d+\.\d+\s*\/\s*\d/i,
    keywords: 'cidr contains in subnet range belongs address inside network same subnet firewall rule allowlist check membership',
    parameters: {
      ip: { type: 'string', description: 'IPv4 address to test' },
      cidr: { type: 'string', description: 'Network in CIDR form, e.g. 10.0.0.0/16' },
    },
    run: ({ ip = '', cidr = '' }) => {
      const n = toInt(ip)
      const c = parseCidr(cidr)
      if (n === null || !c) return 'Provide a valid IPv4 address and a CIDR like 10.0.0.0/16.'
      const mask = maskOf(c.prefix)
      const net = (c.ip & mask) >>> 0
      const inside = ((n & mask) >>> 0) === net
      return `${ip} is ${inside ? '' : 'NOT '}inside ${toIp(net)}/${c.prefix} (${toIp(net)} - ${toIp((net | (~mask >>> 0)) >>> 0)}).`
    },
  },
  {
    name: 'subnet_split',
    category: 'Networking',
    description: 'Split a network into equal smaller subnets, either by number of subnets or by hosts needed per subnet.',
    keywords: 'subnet split divide vlsm subnetting subnets carve network plan hosts per subnet department segments ip plan',
    parameters: {
      cidr: { type: 'string', description: 'Network to split, e.g. 192.168.0.0/24' },
      subnets: { type: 'string', description: 'How many subnets you need', optional: true },
      hosts_per_subnet: { type: 'string', description: 'Usable hosts needed in each subnet', optional: true },
    },
    run: ({ cidr = '', subnets, hosts_per_subnet }) => {
      const c = parseCidr(cidr)
      if (!c) return 'Provide a network like 192.168.0.0/24.'
      let newPrefix: number
      if (Number.isFinite(num(subnets))) newPrefix = c.prefix + Math.ceil(Math.log2(Math.max(num(subnets), 1)))
      else if (Number.isFinite(num(hosts_per_subnet))) newPrefix = 32 - Math.ceil(Math.log2(num(hosts_per_subnet) + 2))
      else return 'Give either subnets or hosts_per_subnet.'
      if (newPrefix > 30 || newPrefix < c.prefix) return `That does not fit: it would need a /${newPrefix} inside a /${c.prefix}.`
      const base = (c.ip & maskOf(c.prefix)) >>> 0
      const count = 2 ** (newPrefix - c.prefix)
      const size = 2 ** (32 - newPrefix)
      const list = Array.from({ length: Math.min(count, 16) }, (_, i) => {
        const net = base + i * size
        return `${toIp(net)}/${newPrefix}  hosts ${toIp(net + 1)} - ${toIp(net + size - 2)}`
      })
      return `${count} subnets of /${newPrefix} (${size - 2} usable hosts each)${count > 16 ? ', first 16 shown' : ''}:\n${list.join('\n')}`
    },
  },
  {
    name: 'transfer_time',
    category: 'Networking',
    description: 'How long a file transfer or backup takes for a given size and network speed.',
    keywords: 'transfer time download upload how long file size bandwidth speed mbps gbps backup copy network throughput eta',
    parameters: {
      size: { type: 'string', description: 'File or data size as a number' },
      size_unit: { type: 'string', description: 'B, KB, MB, GB or TB' },
      speed: { type: 'string', description: 'Link speed as a number' },
      speed_unit: { type: 'string', description: 'Kbps, Mbps, Gbps or MB/s' },
      efficiency_percent: { type: 'string', description: 'Real-world efficiency in percent (default 100)', optional: true },
    },
    run: ({ size, size_unit = 'MB', speed, speed_unit = 'Mbps', efficiency_percent }) => {
      const s = num(size)
      const v = num(speed)
      const e = Number.isFinite(num(efficiency_percent)) ? num(efficiency_percent) / 100 : 1
      const su = SIZE[size_unit.trim().toLowerCase()]
      const vu = SPEED[speed_unit.trim().toLowerCase()]
      if (!ok(s, v) || !su || !vu || e <= 0) return 'Provide a size with unit (B/KB/MB/GB/TB) and a speed with unit (Kbps/Mbps/Gbps/MB/s).'
      return `${s} ${size_unit} at ${v} ${speed_unit}${e < 1 ? ` (${round(e * 100, 0)}% efficiency)` : ''} takes about ${fmtTime((s * su * 8) / (v * vu * e))}.`
    },
  },
  {
    name: 'dns_records',
    category: 'Networking',
    description: 'Explain a DNS record type (A, AAAA, CNAME, MX, TXT, NS, SOA, PTR, SRV, CAA). Empty to list them all.',
    keywords: 'dns record type a aaaa cname mx txt ns soa ptr srv caa spf dkim dmarc domain name system zone explain',
    parameters: { type: { type: 'string', description: 'Record type, e.g. MX; empty for all', optional: true } },
    run: ({ type = '' }) => {
      const t = type.trim().toUpperCase()
      if (!t) return Object.entries(DNS).map(([k, v]) => `${k}: ${v}`).join('\n')
      return DNS[t] ? `${t}: ${DNS[t]}` : `Unknown record type "${type}". Known: ${Object.keys(DNS).join(', ')}.`
    },
  },
  {
    name: 'osi_lookup',
    category: 'Networking',
    description: 'Look up an OSI model layer by number or name, or find which layer a protocol or device belongs to.',
    keywords: 'osi model layer physical data link network transport session presentation application tcp ip switch router protocol which layer',
    parameters: { query: { type: 'string', description: 'Layer number (3), name (transport), protocol (HTTP) or device (router); empty for all' , optional: true } },
    run: ({ query = '' }) => {
      const q = query.trim().toLowerCase()
      const rows = OSI.filter(([n, name, , ex]) => !q || String(n) === q || name.toLowerCase().includes(q) || ex.toLowerCase().includes(q))
      return rows.length
        ? rows.map(([n, name, pdu, ex]) => `Layer ${n} ${name} (data unit: ${pdu}): ${ex}`).join('\n')
        : `No layer matches "${query}".`
    },
  },
]
