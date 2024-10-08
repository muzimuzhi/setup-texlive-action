#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC2154
readonly version="v${npm_package_version}"
export RUST_LOG="${RUST_LOG:-warn}"

# shellcheck disable=SC2154
case "${npm_lifecycle_event}" in
  version)
    git ls-files -z dist |
      xargs -0 git update-index --no-assume-unchanged --
    git add dist package-lock.json package.json
    git commit -m "chore(release): prepare for ${version}"
    ;;

  postversion)
    git ls-files -z dist |
      xargs -0 git update-index --assume-unchanged --

    npm run --silent changelog -- --tag "${version}" |
      git tag "${version}" --cleanup=whitespace -F -
    git tag -f "${version%%.*}" -m "${version}"

    git --no-pager show --color --no-patch "${version}" |
      sed '/^-----BEGIN/,/^-----END/d'
    echo
    ;;
esac
