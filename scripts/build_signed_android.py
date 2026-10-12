#!/usr/bin/env python3
"""Build and verify an internal Android APK without an Expo cloud account."""
import argparse
import os
from pathlib import Path
import secrets
import shutil
import subprocess
from urllib.parse import urlparse

root = Path(__file__).resolve().parents[1]
mobile = root / 'mobile'
parser = argparse.ArgumentParser()
parser.add_argument('--api-url', required=True, help='Reachable API URL; do not use localhost for a phone.')
parser.add_argument('--allow-local-http', action='store_true', help='Internal LAN testing only; production requires HTTPS.')
parser.add_argument('--prepare-only', action='store_true', help='Generate native project and verify Gradle setup without making an APK.')
args = parser.parse_args()
url = urlparse(args.api_url)
if url.scheme not in ('http', 'https') or not url.hostname or url.hostname in ('localhost', '127.0.0.1', '10.0.2.2'):
    parser.error('Provide an API URL reachable from both physical phones.')
if url.scheme == 'http' and not args.allow_local_http:
    parser.error('HTTP is allowed only with --allow-local-http for internal testing.')
sdk = Path(os.environ.get('ANDROID_HOME', str(Path.home() / 'Library/Android/sdk')))
java = Path(os.environ.get('JAVA_HOME', '/Applications/Android Studio.app/Contents/jbr/Contents/Home'))
if not (sdk / 'platform-tools/adb').exists() or not (java / 'bin/java').exists():
    raise SystemExit('Set ANDROID_HOME and JAVA_HOME to installed Android SDK and JDK locations.')
local = root / '.local/android'
local.mkdir(parents=True, exist_ok=True)
os.chmod(local, 0o700)
keystore = local / 'shelfmate-upload.keystore'
properties = local / 'signing.properties'
env = os.environ.copy()
env.update(JAVA_HOME=str(java), ANDROID_HOME=str(sdk), EXPO_PUBLIC_API_URL=args.api_url,
           SHELFMATE_SIGNING_PROPERTIES=str(properties), SHELFMATE_ALLOW_LOCAL_HTTP='1' if args.allow_local_http else '0')
if keystore.exists() != properties.exists():
    raise SystemExit('Signing files are incomplete. Restore your backup; do not regenerate an existing release key.')
if not keystore.exists():
    password = secrets.token_urlsafe(36)
    signing_env = env.copy()
    signing_env['SHELFMATE_SIGNING_PASSWORD'] = password
    subprocess.run([str(java / 'bin/keytool'), '-genkeypair', '-keystore', str(keystore), '-storetype', 'PKCS12',
                    '-storepass:env', 'SHELFMATE_SIGNING_PASSWORD', '-keypass:env', 'SHELFMATE_SIGNING_PASSWORD',
                    '-alias', 'shelfmate', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000',
                    '-dname', 'CN=ShelfMate Internal, OU=Development, O=ShelfMate, C=BH'], env=signing_env, check=True)
    # Neither file is committed. Keep an encrypted backup so future APK updates use this same key.
    properties.write_text(f'storeFile={keystore}\nstorePassword={password}\nkeyAlias=shelfmate\nkeyPassword={password}\n')
    os.chmod(keystore, 0o600)
    os.chmod(properties, 0o600)
subprocess.run(['npx', 'expo', 'prebuild', '--platform', 'android', '--no-install'], cwd=mobile, env=env, check=True)
android = mobile / 'android'
command = [str(android / 'gradlew'), ':app:tasks' if args.prepare_only else ':app:assembleRelease', '--console=plain', '--max-workers=2']
if not args.prepare_only:
    command += ['-PreactNativeArchitectures=arm64-v8a,armeabi-v7a']
subprocess.run(command, cwd=android, env=env, check=True)
if not args.prepare_only:
    apk = android / 'app/build/outputs/apk/release/app-release.apk'
    signer = sorted((sdk / 'build-tools').glob('*/apksigner'))[-1]
    subprocess.run([str(signer), 'verify', '--verbose', '--print-certs', str(apk)], env=env, check=True)
    artifacts = root / '.local/artifacts'
    artifacts.mkdir(parents=True, exist_ok=True)
    artifact = artifacts / 'ShelfMate-internal.apk'
    shutil.copy2(apk, artifact)
    print(f'Verified signed internal APK: {artifact}')
    print(f'API: {args.api_url}; keep that server reachable from both phones.')
