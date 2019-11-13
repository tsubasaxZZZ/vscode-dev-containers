#-------------------------------------------------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
#-------------------------------------------------------------------------------------------------------------

FROM docker.io/chuxel/dotnetcore-3.0:dev

# This image comes with a base non-root user with sudo access. However, for Linux, 
# this user's GID/UID must match your local user UID/GID to avoid permission issues 
# with bind mounts. Update USER_UID / USER_GID if yours is not 1000. See 
# https://aka.ms/vscode-remote/containers/non-root-user.
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# [Optional] Use another version of Node.js as the default.
ARG INSTALL_NODE="false"
ARG NODE_VERSION="10"

# [Optional] Install the Azure CLI
ARG INSTALL_AZURE_CLI="false"

# Avoid warnings by switching to noninteractive
ENV DEBIAN_FRONTEND=noninteractive

# [Optional] Update UID/GID if needed and install additional software
RUN if [ "$USER_GID" != "1000" ] || [ "$USER_UID" != "1000" ]; then \
        if [ "$USER_GID" != "1000" ]; then sudo groupmod 1000 --gid $USER_GID; fi \
        && if [ "$USER_UID" != "1000" ]; then sudo usermod --uid $USER_UID node; fi; \
    fi \
    #
    # Optionally install another version of Node.js specified above
    && if [ "$INSTALL_NODE" = "true" ]; then \
        /bin/bash -c "source $NVM_DIR/nvm.sh \
            && nvm install ${NODE_VERSION} \
            && nvm alias default ${NODE_VERSION}" 2>&1; \
    fi \
    #
    # Optionally install the Azure CLI
    && if ! type az > /dev/null 2>&1 && [ "$INSTALL_NODE" = "true" ]; then \
        echo "deb [arch=amd64] https://packages.microsoft.com/repos/azure-cli/ $(lsb_release -cs) main" > /etc/apt/sources.list.d/azure-cli.list \
        && curl -sL https://packages.microsoft.com/keys/microsoft.asc | apt-key add - 2>/dev/null \
        && apt-get update \
        && apt-get install -y azure-cli; \
    fi \
    #
    # ***************************************************************
    # * Add steps for installing any other needed dependencies here *
    # ***************************************************************
    #
    # Clean up
    && sudo apt-get autoremove -y \
    && sudo apt-get clean -y \
    && sudo rm -rf /var/lib/apt/lists/*

# Uncomment to default to non-root user
# USER $USER_UID

# Switch back to dialog for any ad-hoc use of apt-get
ENV DEBIAN_FRONTEND=
