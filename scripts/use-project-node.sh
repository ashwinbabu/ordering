#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node_version="$(tr -d '[:space:]' < "${project_root}/.nvmrc")"

unset npm_config_prefix NPM_CONFIG_PREFIX || true

if [[ -x "${HOME}/.nvm/versions/node/v${node_version}/bin/node" ]]; then
  export PATH="${HOME}/.nvm/versions/node/v${node_version}/bin:${PATH}"
elif [[ -x "${HOME}/.nvm/versions/node/${node_version}/bin/node" ]]; then
  export PATH="${HOME}/.nvm/versions/node/${node_version}/bin:${PATH}"
elif [[ -s "${NVM_DIR:-}/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "${NVM_DIR}/nvm.sh" --no-use
elif [[ -s "/opt/homebrew/opt/nvm/nvm.sh" ]]; then
  export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
  # shellcheck source=/dev/null
  set +u
  source "/opt/homebrew/opt/nvm/nvm.sh" --no-use
  set -u
elif [[ -s "/usr/local/opt/nvm/nvm.sh" ]]; then
  export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
  # shellcheck source=/dev/null
  set +u
  source "/usr/local/opt/nvm/nvm.sh" --no-use
  set -u
fi

if command -v nvm >/dev/null 2>&1; then
  nvm use --silent
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
node_minor="$(node -p 'Number(process.versions.node.split(".")[1])')"
if (( node_major < 22 || (node_major == 22 && node_minor < 13) )); then
  echo "This project needs Node >=22.13.0. Current Node is $(node --version)." >&2
  echo "Run: source /opt/homebrew/opt/nvm/nvm.sh && nvm use" >&2
  exit 69
fi

cd "${project_root}"
exec "$@"
