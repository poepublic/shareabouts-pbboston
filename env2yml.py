#!/usr/bin/env python3

import sys

for line in sys.stdin:
    line = line.strip()
    if not line or line.startswith('#'):
        continue

    key, val = line.split('=', maxsplit=1)

    if val.lower() in ('true', 'false'):
        val = f'"{val}"'

    sys.stdout.write(f'{key}: {val}\n')
