"""Export notebook MOCs as static Mollweide overlays (not object-selection masks).

Run manually when updating footprints; regular website builds use the versioned
WebP images and manifest, without contacting CDS. Cached FITS are kept in .cache/.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import time
from urllib.request import urlopen

import astropy.units as u
from mocpy import MOC
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import distance_transform_edt, gaussian_filter

ROOT = Path(__file__).resolve().parent
LOCAL = ROOT.parent / 'notebooks/footprints/data/mocs'
CACHE = ROOT / '.cache/footprints'
OUTPUT = ROOT / 'public/footprints'
WIDTH, HEIGHT = 2048, 1024
# Display-only smoothing in projected pixels; source MOCs stay unchanged.
CLOSING_RADIUS = 12
BUFFER_RADIUS = 3
SMOOTHING_SIGMA = 3


def smooth_coverage(pixels, valid):
    """Join nearby cells, buffer and round outlines inside the sky ellipse."""
    padding = CLOSING_RADIUS + BUFFER_RADIUS + 1
    mask = np.pad(pixels.astype(bool), padding)
    # Disk closing bridges small gaps without rectangular filter artifacts.
    dilated = distance_transform_edt(~mask) <= CLOSING_RADIUS
    closed = distance_transform_edt(dilated) > CLOSING_RADIUS
    buffered = distance_transform_edt(~closed) <= BUFFER_RADIUS
    rounded = gaussian_filter(buffered.astype(np.float32), SMOOTHING_SIGMA) >= .5
    return (rounded[padding:-padding, padding:-padding] & valid).astype(np.uint8)

# The executable notebook cells are authoritative. Its prose mentions newer
# releases (e.g. Legacy DR9 / SDSS DR17), but the plotted MOCs are DR8 / DR16.
SPECS = [
    ('legacy', 'Legacy DR8', ['surveys', 'photometry'], '#80a7ec', 'legacy', [
        'https://cdsarc.cds.unistra.fr/ftp/VII/292/tab_7292_1_VII_292_north.moc.fits',
        'https://cdsarc.cds.unistra.fr/ftp/VII/292/tab_7292_2_VII_292_south.moc.fits']),
    ('des', 'DES DR2', ['surveys', 'photometry'], '#85c89a', 'extended', ['II/371/des_dr2']),
    ('hsc', 'HSC DR2', ['surveys', 'photometry'], '#72d0cf', 'combined', [
        'local:CDS-P-HSC-DR2-wide-color-i-r-g_MOC.fits', 'local:CDS-P-HSC-DR2-deep-color-i-r-g_MOC.fits']),
    ('kids', 'KiDS DR3', ['surveys', 'photometry'], '#ed8694', 'extended', ['II/347/kids_dr3']),
    ('rcslens', 'RCSLenS', ['surveys'], '#bd99df', 'extended', ['J/A+A/584/A44/table3']),
    ('cs82', 'CS82', ['surveys', 'photometry'], '#dfd283', 'extended', ['J/A+A/578/A79/tablea1']),
    ('cfhtlens', 'CFHTLenS / CFHTLS', ['surveys', 'photometry'], '#eba56e', 'cfht', ['II/317/cfhtls_w', 'II/317/cfhtls_d']),
    ('sdss', 'SDSS DR16', ['photometry', 'spectroscopy'], '#adb7c6', 'extended', ['V/154/sdss16']),
    ('delve', 'DELVE DR2', ['photometry'], '#dca1d3', 'raw', ['local:moc_delve_objects.fits']),
]
for sid, label, table, color in [
    ('gama', 'GAMA DR3', 'J/MNRAS/474/3875/gamadr3', '#8aa4ed'),
    ('ozdes', 'OzDES DR1', 'J/MNRAS/472/273/ozdesdr1', '#88caa5'),
    ('wigglez', 'WiggleZ', 'J/MNRAS/401/1429/wigglez1', '#bd99df'),
    ('2slaq', '2SLAQ', 'J/MNRAS/392/19/2slaqqso', '#ee8796'),
    ('2df', '2dFGRS', 'VII/250/2dfgrs', '#d7d07e'),
    ('6df', '6dFGS', 'VII/259/spectra', '#aa9bdf'),
    ('lamost', 'LAMOST DR7 LRS', 'V/156/dr7lrs', '#dc8e83'),
    ('ssrs', 'SSRS', 'J/AJ/116/1/galaxies', '#72c8d6'),
    ('lcrs', 'LCRS', 'VII/203/catalog', '#a9b4c1'),
    ('vipers', 'VIPERS', 'J/A+A/562/A23/spectro', '#e6ad7b'),
    ('deep2', 'DEEP2', 'III/268/deep2all', '#80baca'),
    ('zcosmos', 'zCOSMOS', 'J/ApJ/753/121/table5', '#bd92ca'),
    ('cnoc', 'CNOC2', 'J/ApJS/129/475/cnoc0223', '#b1ba78'),
    ('ages', 'AGES', 'J/ApJS/200/8/table2', '#87bfa6'),
    ('mgc', 'MGC', 'VII/240/mgczcat', '#86a8df'),
    ('2mrs', '2MRS', 'J/ApJS/199/26/table3', '#e1838a'),
    ('pscz', 'PSCz', 'VII/221/pscz', '#dfb481'),
    ('cfa', 'CfA', 'VII/193/zcat', '#83acdb'),
]:
    SPECS.append((sid, label, ['spectroscopy'], color, 'extended', [table]))
SPECS.append(('vvds', 'VVDS / VIMOS', ['spectroscopy'], '#e0ca7e', 'vvds', [
    f'J/A+A/559/A14/{table}' for table in ('cdfsdeep', 'f02deep', 'f02udeep', 'f10wide', 'f14wide', 'f22wide')]))


def source_path(source, offline):
    if source.startswith('local:'):
        return LOCAL / source[6:]
    path = CACHE / (hashlib.sha256(source.encode()).hexdigest()[:20] + '.fits')
    if path.exists():
        return path
    if offline:
        raise RuntimeError(f'Missing cached MOC: {source}')
    url = source if source.startswith('https:') else f'https://cdsarc.cds.unistra.fr/viz-bin/moc/{source}?order=11'
    for attempt in range(3):
        try:
            with urlopen(url, timeout=45) as response:
                data = response.read()
            if not data.startswith(b'SIMPLE'):
                raise ValueError(f'Expected FITS from {url}')
            path.write_bytes(data)
            return path
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def combine(paths, operation):
    mocs = [MOC.load(str(p), 'fits') for p in paths]
    if operation == 'extended':
        return mocs[0].extended()
    if operation == 'raw':
        return mocs[0]
    if operation in ('legacy', 'combined'):
        return mocs[0].extended().union(mocs[1].extended()).extended()
    if operation == 'cfht':
        return mocs[0].extended().union(mocs[1].extended()).extended()
    if operation == 'vvds':
        # Each of the six VVDS tables is extended before union, then once again.
        result = mocs[0].extended()
        for moc in mocs[1:]:
            result = result.union(moc.extended())
        return result.extended()
    raise ValueError(operation)


def inverse_projection():
    # Pixel centers, with the exact inverse of the browser's RA-left Mollweide.
    x, y = np.meshgrid((np.arange(WIDTH) + .5) / WIDTH * 4 * np.sqrt(2) - 2 * np.sqrt(2),
                       (np.arange(HEIGHT) + .5) / HEIGHT * 2 * np.sqrt(2) - np.sqrt(2))
    theta = np.arcsin(-y / np.sqrt(2))
    lon = np.pi * x / (2 * np.sqrt(2) * np.cos(theta))
    valid = (x / (2 * np.sqrt(2))) ** 2 + (y / np.sqrt(2)) ** 2 <= 1
    ra = (-np.rad2deg(lon[valid])) % 360
    dec = np.rad2deg(np.arcsin(np.clip((2 * theta[valid] + np.sin(2 * theta[valid])) / np.pi, -1, 1)))
    return valid, ra * u.deg, dec * u.deg


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true', help='Only use local/cached FITS')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sources = sorted({source for spec in SPECS for source in spec[5]})
    with ThreadPoolExecutor(max_workers=6) as pool:
        paths = dict(zip(sources, pool.map(lambda src: source_path(src, args.offline), sources)))
    valid, ra, dec = inverse_projection()
    layers = []
    rendered = {}
    for sid, label, groups, color, operation, refs in SPECS:
        moc = combine([paths[r] for r in refs], operation)
        pixels = np.zeros((HEIGHT, WIDTH), dtype=np.uint8)
        pixels[valid] = moc.contains_lonlat(ra, dec).astype(np.uint8)
        if not pixels.any():
            raise ValueError(f'Empty rendered footprint: {sid}')
        pixels = smooth_coverage(pixels, valid)
        if not pixels.any():
            raise ValueError(f'Empty smoothed footprint: {sid}')
        image = Image.fromarray(pixels).convert('P')
        rgb = [int(color[i:i+2], 16) for i in (1, 3, 5)]
        image.putpalette([0, 0, 0] + rgb + [0] * (256 * 3 - 6))
        buffer = io.BytesIO()
        image.info['transparency'] = 0
        image.convert('RGBA').save(buffer, format='WEBP', lossless=True, method=6)
        rendered[f'{sid}.webp'] = buffer.getvalue()
        # Draw the inner edge of the smoothed display coverage.
        eroded = np.asarray(Image.fromarray(pixels).filter(ImageFilter.MinFilter(5)))
        border = Image.fromarray(pixels - eroded).convert('P')
        border.putpalette([0, 0, 0] + rgb + [0] * (256 * 3 - 6))
        buffer = io.BytesIO()
        border.info['transparency'] = 0
        border.convert('RGBA').save(buffer, format='WEBP', lossless=True, method=6)
        rendered[f'{sid}-border.webp'] = buffer.getvalue()
        layers.append(dict(id=sid, label=label, groups=groups, color=color, image=f'{sid}.webp', border=f'{sid}-border.webp',
                           displayed_pixels=int(pixels.sum()), operation=operation, moc_order=int(moc.max_order), sky_fraction=float(moc.sky_fraction),
                           sources=[dict(source=r, sha256=hashlib.sha256(paths[r].read_bytes()).hexdigest()) for r in refs]))
        print(f'{label}: {moc.sky_fraction:.6f} of sky, {pixels.sum()} displayed pixels', flush=True)
    manifest = dict(projection='Mollweide', frame='ICRS', width=WIDTH, height=HEIGHT,
                    generated_at=datetime.now(timezone.utc).isoformat(),
                    source_notebook='notebooks/footprints/footprints.ipynb', mocpy_version='0.20.0',
                    visualization=dict(closing_radius_px=CLOSING_RADIUS, buffer_radius_px=BUFFER_RADIUS, gaussian_sigma_px=SMOOTHING_SIGMA),
                    note='Smoothed and buffered visualizations of notebook MOCs; source coverage statistics are unchanged. Not exact survey selection functions.',
                    layers=layers)
    # Do not overwrite versioned assets until every source and mask succeeds.
    for name, data in rendered.items():
        (OUTPUT / name).write_bytes(data)
    for sid, *_ in SPECS:
        for name in (f'{sid}.png', f'{sid}-border.png'):
            (OUTPUT / name).unlink(missing_ok=True)
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
