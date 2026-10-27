#!/bin/bash
# A local certificate authority + an apps.crp.to certificate for the box, so the web app is served as https://apps.crp.to
# (a site the testnet soft key - a production build - accepts for WebAuthn) without a browser warning. Once only.
# Also prints the certificate's SPKI hash for Chromium's --ignore-certificate-errors-spki-list (the snap Chromium did not
# honour the CA in its NSS store; the SPKI flag accepts this one certificate, nothing else).
#
# The certificate also names ctap_bridge's default site (ok-edge.bmatusiak.workers.dev), so the local server can be
# reached AS the key's own site: the web app joins its server only on the key's site (src/serverRoom.ts), and a key with
# ctap_bridge accepts that rpId - the production path, tested on the box without Cloudflare (webapp.sh site).
#   devcert.sh [--renew]    --renew: a new certificate (same CA) when the names change
set -e
D=~/project/onlykey/devcert
SITE=ok-edge.bmatusiak.workers.dev
mkdir -p $D && cd $D
[ -f ca.key ] || openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.crt -days 825 -subj "/CN=OnlyKey dev CA (box)" >/dev/null 2>&1
[ "${1:-}" = --renew ] && rm -f apps.crp.to.crt
if [ ! -f apps.crp.to.crt ]; then
  printf "subjectAltName=DNS:apps.crp.to,DNS:localhost,DNS:$SITE\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n" > ext.cnf
  openssl req -newkey rsa:2048 -nodes -keyout apps.crp.to.key -out apps.crp.to.csr -subj "/CN=apps.crp.to" >/dev/null 2>&1
  openssl x509 -req -in apps.crp.to.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out apps.crp.to.crt -days 825 -extfile ext.cnf >/dev/null 2>&1
fi
chmod 600 ca.key apps.crp.to.key
openssl x509 -in apps.crp.to.crt -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64 > apps.crp.to.spki
echo "cert $D/apps.crp.to.crt  spki $(cat apps.crp.to.spki)"
