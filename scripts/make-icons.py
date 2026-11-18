"""Draw the app icon (a white tile with a red dot on felt green) as PNGs, no dependencies."""
import struct, sys, zlib

def png(size, path):
    bg, tile, dot = (0x14, 0x53, 0x2d), (0xf6, 0xf5, 0xf0), (0xb9, 0x1c, 0x1c)
    tw, th = size * 0.50, size * 0.66
    x0, y0 = (size - tw) / 2, (size - th) / 2
    r = size * 0.06  # tile corner radius
    cx, cy, dr = size / 2, size / 2, size * 0.13
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            inside = x0 <= px <= x0 + tw and y0 <= py <= y0 + th
            if inside:  # trim rounded corners
                qx = min(max(px, x0 + r), x0 + tw - r)
                qy = min(max(py, y0 + r), y0 + th - r)
                inside = (px - qx) ** 2 + (py - qy) ** 2 <= r * r
            c = bg
            if inside:
                c = dot if (px - cx) ** 2 + (py - cy) ** 2 <= dr * dr else tile
            row += bytes(c)
        rows.append(bytes(row))
    raw = zlib.compress(b''.join(rows), 9)
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', raw) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

out = sys.argv[1]
for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
    png(size, f'{out}/{name}')
print('icons written')
