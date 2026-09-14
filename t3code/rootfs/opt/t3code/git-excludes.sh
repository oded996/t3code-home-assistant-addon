#!/usr/bin/with-contenv bashio
set +o errexit +o nounset
# Maintain a managed block of exclude patterns in <repo>/.git/info/exclude for
# /config (and extra project dirs). The file is repo-local and never committed,
# so this does not touch the user's tracked content or .gitignore.

BEGIN_MARK="# >>> t3code add-on managed excludes >>>"
END_MARK="# <<< t3code add-on managed excludes <<<"

collect_patterns() {
    if bashio::config.has_value 'git_exclude_patterns'; then
        bashio::config 'git_exclude_patterns'
    fi
}

apply_excludes() {
    local repo="$1"
    [ -d "${repo}/.git" ] || return 0
    local exclude_file="${repo}/.git/info/exclude"
    mkdir -p "${repo}/.git/info"
    touch "${exclude_file}"

    local tmp
    tmp=$(mktemp)
    # Keep everything outside the managed block.
    awk -v b="${BEGIN_MARK}" -v e="${END_MARK}" '
        $0 == b { skip = 1; next }
        $0 == e { skip = 0; next }
        !skip { print }
    ' "${exclude_file}" > "${tmp}"

    local patterns
    patterns=$(collect_patterns)
    if [ -n "${patterns}" ]; then
        {
            echo "${BEGIN_MARK}"
            echo "${patterns}"
            echo "${END_MARK}"
        } >> "${tmp}"
    fi
    mv "${tmp}" "${exclude_file}"

    local count
    count=$(echo "${patterns}" | grep -c . || true)
    bashio::log.info "git excludes: ${count} managed pattern(s) written to ${exclude_file}"
}

apply_excludes /config
if bashio::config.has_value 'extra_project_dirs'; then
    for dir in $(bashio::config 'extra_project_dirs'); do
        apply_excludes "${dir}"
    done
fi
