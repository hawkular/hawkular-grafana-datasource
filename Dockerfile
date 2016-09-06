FROM grafana/grafana:latest

ENV GRAFANA_PLUGINS=/var/lib/grafana/plugins
ADD dist ${GRAFANA_PLUGINS}/hawkular
