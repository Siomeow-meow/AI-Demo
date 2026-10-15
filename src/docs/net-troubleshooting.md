# Networking Lesson: Troubleshooting Connectivity

Work from the bottom up. First check the physical layer (cable, Wi-Fi switch, link lights), then whether the device has a valid IP address, then whether it can reach the gateway, then the internet by IP address, then the internet by name.

Handy commands: ipconfig /all on Windows (or ip addr on Linux) shows the address, gateway and DNS server. ping tests reachability and delay. tracert on Windows (traceroute on Linux) shows each hop along the path. nslookup or dig tests DNS. netstat -an lists connections and listening ports.

Typical findings: a 169.254.x.x address means DHCP failed. Pinging an IP address works but a name does not: a DNS problem. Pinging the gateway fails: a local network problem. Some sites work and others do not: check DNS, proxy or firewall rules. Slow everything: look for packet loss or an overloaded link.

Note that some devices block ping, so a failed ping does not always mean the host is down. Change one thing at a time and write down the results.
