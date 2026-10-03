#!/usr/bin/env python3
"""
derived.py - parts that LaboBib does not have, put together from LaboBib drawings.

Each part is assembled from pieces of existing drawings (listed in `sources`), only moved,
combined or scaled to other standard joint sizes, so it keeps the style of the library. These
are adaptations of the LaboBib drawings and fall under the same terms (LICENSE-LaboBib.txt).

build_app_data.py adds them to the app data, each right after the part named in `after`.
Coordinates are drawing units (0.01 mm at the LaboBib scale of 1:5), like the extracted parts.
"""

PATH = ('<path fill="none" stroke="black" stroke-width="14" stroke-linejoin="round" '
        'stroke-linecap="round" d="{d}"/>')


def _pts(seq):
    return ' '.join(f'{round(x)} {round(y)}' for x, y in seq)


def reducer(cone_ns, socket_ns):
    """Reducer, cone NS 45 below and socket NS 29 above.
    Socket with rim: 'Erweiterungstücke 14-29' (adapter/61-83), moved; cone: the dimensions of
    'Massivstopfen NS 45' (stopfen/1-125); shoulder: the curve of 'Reduzierstücke 29-19'
    (adapter/21-83), scaled evenly so that it keeps its shape."""
    assert (cone_ns, socket_ns) == (45, 29)
    c = 490                                           # centre line: cone NS 45 is 900 wide, margin 40
    dx = c - 411                                      # the socket's centre in adapter/61-83
    rim = [(x + dx, y) for x, y in [(84, 187), (737, 187), (782, 174), (782, 52), (737, 40), (84, 40),
                                    (40, 52), (40, 174), (84, 187)]]
    walls = [(x + dx, y) for x, y in [(737, 187), (706, 703), (115, 703), (84, 187)]]
    # shoulder of adapter/21-83: left side, its centre 332, from its socket bottom (y 575) to its cone
    shoulder = [(137, 575), (125, 584), (120, 595), (106, 741), (102, 755), (91, 781), (76, 804), (59, 821), (40, 833)]
    r0, r1 = 332 - 137, 332 - 40                      # half widths there: socket bottom 195, cone top 292
    n0, n1 = (706 - 115) / 2, 900 / 2                 # here: socket NS 29 bottom 295.5, cone NS 45 top 450
    k = (n1 - n0) / (r1 - r0)
    left = [(c - (n0 + (332 - x - r0) * k), 703 + (y - 575) * k) for x, y in shoulder]
    right = [(2 * c - x, y) for x, y in left]
    top = left[-1][1]                                 # cone NS 45/40: 900 wide on top, 820 below, 800 long
    cone = [(c - 450, top), (c - 410, top + 800), (c + 410, top + 800), (c + 450, top)]
    d = (f'M{_pts(cone[:1])}L{_pts(cone[3:])}'
         f'M{_pts(left[:1])}L{_pts(left[1:])} {_pts(cone[1:])} {_pts(right[::-1])}'
         f'M{_pts(walls[:1])}L{_pts(walls[1:])}'
         f'M{_pts(rim[:1])}L{_pts(rim[1:])}')
    return {
        'id': 'derived/reducer-45-29', 'category': 'adapters', 'after': 'adapter/41-83',
        'name': 'Reduzierstücke 45-29', 'path': ['Reduzierstücke', '45-29'],
        'w': 2 * c, 'h': round(top + 840), 'svg': PATH.format(d=d),
        'snaps': [{'x': c, 'y': 40, 'type': 'socket', 'dir': 270, 'ns': 29, 'system': 'NS'},
                  {'x': c, 'y': round(top), 'type': 'cone', 'dir': 90, 'ns': 45, 'system': 'NS'}],
        'fill': None,
        'sources': ['adapter/61-83', 'adapter/21-83', 'stopfen/1-125'],
    }


def parts():
    return [reducer(45, 29)]


if __name__ == '__main__':
    for p in parts():
        print(p['id'], p['name'], p['w'], 'x', p['h'], 'from', ', '.join(p['sources']))
