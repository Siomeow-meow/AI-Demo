# Networking Lesson: TCP, UDP, DNS and DHCP

TCP is reliable: it sets up a connection with a three-way handshake (SYN, SYN-ACK, ACK), numbers the data, re-sends lost segments and controls the speed. Web pages, email and file transfer use it. UDP is faster and connectionless with no delivery guarantee, which suits video calls, gaming and DNS lookups.

DNS turns names into IP addresses. A device asks its resolver; if the answer is not cached, the resolver asks a root server, then the top-level domain server (such as .com), then the domain's authoritative name server, and caches the result for the record's TTL.

DHCP gives devices an IP address automatically in four steps: Discover, Offer, Request and Acknowledge (DORA). It also provides the subnet mask, default gateway and DNS server. A device that cannot reach a DHCP server may give itself a 169.254.x.x address.

NAT lets many private devices share one public IP address by translating addresses and ports at the router.
