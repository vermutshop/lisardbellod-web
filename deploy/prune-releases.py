"""Prune reproducible deployment copies, protecting the active and three newest releases."""
import argparse
import fcntl
from pathlib import Path
import re
import shutil

def candidates(base):
    base = base.resolve()
    releases = base / 'releases'
    current = base / 'current'
    if not current.is_symlink():
        raise RuntimeError('Refusing cleanup without active release symlink')
    active = current.resolve(strict=True)
    if active.parent != releases.resolve() or not re.fullmatch(r'[0-9a-f]{40}', active.name):
        raise RuntimeError('Unexpected active release path')
    complete = []
    for path in releases.iterdir():
        if path.is_symlink() or not path.is_dir() or not re.fullmatch(r'[0-9a-f]{40}', path.name):
            continue
        marker = path / 'public/deploy-commit.txt'
        if marker.is_symlink() or not marker.is_file() or marker.read_text().strip() != path.name:
            continue
        if not (path / 'public/index.html').is_file() or not (path / 'deploy/api-server.mjs').is_file():
            continue
        if {p.name for p in path.iterdir()} not in ({'public', 'deploy'}, {'public', 'deploy', 'api', 'scripts', 'package.json'}):
            continue
        complete.append(path)
    complete.sort(key=lambda p: p.stat().st_mtime_ns, reverse=True)
    keep = {active, *complete[:3]}
    return [p for p in complete if p not in keep]

def prune(base, apply=False):
    with (base / 'deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        old = candidates(base)
        for path in old:
            print(('Removing build copy: ' if apply else 'Would remove build copy: ') + path.name)
            if apply:
                shutil.rmtree(path)
        print(f'{len(old)} obsolete copies; active and three newest copies protected.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    prune(Path('/home/lisardbellod/apps'), args.apply)
