#-------------------------------------------------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
#-------------------------------------------------------------------------------------------------------------

FROM REPLACE-ME

# This image comes with a base non-root user with sudo access. However, for Linux, 
# this user's GID/UID must match your local user UID/GID to avoid permission issues 
# with bind mounts. Update USER_UID / USER_GID if yours is not 1000. See 
# https://aka.ms/vscode-remote/containers/non-root-user.
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# [Optional] Update UID/GID if needed
RUN if [ "$USER_GID" != "1000" ] || [ "$USER_UID" != "1000" ]; then \
        USERNAME=$(awk -v val=1000 -F ":" '$3==val{print $1}' /etc/passwd) \
        && groupmod --gid $USER_GID $USERNAME \
        && usermod --uid $USER_UID --gid $USER_GID $USERNAME \
        && chown -R $USER_UID:$USER_GID /home/$USERNAME; \
    fi

# *************************************************************
# * Uncomment this section to use RUN instructions to install *
# * any needed dependencies after executing "apt-get update". *
# * See https://docs.docker.com/engine/reference/builder/#run *
# *************************************************************
# ENV DEBIAN_FRONTEND=noninteractive
# RUN apt-get update \
#    && apt-get -y install --no-reccomends <your-package-list-here> \
#    #
#    # Clean up
#    && apt-get autoremove -y \
#    && apt-get clean -y \
#    && rm -rf /var/lib/apt/lists/*
# ENV DEBIAN_FRONTEND=dialog

# Uncomment to default to non-root user
# USER $USER_UID

