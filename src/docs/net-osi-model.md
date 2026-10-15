# Networking Lesson: The OSI Model

The OSI model describes networking in seven layers, from the bottom up: 1 Physical (cables, radio signals, bits), 2 Data Link (Ethernet, MAC addresses, switches, frames), 3 Network (IP addresses, routers, packets), 4 Transport (TCP and UDP, ports, segments), 5 Session (starting, keeping and ending conversations), 6 Presentation (encryption, compression, data formats) and 7 Application (HTTP, DNS, SMTP, SSH, what programs use).

A memory aid from the top down: "All People Seem To Need Data Processing". From the bottom up: "Please Do Not Throw Sausage Pizza Away".

When sending data, each layer adds its own header (encapsulation); the receiver removes them in reverse order. A switch works mainly at layer 2, a router at layer 3, and a load balancer or firewall can work at layers 4 to 7.

The practical TCP/IP model has four layers (link, internet, transport, application) and maps onto OSI. Use OSI when troubleshooting: start at the bottom (is the cable plugged in?) and move up.
