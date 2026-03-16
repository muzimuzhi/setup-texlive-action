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
    git add packages/data/data/package-names.json
    if ! git diff --quiet --cached; then
        git commit -m "chore(release): prepare for ${version}"
    fi
    ;;

  tag:prep)
    # Generate the changelog then stop for final tweaking.
    git ls-files -z dist |
      xargs -0 git update-index --assume-unchanged --
    trap 'git ls-files -z dist | xargs -0 git update-index --no-assume-unchanged --' EXIT

    npm run --silent changelog -- --tag "${version}" > RELEASE_NOTE.md
    echo "Release note for ${version} has been generated in RELEASE_NOTE.md"
    echo -e "\n"
    cat RELEASE_NOTE.md
    echo
    ;;

  tag)
    git tag "${version}" --cleanup=whitespace -F RELEASE_NOTE.md
    git tag -f "${version%%.*}" -m "${version}"

    git --no-pager show --color --no-patch "${version}" |
      sed '/^-----BEGIN/,/^-----END/d'
    echo
    ;;
esac
