# Networking Lesson: IP Addressing and Subnetting

An IPv4 address has 32 bits, written as four numbers from 0 to 255. A subnet mask (or CIDR prefix such as /24) says which bits identify the network and which identify the host. /24 equals 255.255.255.0 and leaves 8 host bits.

Number of addresses in a subnet = 2^(32 - prefix). Usable hosts = that number minus 2, because the first address is the network address and the last is the broadcast address. A /24 has 256 addresses and 254 usable hosts, a /26 has 64 and 62, a /30 has 4 and 2.

Example: 192.168.10.37/26 belongs to the network 192.168.10.0 with broadcast 192.168.10.63 and usable hosts .1 to .62.

Private ranges (RFC 1918) are 10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16; they are not routed on the internet. To split a network into more subnets, borrow host bits: each borrowed bit doubles the number of subnets and halves the hosts in each.
