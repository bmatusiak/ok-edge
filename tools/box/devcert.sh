#!/bin/bash
# A local certificate authority + an apps.crp.to certificate for the box, so the web app is served as https://apps.crp.to
# (a site the testnet soft key - a production build - accepts for WebAuthn) without a browser warning. Once only.
# Also prints the certificate's SPKI hash for Chromium's --ignore-certificate-errors-spki-list (the snap Chromium did not
# honour the CA in its NSS store; the SPKI flag accepts this one certificate, nothing else).
set -e
D=~/project/onlykey/devcert
mkdir -p $D && cd $D
[ -f ca.key ] || openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.crt -days 825 -subj "/CN=OnlyKey dev CA (box)" >/dev/null 2>&1
if [ ! -f apps.crp.to.crt ]; then
  printf "subjectAltName=DNS:apps.crp.to,DNS:localhost\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n" > ext.cnf
  openssl req -newkey rsa:2048 -nodes -keyout apps.crp.to.key -out apps.crp.to.csr -subj "/CN=apps.crp.to" >/dev/null 2>&1
  openssl x509 -req -in apps.crp.to.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out apps.crp.to.crt -days 825 -extfile ext.cnf >/dev/null 2>&1
fi
chmod 600 ca.key apps.crp.to.key
openssl x509 -in apps.crp.to.crt -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64 > apps.crp.to.spki
echo "cert $D/apps.crp.to.crt  spki $(cat apps.crp.to.spki)"
