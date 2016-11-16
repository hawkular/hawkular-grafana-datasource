#!/bin/sh

# NOTE: ideally these build steps should be integrated directly in the Dockerfile.
# However, because the grafana base image declares the plugins path as a volume,
# we cannot pre-install plugins using exclusively the Dockerfile.
# (see https://github.com/docker/docker/issues/3639)
# So we must run this script to build the docker image.

rm -r hawkular-grafana-datasource-release
wget https://github.com/hawkular/hawkular-grafana-datasource/archive/release.zip -O hawkular-grafana-datasource-release.zip && \
    unzip hawkular-grafana-datasource-release.zip && \
    rm hawkular-grafana-datasource-release.zip && \
    docker build -t hawkular/hawkular-grafana-datasource . && \
    rm -r hawkular-grafana-datasource-release
