#!/usr/bin/with-contenv bashio
set +o errexit +o nounset
# Register /config and any configured extra directories as T3 Code projects.
# Runs before the server starts (t3 project add writes the same SQLite DB).

add_project() {
    local path="$1" title="$2"
    if [ ! -d "${path}" ]; then
        bashio::log.warning "Project path does not exist, skipping: ${path}"
        return 0
    fi
    local out
    if out=$(t3 project add --title "${title}" "${path}" 2>&1); then
        bashio::log.info "Registered project: ${path}"
    elif echo "${out}" | grep -qiE 'already|exists|duplicate'; then
        bashio::log.debug "Project already registered: ${path}"
    else
        bashio::log.warning "Could not register ${path}: ${out}"
    fi
}

add_project /config "Home Assistant Config"

if bashio::config.has_value 'extra_project_dirs'; then
    for dir in $(bashio::config 'extra_project_dirs'); do
        add_project "${dir}" "$(basename "${dir}")"
    done
fi
